/**
 * Draw Steel Montage Test Tool
 * Main module entry point — registers hooks, socket, settings, and scene controls.
 * v0.3.8
 */
import { MODULE_ID, SYSTEM_ID } from "./config.mjs";
import { MontageAPI } from "./api/montage-api.mjs";
import { MontageTestDataModel, MONTAGE_TEST_ITEM_TYPE } from "./items/montage-test-model.mjs";
import { MontageTestSheet } from "./items/montage-test-sheet.mjs";

const log = (...args) => console.log(`${MODULE_ID} |`, ...args);

/* ---------------------------------------- */
/*  Type Registration Helpers               */
/* ---------------------------------------- */

const _DOC_TYPE_FIELD_PATCHED = Symbol.for(`${MODULE_ID}.patchedDocTypeField`);

/**
 * Patch foundry.data.fields.DocumentTypeField._validateType so that our custom
 * item type is always accepted, regardless of which frozen list Foundry built
 * before modules were initialised.  This is the most precise fix because that
 * method is the single code-path that throws the "not a valid type" error.
 */
function _patchDocumentTypeFieldValidation() {
  const type = MONTAGE_TEST_ITEM_TYPE;
  const DocumentTypeField = foundry.data?.fields?.DocumentTypeField;
  if (!DocumentTypeField?.prototype || DocumentTypeField.prototype[_DOC_TYPE_FIELD_PATCHED]) return;

  const original = DocumentTypeField.prototype._validateType;
  if (typeof original !== "function") return;

  DocumentTypeField.prototype._validateType = function patchedDTFValidateType(value, options) {
    // If the value is our custom item type, skip validation entirely — our
    // TypeDataModel is responsible for validating its own system fields.
    if (value === type && (!this.documentClass || this.documentClass.documentName === "Item")) return;
    return original.call(this, value, options);
  };
  DocumentTypeField.prototype[_DOC_TYPE_FIELD_PATCHED] = true;
  log(`Patched DocumentTypeField._validateType to allow ${type}`);
}

const _TYPES_PATCHED = Symbol.for(`${MODULE_ID}.patchedItemTypes`);

/**
 * Override DrawSteelItem.TYPES (the static getter used by createDialog) to
 * include montageTest so it appears in the Create Item dropdown.
 */
function _patchItemDocumentClassTypes() {
  const type = MONTAGE_TEST_ITEM_TYPE;
  const cls = CONFIG.Item?.documentClass;
  if (!cls || cls[_TYPES_PATCHED]) return false;

  // Walk up to find any existing TYPES getter so we can call through to it.
  let owner = cls;
  while (owner && !Object.prototype.hasOwnProperty.call(owner, "TYPES")) {
    owner = Object.getPrototypeOf(owner);
  }
  const originalDescriptor = owner ? Object.getOwnPropertyDescriptor(owner, "TYPES") : null;
  const originalGetter = originalDescriptor?.get ?? null;
  const originalValue  = !originalGetter ? originalDescriptor?.value : null;

  Object.defineProperty(cls, "TYPES", {
    configurable: true,
    get() {
      let base;
      try {
        base = originalGetter ? originalGetter.call(this)
          : Array.isArray(originalValue) ? originalValue
          : originalValue instanceof Set  ? Array.from(originalValue)
          : originalValue != null          ? Object.keys(originalValue)
          : [];
      } catch {
        base = [];
      }
      // Normalise to a fresh mutable array.
      const arr = Array.isArray(base) ? [...base]
        : base instanceof Set          ? Array.from(base)
        : Object.keys(base ?? {});
      if (!arr.includes(type)) arr.push(type);
      return arr;
    },
  });

  cls[_TYPES_PATCHED] = true;
  return true;
}

/**
 * Try every known location where Foundry / Draw Steel maintain the list of
 * allowed item types, and add montageTest to each one.  Some lists are frozen
 * by the time module init runs; _patchDocumentTypeFieldValidation is the
 * authoritative safety-net when these mutations fail.
 */
function _ensureMontageTestAllowedItemType() {
  const type = MONTAGE_TEST_ITEM_TYPE;

  // 1. game.documentTypes.Item
  try {
    const docTypes = game.documentTypes?.Item;
    if (docTypes instanceof Set && !docTypes.has(type))       docTypes.add(type);
    else if (Array.isArray(docTypes) && !docTypes.includes(type)) {
      if (!Object.isFrozen(docTypes)) docTypes.push(type);
      else try { game.documentTypes.Item = [...docTypes, type]; } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // 2. game.system.documentTypes.Item
  try {
    const sysTypes = game.system?.documentTypes?.Item;
    if (sysTypes instanceof Set && !sysTypes.has(type))       sysTypes.add(type);
    else if (Array.isArray(sysTypes) && !sysTypes.includes(type)) {
      if (!Object.isFrozen(sysTypes)) sysTypes.push(type);
      else try { game.system.documentTypes.Item = [...sysTypes, type]; } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // 3. CONFIG.Item.documentClass.metadata.types (often a Set in Foundry v13)
  try {
    const metaTypes = CONFIG.Item?.documentClass?.metadata?.types;
    if (metaTypes instanceof Set && !metaTypes.has(type))       metaTypes.add(type);
    else if (Array.isArray(metaTypes) && !metaTypes.includes(type)) {
      if (!Object.isFrozen(metaTypes)) metaTypes.push(type);
      else try { CONFIG.Item.documentClass.metadata.types = [...metaTypes, type]; } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // 4. Patch the TYPES static getter so the Create Item dialog lists our type.
  try { _patchItemDocumentClassTypes(); } catch { /* ignore */ }

  log(`Registered allowed Item type: ${type}`);
}


let _systemValid = false;

/* ---------------------------------------- */
/*  Init Hook                               */
/* ---------------------------------------- */
Hooks.once("init", () => {
  if (game.system?.id !== SYSTEM_ID) return;
  _systemValid = true;

  // Register the custom Item type + data model
  CONFIG.Item.typeLabels ??= {};
  CONFIG.Item.dataModels ??= {};
  CONFIG.Item.typeLabels[MONTAGE_TEST_ITEM_TYPE] = "MONTAGE.Item.MontageTest";
  CONFIG.Item.dataModels[MONTAGE_TEST_ITEM_TYPE] = MontageTestDataModel;

  // Patch DocumentTypeField._validateType so Foundry core field validation
  // never rejects montageTest regardless of which frozen list was built before
  // modules ran.  This must happen before any Item.create() call.
  _patchDocumentTypeFieldValidation();

  // Also try to directly register in every known type list (helps with the
  // Create Item dialog and any list-based checks outside the field validator).
  _ensureMontageTestAllowedItemType();

  // Register default sheet
  const sheetConfig = foundry.applications?.sheets?.DocumentSheetConfig ?? globalThis.DocumentSheetConfig;
  if (sheetConfig?.registerSheet) {
    sheetConfig.registerSheet(Item, MODULE_ID, MontageTestSheet, {
      types: [MONTAGE_TEST_ITEM_TYPE],
      makeDefault: true,
      label: "MONTAGE.Item.MontageTest",
    });
  }

  // Preload Handlebars templates
  const templates = [
    `modules/${MODULE_ID}/templates/items/montage-test-sheet.hbs`,
  ];
  foundry.applications.handlebars.loadTemplates(templates);

  // Register Handlebars helper: equality comparison
  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  log("Initialized");
});

/* ---------------------------------------- */
/*  Setup Hook (after system init)          */
/* ---------------------------------------- */
Hooks.once("setup", () => {
  if (!_systemValid) return;
  // By the time "setup" fires the system has finished populating
  // game.documentTypes. Re-run patches so the lists include our type.
  _patchDocumentTypeFieldValidation();
  _ensureMontageTestAllowedItemType();
});

/* ---------------------------------------- */
/*  Ready Hook                              */
/* ---------------------------------------- */
Hooks.once("ready", () => {
  if (!_systemValid) return;

  // Expose public API
  const moduleInstance = game.modules.get(MODULE_ID);
  if (moduleInstance) {
    moduleInstance.api = new MontageAPI();
  }

  log("Ready");
});

/* ---------------------------------------- */
/*  Scene Controls                          */
/* ---------------------------------------- */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!_systemValid || !controls.tokens) return;

  controls.tokens.tools.montageTest = {
    name: "montageTest",
    title: "MONTAGE.Controls.OpenMontage",
    icon: "fa-solid fa-mountain-sun",
    order: 999,
    button: true,
    visible: true,
    onChange: (event, active) => {
      ui.sidebar.activateTab("items");
    },
  };
});

/* ---------------------------------------- */
/*  Chat Commands                           */
/* ---------------------------------------- */
Hooks.on("chatMessage", (chatLog, message, chatData) => {
  if (!_systemValid) return true;
  const cmd = message.trim().toLowerCase();

  if (cmd === "/montage") {
    ui.sidebar.activateTab("items");
    return false;
  }

  if (cmd === "/montage new" && game.user.isGM) {
    game.modules.get(MODULE_ID)?.api?.createMontageTest?.({ renderSheet: true });
    return false;
  }

  return true;
});

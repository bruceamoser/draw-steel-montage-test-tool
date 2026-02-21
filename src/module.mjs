/**
 * Draw Steel Montage Test Tool
 * Main module entry point — registers hooks, socket, settings, and scene controls.
 * v0.4.0
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
const _DATAMODELS_PROXIED    = Symbol.for(`${MODULE_ID}.proxiedDataModels`);

/**
 * Install a Proxy on CONFIG.Item.dataModels so that CONFIG.Item.dataModels['montageTest']
 * ALWAYS returns MontageTestDataModel, even if a system or Foundry core replaces the
 * underlying object after our init runs.  Also ensures 'montageTest' appears in
 * Object.keys() and ownKeys so Draw Steel's createDialog filter enumerates it.
 */
function _installDataModelsProxy() {
  // Already proxied by us
  if (CONFIG.Item.dataModels?.[_DATAMODELS_PROXIED]) return;

  const type  = MONTAGE_TEST_ITEM_TYPE;
  const model = MontageTestDataModel;
  const raw   = CONFIG.Item.dataModels ?? {};

  // Direct-assign first so the property is concrete on the target
  try { raw[type] = model; } catch { /* sealed — proxy will still intercept gets */ }

  const proxy = new Proxy(raw, {
    get(target, key, receiver) {
      if (key === type)                return target[key] ?? model;
      if (key === _DATAMODELS_PROXIED) return true;
      return Reflect.get(target, key, receiver);
    },
    has(target, key) {
      if (key === type) return true;
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      const keys = Reflect.ownKeys(target);
      if (!keys.includes(type)) keys.push(type);
      return keys;
    },
    getOwnPropertyDescriptor(target, key) {
      if (key === type) {
        // Prefer the real descriptor; fall back to a synthetic one.
        return Reflect.getOwnPropertyDescriptor(target, key)
          ?? { value: model, writable: true, enumerable: true, configurable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });

  try {
    CONFIG.Item.dataModels = proxy;
    log(`Installed CONFIG.Item.dataModels Proxy for ${type}`);
  } catch {
    // CONFIG.Item may be sealed — fall back; direct assignment is still there.
    log(`Could not install Proxy; relying on direct CONFIG.Item.dataModels assignment`);
  }
}

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

  // 4. module.json documentTypes declaration makes the type appear in the
  //    Create Item dialog natively — no TYPES getter patch needed.

  log(`Registered allowed Item type: ${type}`);
}


let _systemValid = false;

/* ---------------------------------------- */
/*  Init Hook                               */
/* ---------------------------------------- */
Hooks.once("init", () => {
  if (game.system?.id !== SYSTEM_ID) return;
  _systemValid = true;

  // Register the custom Item type + data model, then install a Proxy on
  // CONFIG.Item.dataModels so our entry survives any post-init reassignment.
  CONFIG.Item.typeLabels ??= {};
  CONFIG.Item.dataModels ??= {};
  CONFIG.Item.typeLabels[MONTAGE_TEST_ITEM_TYPE] = "MONTAGE.Item.MontageTest";
  CONFIG.Item.dataModels[MONTAGE_TEST_ITEM_TYPE] = MontageTestDataModel;
  _installDataModelsProxy();

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
  // Re-run after system finalization in case CONFIG.Item.dataModels was replaced.
  _installDataModelsProxy();
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

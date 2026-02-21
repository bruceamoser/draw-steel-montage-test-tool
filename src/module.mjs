/**
 * Draw Steel Montage Test Tool
 * Main module entry point — registers hooks, socket, settings, and scene controls.
 * v0.3.5
 */
import { MODULE_ID, SYSTEM_ID } from "./config.mjs";
import { MontageAPI } from "./api/montage-api.mjs";
import { MontageTestDataModel, MONTAGE_TEST_ITEM_TYPE } from "./items/montage-test-model.mjs";
import { MontageTestSheet } from "./items/montage-test-sheet.mjs";

const log = (...args) => console.log(`${MODULE_ID} |`, ...args);

const _TYPES_PATCHED = Symbol.for(`${MODULE_ID}.patchedItemTypes`);

function _ensureTypeInList(listOwnerLabel, list, type) {
  if (!Array.isArray(list) || list.includes(type)) return false;
  try {
    if (!Object.isFrozen(list)) {
      list.push(type);
      return true;
    }
  } catch {
    // fall through to reassignment attempts
  }
  // For frozen arrays (or push failures), callers should attempt reassignment.
  log(`Could not mutate ${listOwnerLabel} in-place; will try reassignment.`);
  return false;
}

function _coerceTypesToArray(types) {
  if (!types) return [];
  if (Array.isArray(types)) return types;
  if (types instanceof Set) return Array.from(types);
  if (typeof types === "object") return Object.keys(types);
  return [];
}

function _patchItemDocumentClassTypes() {
  const type = MONTAGE_TEST_ITEM_TYPE;
  const cls = CONFIG.Item?.documentClass;
  if (!cls || cls[_TYPES_PATCHED]) return false;

  // Find inherited TYPES getter so we can call it.
  let owner = cls;
  while (owner && !Object.prototype.hasOwnProperty.call(owner, "TYPES")) owner = Object.getPrototypeOf(owner);
  const originalGetter = owner ? Object.getOwnPropertyDescriptor(owner, "TYPES")?.get : null;

  Object.defineProperty(cls, "TYPES", {
    configurable: true,
    get() {
      let baseTypes;
      try {
        baseTypes = originalGetter ? originalGetter.call(this) : [];
      } catch {
        baseTypes = [];
      }

      const typesArr = _coerceTypesToArray(baseTypes);
      if (!typesArr.includes(type)) typesArr.push(type);
      return typesArr;
    },
  });

  cls[_TYPES_PATCHED] = true;
  return true;
}

function _ensureMontageTestAllowedItemType() {
  const type = MONTAGE_TEST_ITEM_TYPE;
  let changed = false;

  // Foundry's authoritative list for document type creation/UI.
  try {
    const docTypes = game.documentTypes?.Item;
    if (docTypes instanceof Set) {
      if (!docTypes.has(type)) {
        docTypes.add(type);
        changed = true;
      }
    } else if (Array.isArray(docTypes) && !docTypes.includes(type)) {
      const mutated = _ensureTypeInList("game.documentTypes.Item", docTypes, type);
      if (!mutated) {
        // Try reassignment (some environments freeze the array).
        try {
          if (game.documentTypes) game.documentTypes.Item = [...docTypes, type];
          changed = true;
        } catch {
          // ignore
        }
      } else {
        changed = true;
      }
    }
  } catch {
    // ignore
  }

  // System-declared list (many systems validate against this).
  try {
    const sysTypes = game.system?.documentTypes?.Item;
    if (sysTypes instanceof Set) {
      if (!sysTypes.has(type)) {
        sysTypes.add(type);
        changed = true;
      }
    } else if (Array.isArray(sysTypes) && !sysTypes.includes(type)) {
      const mutated = _ensureTypeInList("game.system.documentTypes.Item", sysTypes, type);
      if (!mutated) {
        try {
          if (game.system?.documentTypes) game.system.documentTypes.Item = [...sysTypes, type];
          changed = true;
        } catch {
          // ignore
        }
      } else {
        changed = true;
      }
    }
  } catch {
    // ignore
  }

  // Also patch the document class metadata types list if present.
  try {
    const metaTypes = CONFIG.Item?.documentClass?.metadata?.types;
    if (metaTypes instanceof Set) {
      if (!metaTypes.has(type)) {
        metaTypes.add(type);
        changed = true;
      }
    } else if (Array.isArray(metaTypes) && !metaTypes.includes(type)) {
      const mutated = _ensureTypeInList("CONFIG.Item.documentClass.metadata.types", metaTypes, type);
      if (!mutated) {
        try {
          if (CONFIG.Item?.documentClass?.metadata) {
            CONFIG.Item.documentClass.metadata.types = [...metaTypes, type];
            changed = true;
          }
        } catch {
          // ignore
        }
      } else {
        changed = true;
      }
    }
  } catch {
    // ignore
  }

  // Draw Steel's create dialog pulls options from DrawSteelItem.TYPES.
  try {
    if (_patchItemDocumentClassTypes()) changed = true;
  } catch {
    // ignore
  }

  if (changed) {
    log(`Registered allowed Item type: ${type}`);
  }
}

/* ---------------------------------------- */
/*  System validation                       */
/* ---------------------------------------- */
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

  // Ensure the type is visible/creatable in Draw Steel's custom create dialog.
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
/*  Ready Hook                              */
/* ---------------------------------------- */
Hooks.once("ready", () => {
  if (!_systemValid) return;

  // Some systems populate/finalize document types later in the init lifecycle.
  // Re-run the allowance patch at ready so the Create Item dialog can see it.
  _ensureMontageTestAllowedItemType();

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

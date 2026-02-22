/**
 * Draw Steel Montage Test Tool
 * Main module entry point — registers hooks, socket, settings, and scene controls.
 * v0.4.1
 */
import { MODULE_ID, SYSTEM_ID } from "./config.mjs";
import { MontageAPI } from "./api/montage-api.mjs";
import { MontageTestDataModel, MONTAGE_TEST_ITEM_TYPE } from "./items/montage-test-model.mjs";
import { MontageTestSheet } from "./items/montage-test-sheet.mjs";

const log = (...args) => console.log(`${MODULE_ID} |`, ...args);

/* ---------------------------------------- */
/*  Data model registration                 */
/* ---------------------------------------- */

/**
 * Register (or re-register) our data model and type label into CONFIG.Item.
 * Called in both init and setup because Draw Steel may finalize CONFIG.Item.dataModels
 * during its own init, after module init hooks run.
 */
function _registerDataModel() {
  CONFIG.Item.typeLabels ??= {};
  CONFIG.Item.dataModels ??= {};

  CONFIG.Item.typeLabels[MONTAGE_TEST_ITEM_TYPE] = "MONTAGE.Item.MontageTest";

  // If CONFIG.Item.dataModels is sealed/frozen, replace it with a new object.
  if (!Object.isExtensible(CONFIG.Item.dataModels)) {
    try {
      CONFIG.Item.dataModels = {
        ...CONFIG.Item.dataModels,
        [MONTAGE_TEST_ITEM_TYPE]: MontageTestDataModel,
      };
    } catch { /* CONFIG.Item itself is sealed */ }
  } else {
    CONFIG.Item.dataModels[MONTAGE_TEST_ITEM_TYPE] = MontageTestDataModel;
  }
}

/* ---------------------------------------- */
/*  DrawSteelItem.createDialog patch        */
/* ---------------------------------------- */

const _CREATE_DIALOG_PATCHED = Symbol.for(`${MODULE_ID}.patchedCreateDialog`);

/**
 * Patch DrawSteelItem.createDialog so that:
 *   1. Our data model is always in CONFIG.Item.dataModels when the type filter runs.
 *   2. The filter is effectively null-safe for any type without a registered model.
 *
 * Draw Steel's crashing line (item.mjs:34):
 *   types = types.filter(t => !CONFIG.Item.dataModels[t].metadata?.packOnly);
 * We re-register our model immediately before calling the original, which contains that line.
 */
function _patchDrawSteelCreateDialog() {
  const cls = CONFIG.Item?.documentClass;
  if (!cls || cls[_CREATE_DIALOG_PATCHED]) return;

  const original = cls.createDialog;
  if (typeof original !== "function") return;

  const type  = MONTAGE_TEST_ITEM_TYPE;
  const model = MontageTestDataModel;

  cls.createDialog = async function patchedCreateDialog(data = {}, createOptions = {}, options = {}) {
    // Ensure our data model entry exists right before Draw Steel's filter runs.
    try {
      if (!CONFIG.Item.dataModels?.[type]) {
        if (Object.isExtensible(CONFIG.Item.dataModels)) {
          CONFIG.Item.dataModels[type] = model;
        } else {
          CONFIG.Item.dataModels = { ...CONFIG.Item.dataModels, [type]: model };
        }
      }
    } catch { /* ignore */ }

    return original.call(this, data, createOptions, options);
  };

  cls[_CREATE_DIALOG_PATCHED] = true;
  log("Patched DrawSteelItem.createDialog");
}

/* ---------------------------------------- */
/*  System validation gate                  */
/* ---------------------------------------- */

let _systemValid = false;

/* ---------------------------------------- */
/*  Init Hook                               */
/* ---------------------------------------- */
Hooks.once("init", () => {
  if (game.system?.id !== SYSTEM_ID) return;
  _systemValid = true;

  _registerDataModel();

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
  foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/items/montage-test-sheet.hbs`,
  ]);

  Handlebars.registerHelper("eq", (a, b) => a === b);

  log("Initialized");
});

/* ---------------------------------------- */
/*  Setup Hook                              */
/* ---------------------------------------- */
Hooks.once("setup", () => {
  if (!_systemValid) return;

  // Re-register in case Draw Steel replaced CONFIG.Item.dataModels during its init.
  _registerDataModel();

  // Patch createDialog after the system has established CONFIG.Item.documentClass.
  _patchDrawSteelCreateDialog();
});

/* ---------------------------------------- */
/*  Ready Hook                              */
/* ---------------------------------------- */
Hooks.once("ready", () => {
  if (!_systemValid) return;

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
    onChange: () => ui.sidebar.activateTab("items"),
  };
});

/* ---------------------------------------- */
/*  Chat Commands                           */
/* ---------------------------------------- */
Hooks.on("chatMessage", (chatLog, message) => {
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

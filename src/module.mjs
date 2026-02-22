/**
 * Draw Steel Montage Test Tool
 * Main module entry point — registers hooks, socket, settings, and scene controls.
 * v0.4.2
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

/**
 * Draw Steel Montage Test Tool
 * Main module entry point — registers hooks, socket, settings, and scene controls.
 * v0.4.2
 */
import {
  MODULE_ID,
  SYSTEM_ID,
  FLAGS,
  DIFFICULTY_TABLE_BASE,
  BASE_HERO_COUNT,
  MIN_LIMIT,
} from "./config.mjs";
import { MontageAPI } from "./api/montage-api.mjs";
import { MontageTestDataModel, MONTAGE_TEST_ITEM_TYPE } from "./items/montage-test-model.mjs";
import { MontageTestSheet } from "./items/montage-test-sheet.mjs";
import { initSocket } from "./socket.mjs";

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

function _getLimitsForDifficulty(difficulty, participantCount) {
  const base = DIFFICULTY_TABLE_BASE[difficulty] ?? DIFFICULTY_TABLE_BASE.moderate;
  const delta = participantCount - BASE_HERO_COUNT;

  return {
    successLimit: Math.max(MIN_LIMIT, base.successLimit + delta),
    failureLimit: Math.max(MIN_LIMIT, base.failureLimit + delta),
  };
}

function _getOwnedActorParticipants() {
  const nonGmUsers = game.users.filter((user) => !user.isGM);
  if (!nonGmUsers.length) return [];

  return game.actors
    .filter((actor) => {
      return nonGmUsers.some((user) => actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));
    })
    .map((actor) => ({
      actorUuid: actor.uuid,
      name: actor.name,
      img: actor.img ?? "",
      round1: "",
      round2: "",
    }));
}

async function _populateMontageParticipantsOnCreate(item, userId) {
  if (item.type !== MONTAGE_TEST_ITEM_TYPE) return;
  if (item.parent || item.pack) return;
  if (game.user.id !== userId) return;

  const existingParticipants = item.system.participants ?? [];
  if (existingParticipants.length) return;

  const participants = _getOwnedActorParticipants();
  if (!participants.length) return;

  const difficulty = item.system.difficulty ?? "moderate";
  const { successLimit, failureLimit } = _getLimitsForDifficulty(difficulty, participants.length);

  await item.update({
    "system.participants": participants,
    "system.difficulty": difficulty,
    "system.successLimit": successLimit,
    "system.failureLimit": failureLimit,
  });
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

  // Register module settings used by the real-time montage tracker
  game.settings.register(MODULE_ID, FLAGS.ACTIVE_TEST, {
    name: "Active Montage Test",
    scope: "world",
    config: false,
    type: Object,
    default: null,
  });

  game.settings.register(MODULE_ID, FLAGS.COMPLETED_TESTS, {
    name: "Completed Montage Tests",
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register(MODULE_ID, FLAGS.SAVED_TESTS, {
    name: "Saved Draft Tests",
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });

  // Initialize the socket handler for real-time montage communication
  initSocket();

  const moduleInstance = game.modules.get(MODULE_ID);
  if (moduleInstance) {
    moduleInstance.api = new MontageAPI();
  }

  Hooks.on("createItem", (item, _options, userId) => {
    void _populateMontageParticipantsOnCreate(item, userId);
  });

  log("Ready");
});



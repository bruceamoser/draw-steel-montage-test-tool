/**
 * Draw Steel Montage Test Tool
 * Main module entry point — registers hooks, socket, settings, and scene controls.
 */
import { MODULE_ID, FLAGS } from "./config.mjs";
import { initSocket } from "./socket.mjs";
import { loadActiveTest } from "./data/montage-test.mjs";
import { MontageAPI } from "./api/montage-api.mjs";

/* ---------------------------------------- */
/*  Init Hook                               */
/* ---------------------------------------- */
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Draw Steel Montage Test Tool`);

  // Register world-scoped settings for persistence
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

  // Preload Handlebars templates
  const templates = [
    `modules/${MODULE_ID}/templates/montage-config.hbs`,
    `modules/${MODULE_ID}/templates/montage-tracker-gm.hbs`,
    `modules/${MODULE_ID}/templates/montage-tracker-player.hbs`,
    `modules/${MODULE_ID}/templates/action-approval.hbs`,
    `modules/${MODULE_ID}/templates/chat/round-summary.hbs`,
    `modules/${MODULE_ID}/templates/chat/test-complete.hbs`,
  ];
  foundry.applications.handlebars.loadTemplates(templates);

  // Register Handlebars helper: equality comparison
  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });
});

/* ---------------------------------------- */
/*  Ready Hook                              */
/* ---------------------------------------- */
Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);

  // Initialize socket communication
  initSocket();

  // Expose public API
  const moduleInstance = game.modules.get(MODULE_ID);
  if (moduleInstance) {
    moduleInstance.api = new MontageAPI();
  }

  // If there's an active test and we're a player, auto-open the player tracker
  const testData = loadActiveTest();
  if (testData && testData.status === "active" && !game.user.isGM) {
    _openPlayerTracker();
  }

  // If there's an active test and we're GM, remind them
  if (testData && game.user.isGM) {
    ui.notifications.info(
      game.i18n.format("MONTAGE.Notify.ActiveTestExists", { name: testData.name }),
    );
  }
});

/* ---------------------------------------- */
/*  Scene Controls                          */
/* ---------------------------------------- */
Hooks.on("getSceneControlButtons", (controls) => {
  // v13 API: controls is Record<string, SceneControl>, tools is Record<string, SceneControlTool>
  if (!controls.tokens) return;

  const _handler = (event, active) => {
    console.log(`${MODULE_ID} | Montage button clicked`, { event, active });
    if (game.user.isGM) {
      _openGMTracker();
    } else {
      _openPlayerTracker();
    }
  };

  controls.tokens.tools.montageTest = {
    name: "montageTest",
    title: "MONTAGE.Controls.OpenMontage",
    icon: "fa-solid fa-mountain-sun",
    order: Object.keys(controls.tokens.tools).length,
    button: true,
    visible: true,
    onChange: _handler,
    onClick: _handler,
  };
  console.log(`${MODULE_ID} | Registered montageTest tool`, controls.tokens.tools.montageTest);
});

/* ---------------------------------------- */
/*  Chat Commands                           */
/* ---------------------------------------- */
Hooks.on("chatMessage", (log, message, chatData) => {
  const cmd = message.trim().toLowerCase();

  if (cmd === "/montage") {
    if (game.user.isGM) {
      _openGMTracker();
    } else {
      _openPlayerTracker();
    }
    return false; // Prevent the message from being posted
  }

  if (cmd === "/montage new" && game.user.isGM) {
    _openConfig();
    return false;
  }

  return true;
});

/* ---------------------------------------- */
/*  Helper functions                        */
/* ---------------------------------------- */

/** @private */
async function _openGMTracker() {
  try {
    const { MontageTrackerGMApp } = await import("./apps/montage-tracker-gm.mjs");
    const testData = loadActiveTest();
    if (!testData) {
      // No active test — open the config to create one
      return _openConfig();
    }
    new MontageTrackerGMApp().render({ force: true });
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to open GM tracker`, err);
  }
}

/** @private */
async function _openPlayerTracker() {
  try {
    const { MontageTrackerPlayerApp } = await import("./apps/montage-tracker-player.mjs");
    new MontageTrackerPlayerApp().render({ force: true });
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to open player tracker`, err);
  }
}

/** @private */
async function _openConfig() {
  try {
    const { MontageConfigApp } = await import("./apps/montage-config.mjs");
    new MontageConfigApp().render({ force: true });
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to open config`, err);
  }
}

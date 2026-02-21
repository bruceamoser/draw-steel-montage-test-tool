/**
 * Draw Steel Montage Test Tool
 * Main module entry point — registers hooks, socket, settings, and scene controls.
 */
import { MODULE_ID, FLAGS } from "./config.mjs";
import { initSocket } from "./socket.mjs";
import { loadActiveTest } from "./data/montage-test.mjs";
import { MontageAPI } from "./api/montage-api.mjs";
import { MontageTrackerGMApp } from "./apps/montage-tracker-gm.mjs";
import { MontageTrackerPlayerApp } from "./apps/montage-tracker-player.mjs";
import { MontageConfigApp } from "./apps/montage-config.mjs";

/* ---------------------------------------- */
/*  Singleton app instances                 */
/* ---------------------------------------- */
let _gmTracker = null;
let _playerTracker = null;
let _configApp = null;

function getGMTracker() {
  if (!_gmTracker) _gmTracker = new MontageTrackerGMApp();
  return _gmTracker;
}

function getPlayerTracker() {
  if (!_playerTracker) _playerTracker = new MontageTrackerPlayerApp();
  return _playerTracker;
}

function getConfigApp() {
  if (!_configApp) _configApp = new MontageConfigApp();
  return _configApp;
}

/* ---------------------------------------- */
/*  System validation                       */
/* ---------------------------------------- */
let _systemValid = false;

/* ---------------------------------------- */
/*  Init Hook                               */
/* ---------------------------------------- */
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Draw Steel Montage Test Tool`);

  // Validate that we're running on the Draw Steel system
  if (game.system?.id !== "draw-steel") {
    console.warn(`${MODULE_ID} | Not running on Draw Steel system — disabling.`);
    return;
  }
  _systemValid = true;

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
  if (!_systemValid) return;
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
    const tracker = getPlayerTracker();
    tracker.render({ force: true });
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
  if (!_systemValid) return;
  if (!controls.tokens) return;

  controls.tokens.tools.montageTest = {
    name: "montageTest",
    title: "MONTAGE.Controls.OpenMontage",
    icon: "fa-solid fa-mountain-sun",
    button: true,
    visible: true,
    onChange: () => {
      if (game.user.isGM) {
        const testData = loadActiveTest();
        if (!testData) {
          const cfg = getConfigApp();
          if (cfg.rendered) cfg.close();
          else cfg.render({ force: true });
        } else {
          const tracker = getGMTracker();
          if (tracker.rendered) tracker.close();
          else tracker.render({ force: true });
        }
      } else {
        const tracker = getPlayerTracker();
        if (tracker.rendered) tracker.close();
        else tracker.render({ force: true });
      }
    },
  };
});

/* ---------------------------------------- */
/*  Chat Commands                           */
/* ---------------------------------------- */
Hooks.on("chatMessage", (log, message, chatData) => {
  if (!_systemValid) return true;
  const cmd = message.trim().toLowerCase();

  if (cmd === "/montage") {
    if (game.user.isGM) {
      const testData = loadActiveTest();
      if (!testData) {
        getConfigApp().render({ force: true });
      } else {
        getGMTracker().render({ force: true });
      }
    } else {
      getPlayerTracker().render({ force: true });
    }
    return false; // Prevent the message from being posted
  }

  if (cmd === "/montage new" && game.user.isGM) {
    getConfigApp().render({ force: true });
    return false;
  }

  return true;
});

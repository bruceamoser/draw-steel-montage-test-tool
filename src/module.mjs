/**
 * Draw Steel Montage Test Tool
 * Main module entry point — registers hooks, socket, settings, and scene controls.
 * v0.2.0
 */
import { MODULE_ID, FLAGS, TEST_STATUS, SOCKET_NAME, SOCKET_EVENTS } from "./config.mjs";
import { initSocket } from "./socket.mjs";
import { loadActiveTest } from "./data/montage-test.mjs";
import { MontageAPI } from "./api/montage-api.mjs";
import { MontageTrackerGMApp } from "./apps/montage-tracker-gm.mjs";
import { MontageTrackerPlayerApp } from "./apps/montage-tracker-player.mjs";
import { MontageConfigApp } from "./apps/montage-config.mjs";

const log = (...args) => console.log(`${MODULE_ID} |`, ...args);

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
  if (game.system?.id !== "draw-steel") return;
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

  game.settings.register(MODULE_ID, FLAGS.SAVED_TESTS, {
    name: "Saved Montage Tests",
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

  log("Initialized");
});

/* ---------------------------------------- */
/*  Ready Hook                              */
/* ---------------------------------------- */
Hooks.once("ready", () => {
  if (!_systemValid) return;

  // Initialize socket communication
  initSocket();

  // Expose public API
  const moduleInstance = game.modules.get(MODULE_ID);
  if (moduleInstance) {
    moduleInstance.api = new MontageAPI();
  }

  // Listen for montage activation — auto-open player tracker
  game.socket.on(SOCKET_NAME, (payload) => {
    if (payload.event === SOCKET_EVENTS.MONTAGE_ACTIVATED && !game.user.isGM) {
      getPlayerTracker().render({ force: true });
    }
  });

  // If there's an active test and we're a player, auto-open the player tracker
  const testData = loadActiveTest();
  if (testData && testData.status === TEST_STATUS.ACTIVE && !game.user.isGM) {
    getPlayerTracker().render({ force: true });
  }

  // If there's an active test and we're GM, remind them
  if (testData && game.user.isGM) {
    ui.notifications.info(
      game.i18n.format("MONTAGE.Notify.ActiveTestExists", { name: testData.name }),
    );
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
      if (game.user.isGM) {
        const testData = loadActiveTest();
        // No test or still in setup → open config (Phase 1 or Phase 2)
        if (!testData || testData.status === TEST_STATUS.SETUP) {
          const cfg = getConfigApp();
          if (cfg.rendered) cfg.close();
          else cfg.render({ force: true });
        } else {
          // Active or Resolved → open GM tracker
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
Hooks.on("chatMessage", (chatLog, message, chatData) => {
  if (!_systemValid) return true;
  const cmd = message.trim().toLowerCase();

  if (cmd === "/montage") {
    if (game.user.isGM) {
      const testData = loadActiveTest();
      if (!testData || testData.status === TEST_STATUS.SETUP) {
        getConfigApp().render({ force: true });
      } else {
        getGMTracker().render({ force: true });
      }
    } else {
      getPlayerTracker().render({ force: true });
    }
    return false;
  }

  if (cmd === "/montage new" && game.user.isGM) {
    getConfigApp().render({ force: true });
    return false;
  }

  if (cmd === "/montage manage" && game.user.isGM) {
    getConfigApp().render({ force: true });
    return false;
  }

  return true;
});

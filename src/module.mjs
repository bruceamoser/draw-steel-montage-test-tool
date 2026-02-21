/**
 * Draw Steel Montage Test Tool
 * Main module entry point — registers hooks, socket, settings, and scene controls.
 * v0.1.6-diag — diagnostic logging build
 */
import { MODULE_ID, FLAGS } from "./config.mjs";
import { initSocket } from "./socket.mjs";
import { loadActiveTest } from "./data/montage-test.mjs";
import { MontageAPI } from "./api/montage-api.mjs";
import { MontageTrackerGMApp } from "./apps/montage-tracker-gm.mjs";
import { MontageTrackerPlayerApp } from "./apps/montage-tracker-player.mjs";
import { MontageConfigApp } from "./apps/montage-config.mjs";

const BUILD = "0.1.6-diag";
const log = (...args) => console.log(`%c${MODULE_ID} v${BUILD}`, "color: #e9a526; font-weight: bold;", ...args);
const warn = (...args) => console.warn(`%c${MODULE_ID} v${BUILD}`, "color: #e9a526; font-weight: bold;", ...args);

log("Module file loaded (top-level)");

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
  log("init hook fired");
  log("game.system?.id =", game.system?.id);

  // Validate that we're running on the Draw Steel system
  if (game.system?.id !== "draw-steel") {
    warn("Not running on Draw Steel system — disabling. game.system =", game.system);
    return;
  }
  _systemValid = true;
  log("System validated — _systemValid =", _systemValid);

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

  log("init hook complete");
});

/* ---------------------------------------- */
/*  Ready Hook                              */
/* ---------------------------------------- */
Hooks.once("ready", () => {
  log("ready hook fired — _systemValid =", _systemValid);
  if (!_systemValid) return;

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
  log("ready hook complete");
});

/* ---------------------------------------- */
/*  Scene Controls                          */
/* ---------------------------------------- */
Hooks.on("getSceneControlButtons", (controls) => {
  log("getSceneControlButtons fired — _systemValid =", _systemValid);
  log("controls type:", typeof controls, "keys:", Object.keys(controls));
  if (!_systemValid) {
    warn("getSceneControlButtons: skipped — _systemValid is false");
    return;
  }
  if (!controls.tokens) {
    warn("getSceneControlButtons: skipped — controls.tokens is", controls.tokens);
    return;
  }

  log("controls.tokens.tools keys (before):", Object.keys(controls.tokens.tools));

  const montageOnChange = (event, active) => {
    log(">>> onChange FIRED <<<", { event, active, isGM: game.user.isGM });
    if (game.user.isGM) {
      const testData = loadActiveTest();
      log("GM — testData:", testData);
      if (!testData) {
        const cfg = getConfigApp();
        log("Opening config (rendered:", cfg.rendered, ")");
        if (cfg.rendered) cfg.close();
        else cfg.render({ force: true });
      } else {
        const tracker = getGMTracker();
        log("Opening GM tracker (rendered:", tracker.rendered, ")");
        if (tracker.rendered) tracker.close();
        else tracker.render({ force: true });
      }
    } else {
      const tracker = getPlayerTracker();
      log("Opening player tracker (rendered:", tracker.rendered, ")");
      if (tracker.rendered) tracker.close();
      else tracker.render({ force: true });
    }
  };

  const toolDef = {
    name: "montageTest",
    title: "MONTAGE.Controls.OpenMontage",
    icon: "fa-solid fa-mountain-sun",
    order: 999,
    button: true,
    visible: true,
    onChange: montageOnChange,
  };

  controls.tokens.tools.montageTest = toolDef;

  log("Registered tool. Full definition:", JSON.stringify({
    name: toolDef.name,
    title: toolDef.title,
    icon: toolDef.icon,
    order: toolDef.order,
    button: toolDef.button,
    visible: toolDef.visible,
    hasOnChange: typeof toolDef.onChange === "function",
  }));
  log("controls.tokens.tools keys (after):", Object.keys(controls.tokens.tools));

  // Also log ALL tools and their properties for comparison
  for (const [key, tool] of Object.entries(controls.tokens.tools)) {
    log(`  tool "${key}":`, {
      button: tool.button,
      toggle: tool.toggle,
      visible: tool.visible,
      hasOnChange: typeof tool.onChange === "function",
      order: tool.order,
    });
  }
});

/* ---------------------------------------- */
/*  Chat Commands                           */
/* ---------------------------------------- */
Hooks.on("chatMessage", (chatLog, message, chatData) => {
  if (!_systemValid) return true;
  const cmd = message.trim().toLowerCase();

  if (cmd === "/montage") {
    log("/montage command received");
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
    log("/montage new command received");
    getConfigApp().render({ force: true });
    return false;
  }

  return true;
});

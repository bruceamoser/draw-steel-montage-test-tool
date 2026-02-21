import { MODULE_ID, TEST_STATUS, ACTION_TYPE, CHARACTERISTIC_LABELS, getSkillLabel } from "../config.mjs";
import { loadActiveTest } from "../data/montage-test.mjs";
import { hasHeroActedThisRound, getCurrentRound } from "../helpers/resolution.mjs";
import { onStateUpdate, submitAction } from "../socket.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Player Tracker — shows montage progress and lets the player choose an action
 * for their hero each round.
 */
export class MontageTrackerPlayerApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /** Unsubscribe callback for socket state updates. */
  #unsubState = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "montage-tracker-player",
    classes: ["montage-app", "montage-tracker-player"],
    window: {
      title: "MONTAGE.Tracker.PlayerTitle",
      icon: "fa-solid fa-mountain-sun",
      resizable: true,
    },
    position: {
      width: 500,
      height: 550,
    },
    actions: {
      submitAction: MontageTrackerPlayerApp.#onSubmitAction,
    },
  };

  /** @override */
  static PARTS = {
    tracker: {
      template: `modules/${MODULE_ID}/templates/montage-tracker-player.hbs`,
    },
  };

  /** @override */
  async _prepareContext(options) {
    const testData = loadActiveTest();
    if (!testData || testData.status !== TEST_STATUS.ACTIVE) {
      return { hasTest: false, isActive: false };
    }

    // Identify which hero(es) this player controls
    const controlledHeroes = testData.heroes.filter((h) => {
      const actor = game.actors.get(h.actorId);
      return actor?.isOwner && !actor.hasPlayerOwner === false;
    });

    if (controlledHeroes.length === 0) {
      return { hasTest: true, isActive: true, hasHero: false };
    }

    // For simplicity, use the first controlled hero
    const hero = controlledHeroes[0];
    const actorId = hero.actorId;

    // Check if this hero has already acted this round
    const hasActed = hasHeroActedThisRound(testData, actorId);

    // Check if the hero has a pending action awaiting GM approval
    const pendingAction = (testData.pendingActions ?? []).find(
      (p) => p.actorId === actorId,
    );

    // Get current round info
    const currentRound = getCurrentRound(testData);

    // Get hero's actions from previous rounds
    const pastActions = [];
    for (const round of testData.rounds) {
      for (const action of round.actions) {
        if (action.actorId === actorId) {
          pastActions.push({
            ...action,
            roundNumber: round.roundNumber,
            typeLabel: game.i18n.localize(
              `MONTAGE.Action.${action.type.charAt(0).toUpperCase() + action.type.slice(1)}`,
            ),
            outcomeLabel: action.outcome
              ? game.i18n.localize(
                  `MONTAGE.Outcome.${action.outcome.charAt(0).toUpperCase() + action.outcome.slice(1)}`,
                )
              : "",
          });
        }
      }
    }

    // Other heroes (for aid target selection)
    const otherHeroes = testData.heroes
      .filter((h) => h.actorId !== actorId)
      .map((h) => ({
        actorId: h.actorId,
        name: h.name,
        img: h.img ?? "icons/svg/mystery-man.svg",
      }));

    // Action types for the select dropdown
    const actionTypes = [
      { value: ACTION_TYPE.ROLL, label: game.i18n.localize("MONTAGE.Action.Roll") },
      { value: ACTION_TYPE.AID, label: game.i18n.localize("MONTAGE.Action.Aid") },
      { value: ACTION_TYPE.ABILITY, label: game.i18n.localize("MONTAGE.Action.Ability") },
      { value: ACTION_TYPE.NOTHING, label: game.i18n.localize("MONTAGE.Action.Nothing") },
    ];

    // Build characteristic options from the hero actor
    const actor = game.actors.get(actorId);
    const characteristics = Object.entries(CHARACTERISTIC_LABELS).map(([key, name]) => {
      const value = actor?.system?.characteristics?.[key]?.value ?? 0;
      return { value: key, label: `${name} (${value >= 0 ? "+" : ""}${value})`, modifier: value };
    });

    // Build skill options from Draw Steel i18n
    const skillListRaw = game.i18n.translations?.DRAW_STEEL?.SKILL?.List ?? {};
    const skills = Object.entries(skillListRaw)
      .map(([key, label]) => ({ value: key, label: typeof label === "string" ? label : key }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Progress percentages
    const successPct = testData.successLimit > 0
      ? Math.min(100, Math.round((testData.currentSuccesses / testData.successLimit) * 100))
      : 0;
    const failurePct = testData.failureLimit > 0
      ? Math.min(100, Math.round((testData.currentFailures / testData.failureLimit) * 100))
      : 0;

    // Active complications the player should know about
    const activeComplications = testData.complications
      .filter((c) => c.triggerRound <= testData.currentRound && !c.resolved)
      .map((c) => ({ description: c.description }));

    return {
      hasTest: true,
      isActive: true,
      hasHero: true,
      actorId,
      heroName: hero.name,
      heroImg: hero.img ?? "icons/svg/mystery-man.svg",
      testName: testData.name,
      currentRound: testData.currentRound,
      maxRounds: testData.maxRounds,
      currentSuccesses: testData.currentSuccesses,
      successLimit: testData.successLimit,
      currentFailures: testData.currentFailures,
      failureLimit: testData.failureLimit,
      successPct,
      failurePct,
      hasActed,
      hasPending: !!pendingAction,
      pendingType: pendingAction
        ? game.i18n.localize(
            `MONTAGE.Action.${pendingAction.type.charAt(0).toUpperCase() + pendingAction.type.slice(1)}`,
          )
        : "",
      canAct: !hasActed && !pendingAction,
      actionTypes,
      characteristics,
      skills,
      otherHeroes,
      hasOtherHeroes: otherHeroes.length > 0,
      pastActions,
      hasPastActions: pastActions.length > 0,
      activeComplications,
      hasComplications: activeComplications.length > 0,
      difficultyLabel: game.i18n.localize(
        `MONTAGE.Difficulty.${testData.difficulty.charAt(0).toUpperCase() + testData.difficulty.slice(1)}`,
      ),
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Subscribe to real-time state updates
    if (!this.#unsubState) {
      this.#unsubState = onStateUpdate(() => this.render());
    }

    // Toggle aid-target and roll-fields visibility based on action type selection
    const actionSelect = this.element.querySelector('[name="actionType"]');
    const aidGroup = this.element.querySelector(".aid-target-group");
    const rollFields = this.element.querySelector(".roll-fields-group");
    if (actionSelect) {
      const toggle = () => {
        const isRollOrAid = actionSelect.value === ACTION_TYPE.ROLL || actionSelect.value === ACTION_TYPE.AID;
        if (aidGroup) aidGroup.style.display = actionSelect.value === ACTION_TYPE.AID ? "" : "none";
        if (rollFields) rollFields.style.display = isRollOrAid ? "" : "none";
      };
      toggle();
      actionSelect.addEventListener("change", toggle);
    }
  }

  /** @override */
  _onClose(options) {
    if (this.#unsubState) {
      this.#unsubState();
      this.#unsubState = null;
    }
    super._onClose(options);
  }

  /**
   * Submit the player's chosen action.
   */
  static async #onSubmitAction(event, target) {
    const form = this.element.querySelector('.montage-action-form');
    const actorId = form.querySelector('[name="actorId"]')?.value;
    const actionType = form.querySelector('[name="actionType"]')?.value;
    const aidTarget = form.querySelector('[name="aidTarget"]')?.value || null;
    const characteristic = form.querySelector('[name="characteristic"]')?.value || null;
    const skill = form.querySelector('[name="skill"]')?.value || null;

    if (!actorId || !actionType) {
      ui.notifications.warn(game.i18n.localize("MONTAGE.Warn.SelectAction"));
      return;
    }

    const isRollOrAid = actionType === ACTION_TYPE.ROLL || actionType === ACTION_TYPE.AID;
    if (isRollOrAid && !characteristic) {
      ui.notifications.warn(game.i18n.localize("MONTAGE.Warn.SelectCharacteristic"));
      return;
    }

    await submitAction({
      actorId,
      type: actionType,
      aidTarget: actionType === ACTION_TYPE.AID ? aidTarget : null,
      characteristic: isRollOrAid ? characteristic : null,
      skill: isRollOrAid ? skill : null,
    });

    ui.notifications.info(game.i18n.localize("MONTAGE.Notify.ActionSubmitted"));
  }
}

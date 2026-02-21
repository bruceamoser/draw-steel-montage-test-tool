import { MODULE_ID, TEST_STATUS, ACTION_TYPE } from "../config.mjs";
import { loadActiveTest, saveActiveTest } from "../data/montage-test.mjs";
import { getCurrentRound, getHeroesWaiting, evaluateResolution } from "../helpers/resolution.mjs";
import {
  onStateUpdate,
  onPendingAction,
  activateTest,
  advanceRound,
  endTestEarly,
  adjustTally,
  approveAction,
  rejectAction,
} from "../socket.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM Tracker app — the main control panel for the Director during an active montage test.
 */
export class MontageTrackerGMApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * Unsubscribe function for state updates.
   * @type {Function|null}
   */
  #unsubState = null;

  /**
   * Unsubscribe function for pending action notifications.
   * @type {Function|null}
   */
  #unsubPending = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "montage-tracker-gm",
    classes: ["montage-app", "montage-tracker-gm"],
    window: {
      title: "MONTAGE.Tracker.GMTitle",
      icon: "fa-solid fa-mountain-sun",
      resizable: true,
    },
    position: {
      width: 650,
      height: 700,
    },
    actions: {
      activateTest: MontageTrackerGMApp.#onActivate,
      advanceRound: MontageTrackerGMApp.#onAdvanceRound,
      endTestEarly: MontageTrackerGMApp.#onEndEarly,
      editConfig: MontageTrackerGMApp.#onEditConfig,
      adjustSuccess: MontageTrackerGMApp.#onAdjustSuccess,
      adjustFailure: MontageTrackerGMApp.#onAdjustFailure,
      approveAction: MontageTrackerGMApp.#onApproveAction,
      rejectAction: MontageTrackerGMApp.#onRejectAction,
      resolveComplication: MontageTrackerGMApp.#onResolveComplication,
      enterRollResult: MontageTrackerGMApp.#onEnterRollResult,
      archiveTest: MontageTrackerGMApp.#onArchiveTest,
      newTest: MontageTrackerGMApp.#onNewTest,
    },
  };

  /** @override */
  static PARTS = {
    tracker: {
      template: `modules/${MODULE_ID}/templates/montage-tracker-gm.hbs`,
    },
  };

  /** @override */
  async _prepareContext(options) {
    const testData = loadActiveTest();
    if (!testData) {
      return { hasTest: false };
    }

    const currentRound = getCurrentRound(testData);
    const heroesWaiting = getHeroesWaiting(testData);
    const pendingActions = testData.pendingActions ?? [];

    // Enrich pending actions with hero names/images
    const enrichedPending = pendingActions.map((p) => {
      const hero = testData.heroes.find((h) => h.actorId === p.actorId);
      return {
        ...p,
        heroName: hero?.name ?? "Unknown",
        heroImg: hero?.img ?? "icons/svg/mystery-man.svg",
        typeLabel: game.i18n.localize(`MONTAGE.Action.${p.type.charAt(0).toUpperCase() + p.type.slice(1)}`),
      };
    });

    // Enrich current round actions
    const roundActions = (currentRound?.actions ?? []).map((a) => {
      const hero = testData.heroes.find((h) => h.actorId === a.actorId);
      return {
        ...a,
        heroName: hero?.name ?? "Unknown",
        heroImg: hero?.img ?? "icons/svg/mystery-man.svg",
        typeLabel: game.i18n.localize(`MONTAGE.Action.${a.type.charAt(0).toUpperCase() + a.type.slice(1)}`),
        outcomeLabel: a.outcome ? game.i18n.localize(`MONTAGE.Outcome.${a.outcome.charAt(0).toUpperCase() + a.outcome.slice(1)}`) : "",
        aidResultLabel: a.aidResult ? game.i18n.localize(`MONTAGE.Assist.${a.aidResult.charAt(0).toUpperCase() + a.aidResult.slice(1)}`) : "",
      };
    });

    // Active complications for current round
    const complications = testData.complications.map((c) => ({
      ...c,
      isActive: c.triggerRound <= testData.currentRound && !c.resolved,
    }));

    // Success/failure progress as percentages
    const successPct = testData.successLimit > 0
      ? Math.min(100, Math.round((testData.currentSuccesses / testData.successLimit) * 100))
      : 0;
    const failurePct = testData.failureLimit > 0
      ? Math.min(100, Math.round((testData.currentFailures / testData.failureLimit) * 100))
      : 0;

    return {
      hasTest: true,
      test: testData,
      isSetup: testData.status === TEST_STATUS.SETUP,
      isActive: testData.status === TEST_STATUS.ACTIVE,
      isResolved: testData.status === TEST_STATUS.RESOLVED,
      currentRound,
      roundActions,
      heroesWaiting: heroesWaiting.map((h) => ({
        ...h,
        heroImg: h.img ?? "icons/svg/mystery-man.svg",
      })),
      pendingActions: enrichedPending,
      hasPending: enrichedPending.length > 0,
      complications,
      hasComplications: complications.length > 0,
      successPct,
      failurePct,
      outcomeLabel: testData.outcome
        ? game.i18n.localize(`MONTAGE.Outcome.${testData.outcome.charAt(0).toUpperCase() + testData.outcome.slice(1)}`)
        : "",
      difficultyLabel: game.i18n.localize(`MONTAGE.Difficulty.${testData.difficulty.charAt(0).toUpperCase() + testData.difficulty.slice(1)}`),
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Subscribe to state updates
    if (!this.#unsubState) {
      this.#unsubState = onStateUpdate(() => this.render());
    }
    if (!this.#unsubPending) {
      this.#unsubPending = onPendingAction(() => this.render());
    }
  }

  /** @override */
  _onClose(options) {
    if (this.#unsubState) {
      this.#unsubState();
      this.#unsubState = null;
    }
    if (this.#unsubPending) {
      this.#unsubPending();
      this.#unsubPending = null;
    }
    super._onClose(options);
  }

  // --- Actions ---

  static async #onActivate() {
    await activateTest();
  }

  static async #onAdvanceRound() {
    const confirm = await Dialog.confirm({
      title: game.i18n.localize("MONTAGE.Confirm.AdvanceRound"),
      content: `<p>${game.i18n.localize("MONTAGE.Confirm.AdvanceRoundMsg")}</p>`,
    });
    if (confirm) await advanceRound();
  }

  static async #onEndEarly() {
    const confirm = await Dialog.confirm({
      title: game.i18n.localize("MONTAGE.Confirm.EndTest"),
      content: `<p>${game.i18n.localize("MONTAGE.Confirm.EndTestMsg")}</p>`,
    });
    if (confirm) await endTestEarly();
  }

  static async #onEditConfig() {
    const { MontageConfigApp } = await import("./montage-config.mjs");
    new MontageConfigApp().render(true);
  }

  static async #onAdjustSuccess(event, target) {
    const delta = parseInt(target.dataset.delta);
    const testData = loadActiveTest();
    if (!testData) return;
    await adjustTally({ successes: testData.currentSuccesses + delta });
  }

  static async #onAdjustFailure(event, target) {
    const delta = parseInt(target.dataset.delta);
    const testData = loadActiveTest();
    if (!testData) return;
    await adjustTally({ failures: testData.currentFailures + delta });
  }

  static async #onApproveAction(event, target) {
    const actorId = target.dataset.actorId;
    const { ActionApprovalApp } = await import("./action-approval.mjs");
    new ActionApprovalApp({ actorId }).render(true);
  }

  static async #onRejectAction(event, target) {
    const actorId = target.dataset.actorId;
    await rejectAction(actorId, "Action not appropriate for this montage test.");
    ui.notifications.info(game.i18n.localize("MONTAGE.Notify.ActionRejected"));
  }

  static async #onResolveComplication(event, target) {
    const compId = target.dataset.complicationId;
    const testData = loadActiveTest();
    if (!testData) return;
    const comp = testData.complications.find((c) => c.id === compId);
    if (comp) {
      comp.resolved = true;
      await saveActiveTest(testData);
      this.render();
    }
  }

  static async #onEnterRollResult(event, target) {
    const actorId = target.dataset.actorId;
    const testData = loadActiveTest();
    if (!testData) return;

    const hero = testData.heroes.find((h) => h.actorId === actorId);
    const heroName = hero?.name ?? "Unknown";

    // Prompt GM for the roll result
    const content = `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize("MONTAGE.Roll.Total")}</label>
          <input type="number" name="rollTotal" value="" placeholder="e.g. 15" autofocus />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("MONTAGE.Roll.Natural")}</label>
          <input type="number" name="naturalRoll" value="" placeholder="e.g. 12 (2d10 result)" />
        </div>
      </form>`;

    const result = await Dialog.prompt({
      title: game.i18n.format("MONTAGE.Roll.EnterFor", { name: heroName }),
      content,
      label: game.i18n.localize("MONTAGE.Roll.Submit"),
      callback: (html) => {
        const form = html.querySelector ? html : html[0];
        return {
          rollTotal: parseInt(form.querySelector('[name="rollTotal"]').value) || 0,
          naturalRoll: parseInt(form.querySelector('[name="naturalRoll"]').value) || 0,
        };
      },
    });

    if (result) {
      const { handleRollResult } = await import("../socket.mjs");
      await handleRollResult({
        actorId,
        rollTotal: result.rollTotal,
        naturalRoll: result.naturalRoll,
      });
    }
  }

  static async #onArchiveTest() {
    const { archiveTest, clearActiveTest } = await import("../data/montage-test.mjs");
    const testData = loadActiveTest();
    if (testData) {
      await archiveTest(testData);
      await clearActiveTest();
      ui.notifications.info(game.i18n.localize("MONTAGE.Notify.TestArchived"));
      this.render();
    }
  }

  static async #onNewTest() {
    const { clearActiveTest } = await import("../data/montage-test.mjs");
    await clearActiveTest();
    const { MontageConfigApp } = await import("./montage-config.mjs");
    new MontageConfigApp().render(true);
    this.close();
  }
}

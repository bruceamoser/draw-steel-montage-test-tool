import { MODULE_ID, TEST_DIFFICULTY, ACTION_TYPE } from "../config.mjs";
import { approveAction as socketApproveAction } from "../socket.mjs";
import { loadActiveTest } from "../data/montage-test.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM approval dialog — shown when a player submits an action for GM review.
 * The GM sets the individual test difficulty, adds notes, and approves or rejects.
 */
export class ActionApprovalApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {object} options
   * @param {string} options.actorId - The actor ID for the pending action
   */
  constructor(options = {}) {
    super(options);
    this.#actorId = options.actorId;
  }

  /** @type {string} */
  #actorId;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "montage-action-approval",
    classes: ["montage-app", "montage-action-approval"],
    window: {
      title: "MONTAGE.Approval.Title",
      icon: "fa-solid fa-gavel",
      resizable: false,
    },
    position: {
      width: 450,
      height: "auto",
    },
    form: {
      handler: ActionApprovalApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    actions: {
      reject: ActionApprovalApp.#onReject,
    },
  };

  /** @override */
  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/action-approval.hbs`,
    },
  };

  /** @override */
  async _prepareContext(options) {
    const testData = loadActiveTest();
    if (!testData) return { hasData: false };

    const pending = (testData.pendingActions ?? []).find(
      (p) => p.actorId === this.#actorId,
    );
    if (!pending) return { hasData: false };

    const hero = testData.heroes.find((h) => h.actorId === this.#actorId);

    // Build aid target info if applicable
    let aidTargetName = null;
    if (pending.type === ACTION_TYPE.AID && pending.aidTarget) {
      const aidHero = testData.heroes.find((h) => h.actorId === pending.aidTarget);
      aidTargetName = aidHero?.name ?? "Unknown";
    }

    const isRoll = pending.type === ACTION_TYPE.ROLL;
    const isAid = pending.type === ACTION_TYPE.AID;
    const isAbility = pending.type === ACTION_TYPE.ABILITY;
    const isNothing = pending.type === ACTION_TYPE.NOTHING;

    // Difficulties for the dropdown
    const difficulties = Object.entries(TEST_DIFFICULTY).map(([key, value]) => ({
      value,
      label: game.i18n.localize(`MONTAGE.TestDifficulty.${key.charAt(0).toUpperCase() + key.slice(1)}`),
      selected: value === "medium",
    }));

    return {
      hasData: true,
      actorId: this.#actorId,
      heroName: hero?.name ?? "Unknown",
      heroImg: hero?.img ?? "icons/svg/mystery-man.svg",
      actionType: pending.type,
      actionTypeLabel: game.i18n.localize(
        `MONTAGE.Action.${pending.type.charAt(0).toUpperCase() + pending.type.slice(1)}`,
      ),
      description: pending.description ?? "",
      aidTargetName,
      isRoll,
      isAid,
      isAbility,
      isNothing,
      needsDifficulty: isRoll || isAid,
      needsAutoSuccesses: isAbility,
      difficulties,
    };
  }

  /**
   * Handle form submission (approval).
   * @param {Event} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    const actorId = data.actorId;
    const approvalData = {
      difficulty: data.difficulty ?? null,
      autoSuccesses: parseInt(data.autoSuccesses) || 0,
      gmNotes: data.gmNotes ?? "",
    };

    await socketApproveAction(actorId, approvalData);
    ui.notifications.info(
      game.i18n.format("MONTAGE.Notify.ActionApproved", {
        name: data.heroName ?? "Hero",
      }),
    );
  }

  /**
   * Handle rejection.
   */
  static async #onReject(event, target) {
    const actorId = this.#actorId;
    const { rejectAction } = await import("../socket.mjs");
    await rejectAction(actorId, "The Director has rejected this action.");
    ui.notifications.info(game.i18n.localize("MONTAGE.Notify.ActionRejected"));
    this.close();
  }
}

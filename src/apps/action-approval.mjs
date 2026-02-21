import { MODULE_ID, TEST_DIFFICULTY, ACTION_TYPE, CHARACTERISTIC_LABELS, getSkillLabel } from "../config.mjs";
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
    actions: {
      approve: ActionApprovalApp.#onApprove,
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

    // Build characteristic/skill labels if present
    let characteristicLabel = null;
    let characteristicDisplay = null;
    if (pending.characteristic) {
      const actor = game.actors.get(this.#actorId);
      const chrName = CHARACTERISTIC_LABELS[pending.characteristic] ?? pending.characteristic;
      const chrValue = actor?.system?.characteristics?.[pending.characteristic]?.value ?? 0;
      characteristicLabel = chrName;
      characteristicDisplay = `${chrName} (${chrValue >= 0 ? "+" : ""}${chrValue})`;
    }
    let skillLabel = null;
    if (pending.skill) {
      skillLabel = getSkillLabel(pending.skill);
    }

    // Ability name if present
    const abilityName = pending.abilityName ?? null;

    const isRoll = pending.type === ACTION_TYPE.ROLL;
    const isAid = pending.type === ACTION_TYPE.AID;
    const isAbility = pending.type === ACTION_TYPE.ABILITY;
    const isNothing = pending.type === ACTION_TYPE.NOTHING;

    // Difficulties for the dropdown
    const difficulties = Object.entries(TEST_DIFFICULTY).map(([, value]) => ({
      value,
      label: game.i18n.localize(`MONTAGE.TestDifficulty.${value.charAt(0).toUpperCase() + value.slice(1)}`),
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
      characteristicDisplay,
      skillLabel,
      hasCharacteristic: !!characteristicDisplay,
      hasSkill: !!skillLabel,
      isRoll,
      isAid,
      isAbility,
      isNothing,
      needsDifficulty: isRoll || isAid,
      abilityName,
      hasAbilityName: !!abilityName,
      needsAutoSuccesses: isAbility,
      difficulties,
    };
  }

  /**
   * Handle approval button click.
   */
  static async #onApprove(event, target) {
    const container = this.element.querySelector('.montage-approval');
    const actorId = container.querySelector('[name="actorId"]')?.value;
    const heroName = container.querySelector('[name="heroName"]')?.value ?? "Hero";
    const difficulty = container.querySelector('[name="difficulty"]')?.value ?? null;
    const autoSuccesses = parseInt(container.querySelector('[name="autoSuccesses"]')?.value) || 0;
    const gmNotes = container.querySelector('[name="gmNotes"]')?.value ?? "";

    const approvalData = { difficulty, autoSuccesses, gmNotes };

    await socketApproveAction(actorId, approvalData);
    ui.notifications.info(
      game.i18n.format("MONTAGE.Notify.ActionApproved", { name: heroName }),
    );
    this.close();
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

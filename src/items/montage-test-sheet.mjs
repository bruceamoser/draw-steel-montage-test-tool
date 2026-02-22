/**
 * Montage Test Item Sheet
 */

import { MODULE_ID, MONTAGE_DIFFICULTY, DIFFICULTY_TABLE_BASE, BASE_HERO_COUNT, MIN_LIMIT, SOCKET_NAME, SOCKET_EVENTS } from "../config.mjs";
import {
  MONTAGE_TEST_ITEM_TYPE,
  MONTAGE_TEST_OUTCOME,
  tallyParticipants,
  computeOutcome,
} from "./montage-test-model.mjs";

const ItemSheetV1 = foundry.appv1?.sheets?.ItemSheet ?? ItemSheet;

/**
 * Minimal ItemSheet implementation for Foundry v13.
 * Uses a Handlebars template and simple action handlers for array editing.
 */
export class MontageTestSheet extends ItemSheetV1 {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["montage-app", "montage-test-sheet"],
      width: 720,
      height: 720,
      tabs: [{ navSelector: ".tabs", contentSelector: ".tab-content", initial: "basic" }],
    });
  }

  /** @override */
  get template() {
    return `modules/${MODULE_ID}/templates/items/montage-test-sheet.hbs`;
  }

  /** @override */
  async getData(options = {}) {
    const data = super.getData(options);

    const system = this.item.system;
    const participants = system.participants ?? [];

    const { successes, failures } = tallyParticipants(participants);

    const allMarksEntered = participants.length > 0 && participants.every((p) => {
      const r1 = p.round1;
      const r2 = p.round2;
      return !!r1 && !!r2;
    });

    const outcomeKey = computeOutcome({
      successes,
      failures,
      successLimit: system.successLimit,
      failureLimit: system.failureLimit,
      allMarksEntered,
    });

    const outcomeLabelKey = outcomeKey
      ? `MONTAGE.Outcome.${outcomeKey.charAt(0).toUpperCase() + outcomeKey.slice(1)}`
      : null;

    // Enrich rich-text fields for ProseMirror display
    const TE = foundry.applications?.ux?.TextEditor ?? TextEditor;
    const enrichOpts = { relativeTo: this.item };
    const descriptionEnriched = await TE.enrichHTML(system.description ?? "", enrichOpts);
    const outcomesEnriched = {
      totalSuccess: await TE.enrichHTML(system.outcomes?.totalSuccess ?? "", enrichOpts),
      partialSuccess: await TE.enrichHTML(system.outcomes?.partialSuccess ?? "", enrichOpts),
      totalFailure: await TE.enrichHTML(system.outcomes?.totalFailure ?? "", enrichOpts),
    };
    const round1Raw = system.complications?.round1 ?? [];
    const round2Raw = system.complications?.round2 ?? [];
    const round1Enriched = await Promise.all(round1Raw.map((t) => TE.enrichHTML(t ?? "", enrichOpts)));
    const round2Enriched = await Promise.all(round2Raw.map((t) => TE.enrichHTML(t ?? "", enrichOpts)));

    return {
      ...data,
      isGM: game.user.isGM,
      itemType: this.item.type,
      isMontageTest: this.item.type === MONTAGE_TEST_ITEM_TYPE,
      difficulties: Object.entries(MONTAGE_DIFFICULTY).map(([key, value]) => ({
        value,
        label: game.i18n.localize(`MONTAGE.Difficulty.${key.charAt(0) + key.slice(1).toLowerCase()}`),
        selected: value === system.difficulty,
      })),
      descriptionEnriched,
      outcomesEnriched,
      complications: {
        round1: round1Raw.map((text, index) => ({
          index,
          text,
          textEnriched: round1Enriched[index],
          targetName: `system.complications.round1.${index}`,
        })),
        round2: round2Raw.map((text, index) => ({
          index,
          text,
          textEnriched: round2Enriched[index],
          targetName: `system.complications.round2.${index}`,
        })),
      },
      participants: participants.map((p, index) => ({
        index,
        actorUuid: p.actorUuid,
        name: p.name,
        img: p.img || "icons/svg/mystery-man.svg",
        round1: p.round1 || "",
        round2: p.round2 || "",
      })),
      tally: {
        successes,
        failures,
        allMarksEntered,
        outcomeKey,
        outcomeLabel: outcomeLabelKey ? game.i18n.localize(outcomeLabelKey) : "",
        outcomeKeyMap: MONTAGE_TEST_OUTCOME,
      },
      resultChoices: [
        { value: "", label: game.i18n.localize("MONTAGE.TestResult.Unset") },
        { value: "success", label: game.i18n.localize("MONTAGE.TestResult.Success") },
        { value: "fail", label: game.i18n.localize("MONTAGE.TestResult.Fail") },
        { value: "neither", label: game.i18n.localize("MONTAGE.TestResult.Neither") },
      ],
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Only GM can mutate structure
    html.find("[data-action]").on("click", (event) => this.#onAction(event));

    // Auto-recalculate limits when difficulty changes
    html.find("[name='system.difficulty']").on("change", (event) => {
      this.#recalcLimits(event.currentTarget.value);
    });

    // Drag-drop actors into participants list
    const dropzone = html[0].querySelector(".montage-participants-drop");
    if (dropzone) {
      dropzone.addEventListener("drop", (event) => this.#onDropActor(event));
      dropzone.addEventListener("dragover", (event) => event.preventDefault());
    }
  }

  async #onAction(event) {
    event.preventDefault();
    const action = event.currentTarget?.dataset?.action;
    if (!action) return;

    if (!game.user.isGM) return;

    switch (action) {
      case "addComplication":
        return this.#addComplication(event.currentTarget.dataset.round);

      case "removeComplication":
        return this.#removeComplication(event.currentTarget.dataset.round, Number(event.currentTarget.dataset.index));

      case "addParticipant":
        return this.#addParticipant();

      case "removeParticipant":
        return this.#removeParticipant(Number(event.currentTarget.dataset.index));

      case "openForPlayers":
        return this.#openForPlayers();

      default:
        return;
    }
  }

  /**
   * Recalculate successLimit and failureLimit based on current difficulty
   * and participant count, using the Draw Steel difficulty table.
   * @param {string} [difficultyOverride]  Use this difficulty value instead of the saved one
   *                                       (needed when called from a change event before the
   *                                       form has been saved).
   */
  async #recalcLimits(difficultyOverride) {
    const system = this.item.system;
    const difficulty = difficultyOverride ?? system.difficulty ?? "moderate";
    const heroCount = (system.participants ?? []).length;
    const base = DIFFICULTY_TABLE_BASE[difficulty] ?? DIFFICULTY_TABLE_BASE.moderate;
    const delta = heroCount - BASE_HERO_COUNT;
    const successLimit = Math.max(MIN_LIMIT, base.successLimit + delta);
    const failureLimit = Math.max(MIN_LIMIT, base.failureLimit + delta);
    await this.item.update({
      "system.difficulty": difficulty,
      "system.successLimit": successLimit,
      "system.failureLimit": failureLimit,
    });
  }

  async #addComplication(round) {
    const r = round === "2" ? "round2" : "round1";
    const list = Array.from(this.item.system.complications?.[r] ?? []);
    list.push("");
    await this.item.update({ [`system.complications.${r}`]: list });
  }

  async #removeComplication(round, index) {
    const r = round === "2" ? "round2" : "round1";
    const list = Array.from(this.item.system.complications?.[r] ?? []);
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    await this.item.update({ [`system.complications.${r}`]: list });
  }

  async #addParticipant(partial = {}) {
    const participants = Array.from(this.item.system.participants ?? []);
    participants.push({
      actorUuid: partial.actorUuid ?? "",
      name: partial.name ?? "",
      img: partial.img ?? "",
      round1: "",
      round2: "",
    });
    await this.item.update({ "system.participants": participants });
    await this.#recalcLimits();

    // Auto-grant OBSERVER permission on this item to all non-GM users
    const newOwnership = {};
    for (const user of game.users.filter((u) => !u.isGM)) {
      if ((this.item.ownership[user.id] ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE) < CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) {
        newOwnership[user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
      }
    }
    if (Object.keys(newOwnership).length) {
      await this.item.update({ ownership: { ...this.item.ownership, ...newOwnership } });
    }
  }

  async #removeParticipant(index) {
    const participants = Array.from(this.item.system.participants ?? []);
    if (index < 0 || index >= participants.length) return;
    participants.splice(index, 1);
    await this.item.update({ "system.participants": participants });
    await this.#recalcLimits();
  }

  /**
   * Emit a socket event that instructs all connected players to open this item's sheet.
   */
  async #openForPlayers() {
    game.socket.emit(SOCKET_NAME, {
      event: SOCKET_EVENTS.OPEN_ITEM_SHEET,
      data: { itemId: this.item.id },
    });
    ui.notifications.info(game.i18n.localize("MONTAGE.Sheet.PushedToPlayers"));
  }

  async #onDropActor(event) {
    if (!game.user.isGM) return;

    event.preventDefault();

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }

    if (data?.type !== "Actor") return;

    const actor = await fromUuid(data.uuid);
    if (!actor) return;

    const already = (this.item.system.participants ?? []).some((p) => p.actorUuid === actor.uuid);
    if (already) return;

    await this.#addParticipant({
      actorUuid: actor.uuid,
      name: actor.name,
      img: actor.img ?? "",
    });
  }
}

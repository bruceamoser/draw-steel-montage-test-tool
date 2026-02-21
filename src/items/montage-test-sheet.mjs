/**
 * Montage Test Item Sheet
 */

import { MODULE_ID, MONTAGE_DIFFICULTY } from "../config.mjs";
import {
  MONTAGE_TEST_ITEM_TYPE,
  MONTAGE_TEST_OUTCOME,
  tallyParticipants,
  computeOutcome,
} from "./montage-test-model.mjs";

/**
 * Minimal ItemSheet implementation for Foundry v13.
 * Uses a Handlebars template and simple action handlers for array editing.
 */
export class MontageTestSheet extends ItemSheet {

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
  getData(options = {}) {
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
      complications: {
        round1: (system.complications?.round1 ?? []).map((text, index) => ({ index, text })),
        round2: (system.complications?.round2 ?? []).map((text, index) => ({ index, text })),
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

      default:
        return;
    }
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
  }

  async #removeParticipant(index) {
    const participants = Array.from(this.item.system.participants ?? []);
    if (index < 0 || index >= participants.length) return;
    participants.splice(index, 1);
    await this.item.update({ "system.participants": participants });
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

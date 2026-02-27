/**
 * Montage Test Item Sheet — ApplicationV2 (Foundry v13+)
 */

import { MODULE_ID, MONTAGE_DIFFICULTY, DIFFICULTY_TABLE_BASE, BASE_HERO_COUNT, MIN_LIMIT } from "../config.mjs";
import {
  MONTAGE_TEST_ITEM_TYPE,
  MONTAGE_TEST_OUTCOME,
  tallyParticipants,
  computeOutcome,
} from "./montage-test-model.mjs";

const _TextEditor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;

/**
 * ApplicationV2 ItemSheet for Montage Tests.
 * Uses HandlebarsApplicationMixin + ItemSheetV2, matching the Foundry v13+ pattern.
 */
export class MontageTestSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
) {

  // ── ApplicationV2 static config ────────────────────────────────────────────

  static DEFAULT_OPTIONS = {
    classes: ["montage-app", "montage-test-sheet"],
    window: { width: 720, height: 720, resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addParticipant: MontageTestSheet.#onAddParticipant,
      removeParticipant: MontageTestSheet.#onRemoveParticipant,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/items/montage-test-sheet.hbs`,
      scrollable: [".mts-tab-body"],
    },
  };

  // ── Instance state ─────────────────────────────────────────────────────────

  /** Currently active primary tab */
  _activeTab = "basic";

  // ── Context preparation ────────────────────────────────────────────────────

  /** @override */
  async _prepareContext(options) {
    const isGM = game.user.isGM;
    const doc = this.document;
    const system = doc.system;
    const participants = system.participants ?? [];

    const { successes, failures } = tallyParticipants(participants);

    const allMarksEntered = participants.length > 0 && participants.every((p) => {
      return !!p.round1 && !!p.round2;
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

    // Enrich rich-text fields for display (read-only mode for players)
    const enrichOpts = { relativeTo: doc, async: true };
    const descriptionEnriched = await _TextEditor.enrichHTML(system.description ?? "", enrichOpts);
    const outcomesEnriched = {
      round1: await _TextEditor.enrichHTML(system.outcomes?.round1 ?? "", enrichOpts),
      round2: await _TextEditor.enrichHTML(system.outcomes?.round2 ?? "", enrichOpts),
    };
    const complicationsEnriched = {
      round1: await _TextEditor.enrichHTML(system.complications?.round1 ?? "", enrichOpts),
      round2: await _TextEditor.enrichHTML(system.complications?.round2 ?? "", enrichOpts),
    };

    return {
      item: doc,
      isGM,
      isOwner: doc.isOwner,
      activeTab: this._activeTab,
      itemType: doc.type,
      isMontageTest: doc.type === MONTAGE_TEST_ITEM_TYPE,
      difficulties: Object.entries(MONTAGE_DIFFICULTY).map(([key, value]) => ({
        value,
        label: game.i18n.localize(`MONTAGE.Difficulty.${key.charAt(0) + key.slice(1).toLowerCase()}`),
        selected: value === system.difficulty,
      })),
      descriptionEnriched,
      outcomesEnriched,
      complicationsEnriched,
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

  // ── Rendering / listeners ──────────────────────────────────────────────────

  /** @override */
  _onRender(context, options) {
    const root = this.element;

    // Apply tab visibility BEFORE super — ProseMirror requires the host element
    // to be in the visible DOM when it initialises.
    this.#applyTabState(root);

    super._onRender(context, options);

    // Mount ProseMirror editors only on the currently visible tab.
    // Mounting on hidden (display:none) tabs can cause ProseMirror to hang
    // during measurement, which freezes the entire sheet.
    if (game.user.isGM) {
      this.#mountProseMirrorEditors(root);
    }

    // Tab click handlers — re-mount editors when switching to a tab with editors
    for (const link of root.querySelectorAll(".mts-tabs .item[data-tab]")) {
      link.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._activeTab = ev.currentTarget.dataset.tab;
        this.#applyTabState(root);
        if (game.user.isGM) this.#mountProseMirrorEditors(root);
      });
    }

    // Auto-recalculate limits when difficulty changes
    const difficultySelect = root.querySelector("[name='system.difficulty']");
    if (difficultySelect) {
      difficultySelect.addEventListener("change", (ev) => {
        this.#recalcLimits(ev.currentTarget.value);
      });
    }

    // Drag-drop actors into participants list
    const dropzone = root.querySelector(".montage-participants-drop");
    if (dropzone) {
      dropzone.addEventListener("drop", (ev) => this.#onDropActor(ev));
      dropzone.addEventListener("dragover", (ev) => ev.preventDefault());
    }
  }

  #applyTabState(root) {
    for (const link of root.querySelectorAll(".mts-tabs .item[data-tab]")) {
      link.classList.toggle("active", link.dataset.tab === this._activeTab);
    }
    for (const pane of root.querySelectorAll(".mts-tab-body .tab[data-tab]")) {
      pane.classList.toggle("active", pane.dataset.tab === this._activeTab);
    }
  }

  /**
   * Mount ProseMirror editors only inside the currently active tab pane.
   * Skips wrappers that already have a mounted <prose-mirror> element.
   * @param {HTMLElement} root
   */
  #mountProseMirrorEditors(root) {
    const ProseMirrorEl = foundry.applications.elements?.HTMLProseMirrorElement;
    if (!ProseMirrorEl) return;

    const activePane = root.querySelector(`.mts-tab-body .tab[data-tab="${this._activeTab}"]`);
    if (!activePane) return;

    for (const wrap of activePane.querySelectorAll(".mts-editor-wrap[data-field]")) {
      // Skip if already mounted
      if (wrap.querySelector("prose-mirror")) continue;

      const fieldName = wrap.dataset.field;
      const value = foundry.utils.getProperty(this.document, fieldName) ?? "";
      const el = ProseMirrorEl.create({ value, editable: true });
      wrap.appendChild(el);
      // Save on ProseMirror blur/save event → direct document update.
      el.addEventListener("save", async () => {
        await this.document.update({ [fieldName]: el.value });
      });
    }
  }

  // ── Form submit override ──────────────────────────────────────────────────

  /** @override */
  async _processSubmitData(event, form, formData) {
    if (!formData || typeof formData !== "object") return;
    // formData may be FormDataExtended (has .object getter) or an expanded plain
    // object returned by _prepareSubmitData.  Flatten to dot-notation paths so
    // Document.update() handles ArrayField indexing reliably.
    const raw = (typeof formData?.object === "object") ? formData.object : formData;
    const flat = foundry.utils.flattenObject(raw);
    if (Object.keys(flat).length) await this.document.update(flat);
  }

  // ── Action handlers (static, called via ApplicationV2 actions map) ────────

  static async #onAddParticipant() {
    await this.#addParticipant();
  }

  static async #onRemoveParticipant(event, target) {
    const index = Number(target.dataset.index);
    await this.#removeParticipant(index);
  }

  // ── Participant helpers ────────────────────────────────────────────────────

  /**
   * Recalculate successLimit and failureLimit based on current difficulty
   * and participant count, using the Draw Steel difficulty table.
   */
  async #recalcLimits(difficultyOverride) {
    const system = this.document.system;
    const difficulty = difficultyOverride ?? system.difficulty ?? "moderate";
    const heroCount = (system.participants ?? []).length;
    const base = DIFFICULTY_TABLE_BASE[difficulty] ?? DIFFICULTY_TABLE_BASE.moderate;
    const delta = heroCount - BASE_HERO_COUNT;
    const successLimit = Math.max(MIN_LIMIT, base.successLimit + delta);
    const failureLimit = Math.max(MIN_LIMIT, base.failureLimit + delta);
    await this.document.update({
      "system.difficulty": difficulty,
      "system.successLimit": successLimit,
      "system.failureLimit": failureLimit,
    });
  }

  async #addParticipant(partial = {}) {
    const participants = Array.from(this.document.system.participants ?? []);
    participants.push({
      actorUuid: partial.actorUuid ?? "",
      name: partial.name ?? "",
      img: partial.img ?? "",
      round1: "",
      round2: "",
    });

    // Compute new limits based on updated participant count
    const difficulty = this.document.system.difficulty ?? "moderate";
    const heroCount = participants.length;
    const base = DIFFICULTY_TABLE_BASE[difficulty] ?? DIFFICULTY_TABLE_BASE.moderate;
    const delta = heroCount - BASE_HERO_COUNT;
    const successLimit = Math.max(MIN_LIMIT, base.successLimit + delta);
    const failureLimit = Math.max(MIN_LIMIT, base.failureLimit + delta);

    // Auto-grant OBSERVER permission on this item to all non-GM users
    const ownershipUpdate = {};
    for (const user of game.users.filter((u) => !u.isGM)) {
      if ((this.document.ownership[user.id] ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE) < CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) {
        ownershipUpdate[user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
      }
    }

    // Single consolidated update — avoids multiple re-renders that break ProseMirror
    const updateData = {
      "system.participants": participants,
      "system.difficulty": difficulty,
      "system.successLimit": successLimit,
      "system.failureLimit": failureLimit,
    };
    if (Object.keys(ownershipUpdate).length) {
      updateData.ownership = { ...this.document.ownership, ...ownershipUpdate };
    }
    await this.document.update(updateData);
  }

  async #removeParticipant(index) {
    const participants = Array.from(this.document.system.participants ?? []);
    if (index < 0 || index >= participants.length) return;
    participants.splice(index, 1);

    // Recalc limits inline and combine into single update
    const difficulty = this.document.system.difficulty ?? "moderate";
    const heroCount = participants.length;
    const base = DIFFICULTY_TABLE_BASE[difficulty] ?? DIFFICULTY_TABLE_BASE.moderate;
    const delta = heroCount - BASE_HERO_COUNT;
    const successLimit = Math.max(MIN_LIMIT, base.successLimit + delta);
    const failureLimit = Math.max(MIN_LIMIT, base.failureLimit + delta);

    await this.document.update({
      "system.participants": participants,
      "system.difficulty": difficulty,
      "system.successLimit": successLimit,
      "system.failureLimit": failureLimit,
    });
  }

  async #onDropActor(event) {
    if (!game.user.isGM) return;

    event.preventDefault();

    const data = _TextEditor.getDragEventData?.(event)
      ?? (() => { try { return JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return null; } })();

    if (!data || data.type !== "Actor") return;

    const actor = await fromUuid(data.uuid);
    if (!actor) return;

    const already = (this.document.system.participants ?? []).some((p) => p.actorUuid === actor.uuid);
    if (already) return;

    await this.#addParticipant({
      actorUuid: actor.uuid,
      name: actor.name,
      img: actor.img ?? "",
    });
  }
}

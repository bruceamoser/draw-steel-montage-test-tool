import { MODULE_ID, MONTAGE_DIFFICULTY, TEST_STATUS, SOCKET_NAME, SOCKET_EVENTS } from "../config.mjs";
import { MONTAGE_TEST_ITEM_TYPE } from "../items/montage-test-model.mjs";
import { calculateLimits } from "../helpers/difficulty.mjs";
import {
  createMontageTestData,
  createComplication,
  saveActiveTest,
  loadActiveTest,
  clearActiveTest,
  getAvailableHeroes,
  loadDraftTests,
  saveDraftTest,
  updateDraftTest,
  deleteDraftTest,
  getDraftTest,
} from "../data/montage-test.mjs";
import { activateTest } from "../socket.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM application for creating and configuring Montage Tests.
 *
 * Three-phase workflow:
 *   Phase 0 — Choose: list saved montages or create a new one.
 *   Phase 1 — Create: name, hero selection (all selected by default), difficulty.
 *   Phase 2 — Setup: add complications per round, GM outcome notes, activate.
 */
export class MontageConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "montage-config",
    classes: ["montage-app", "montage-config"],
    window: {
      title: "MONTAGE.Controls.OpenMontage",
      icon: "fa-solid fa-mountain-sun",
      resizable: true,
    },
    position: {
      width: 560,
      height: "auto",
    },
    actions: {
      newTest: MontageConfigApp.#onNewTest,
      selectTest: MontageConfigApp.#onSelectTest,
      deleteTest: MontageConfigApp.#onDeleteTest,
      createTest: MontageConfigApp.#onCreateTest,
      backToList: MontageConfigApp.#onBackToList,
      activateTest: MontageConfigApp.#onActivateTest,
      addComplication: MontageConfigApp.#onAddComplication,
      removeComplication: MontageConfigApp.#onRemoveComplication,
      saveSetup: MontageConfigApp.#onSaveSetup,
    },
  };

  /** @override */
  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/montage-config.hbs`,
    },
  };

  /* ----- Navigation state ----- */

  _currentPhase = 0;
  _editingTestId = null;

  /* ----- Phase 1 working state ----- */

  _phase1Data = {
    name: "",
    difficulty: MONTAGE_DIFFICULTY.MODERATE,
    selectedHeroIds: null, // null = uninitialised → default to all
    customSuccessLimit: null,
    customFailureLimit: null,
  };

  _phase1Initialized = false;

  /* ----- Phase 2 working state ----- */

  _phase2Data = {
    complications: [],
    gmNotes: { totalSuccess: "", partialSuccess: "", totalFailure: "" },
  };

  _phase2Initialized = false;

  /* ================================================ */
  /*  Context                                         */
  /* ================================================ */

  /** @override */
  async _prepareContext(options) {
    switch (this._currentPhase) {
      case 1: return this.#preparePhase1();
      case 2: return this.#preparePhase2();
      default: return this.#preparePhase0();
    }
  }

  /**
   * Phase 0 context — choose an existing montage or create a new one.
   * Also migrates any orphaned SETUP test from ACTIVE_TEST to drafts.
   */
  async #preparePhase0() {
    // Migrate orphaned SETUP test if present
    const activeTest = loadActiveTest();
    if (activeTest && activeTest.status === TEST_STATUS.SETUP) {
      await saveDraftTest(activeTest);
      await clearActiveTest();
    }

    const drafts = loadDraftTests();
    const currentActive = loadActiveTest();

    return {
      phase: 0,
      savedTests: drafts.map((t) => {
        const diffKey = t.difficulty.charAt(0).toUpperCase() + t.difficulty.slice(1);
        return {
          id: t.id,
          name: t.name,
          difficulty: t.difficulty,
          difficultyLabel: game.i18n.localize(`MONTAGE.Difficulty.${diffKey}`),
          heroCount: t.heroes?.length ?? t.heroCount ?? 0,
          complicationCount: t.complications?.length ?? 0,
        };
      }),
      hasActiveTest: !!currentActive && currentActive.status === TEST_STATUS.ACTIVE,
      activeTestName: currentActive?.name,
    };
  }

  /**
   * Phase 1 context — creating a new montage test.
   */
  #preparePhase1() {
    const availableHeroes = getAvailableHeroes();

    if (!this._phase1Initialized) {
      this._phase1Data.selectedHeroIds = new Set(availableHeroes.map((h) => h.actorId));
      this._phase1Data.name = "";
      this._phase1Data.difficulty = MONTAGE_DIFFICULTY.MODERATE;
      this._phase1Data.customSuccessLimit = null;
      this._phase1Data.customFailureLimit = null;
      this._phase1Initialized = true;
    }

    const heroCount = this._phase1Data.selectedHeroIds.size;
    const limits = calculateLimits(this._phase1Data.difficulty, heroCount || 1);

    return {
      phase: 1,
      formData: this._phase1Data,
      availableHeroes: availableHeroes.map((h) => ({
        ...h,
        selected: this._phase1Data.selectedHeroIds.has(h.actorId),
      })),
      difficulties: Object.entries(MONTAGE_DIFFICULTY).map(([key, value]) => ({
        value,
        label: game.i18n.localize(`MONTAGE.Difficulty.${key.charAt(0) + key.slice(1).toLowerCase()}`),
        selected: value === this._phase1Data.difficulty,
      })),
      heroCount,
      successLimit: this._phase1Data.customSuccessLimit ?? limits.successLimit,
      failureLimit: this._phase1Data.customFailureLimit ?? limits.failureLimit,
    };
  }

  /**
   * Phase 2 context — configuring complications & GM notes before activation.
   */
  #preparePhase2() {
    const testData = getDraftTest(this._editingTestId);
    if (!testData) {
      // Draft was deleted or missing — fall back to Phase 0
      this._currentPhase = 0;
      return this.#preparePhase0();
    }

    if (!this._phase2Initialized) {
      let savedComplications = (testData.complications ?? []).map((c) => ({ ...c }));

      // If no complications exist yet on the testData, try to seed from a montage test item
      // matching the test name, or the first available montage test item in the world.
      if (savedComplications.length === 0) {
        const item = game.items?.find(i => i.type === MONTAGE_TEST_ITEM_TYPE && i.name === testData.name)
          ?? game.items?.find(i => i.type === MONTAGE_TEST_ITEM_TYPE);
        if (item) {
          const r1 = (item.system.complications?.round1 ?? []).filter(Boolean);
          const r2 = (item.system.complications?.round2 ?? []).filter(Boolean);
          for (const desc of r1) savedComplications.push(createComplication({ description: desc, triggerRound: 1 }));
          for (const desc of r2) savedComplications.push(createComplication({ description: desc, triggerRound: 2 }));
        }
      }

      this._phase2Data.complications = savedComplications;
      this._phase2Data.gmNotes = {
        totalSuccess: testData.gmNotes?.totalSuccess ?? "",
        partialSuccess: testData.gmNotes?.partialSuccess ?? "",
        totalFailure: testData.gmNotes?.totalFailure ?? "",
      };
      this._phase2Initialized = true;
    } else if (this.element) {
      // Sync form inputs before re-render so text isn't lost
      this._syncPhase2FromForm();
    }

    const round1Complications = this._phase2Data.complications.filter((c) => c.triggerRound === 1);
    const round2Complications = this._phase2Data.complications.filter((c) => c.triggerRound === 2);

    return {
      phase: 2,
      test: testData,
      round1Complications,
      round2Complications,
      gmNotes: this._phase2Data.gmNotes,
      difficultyLabel: game.i18n.localize(
        `MONTAGE.Difficulty.${testData.difficulty.charAt(0).toUpperCase() + testData.difficulty.slice(1)}`,
      ),
    };
  }

  /* ================================================ */
  /*  Render hooks                                    */
  /* ================================================ */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    if (context.phase === 1) {
      // Difficulty change → recalculate and re-render
      const difficultySelect = this.element.querySelector('[name="difficulty"]');
      difficultySelect?.addEventListener("change", () => {
        this._phase1Data.difficulty = difficultySelect.value;
        this.render();
      });

      // Hero checkboxes → inline update limits (no full re-render)
      this.element.querySelectorAll('.hero-select input[type="checkbox"]').forEach((cb) => {
        cb.addEventListener("change", () => {
          if (cb.checked) this._phase1Data.selectedHeroIds.add(cb.value);
          else this._phase1Data.selectedHeroIds.delete(cb.value);
          this.#updateLimitsDisplay();
        });
      });

      // Sync name input on typing
      const nameInput = this.element.querySelector('[name="testName"]');
      nameInput?.addEventListener("input", () => {
        this._phase1Data.name = nameInput.value;
      });

      // Sync editable limit inputs
      const successInput = this.element.querySelector('input[name="successLimit"]');
      const failureInput = this.element.querySelector('input[name="failureLimit"]');
      successInput?.addEventListener("change", () => {
        const val = parseInt(successInput.value);
        this._phase1Data.customSuccessLimit = isNaN(val) || val < 1 ? null : val;
      });
      failureInput?.addEventListener("change", () => {
        const val = parseInt(failureInput.value);
        this._phase1Data.customFailureLimit = isNaN(val) || val < 1 ? null : val;
      });
    }
  }

  /* ================================================ */
  /*  Helpers                                         */
  /* ================================================ */

  /**
   * Update the limits display inline (no re-render needed).
   */
  #updateLimitsDisplay() {
    const heroCount = this._phase1Data.selectedHeroIds.size;
    const limits = calculateLimits(this._phase1Data.difficulty, heroCount || 1);

    const successEl = this.element.querySelector('input[data-limit="success"]');
    const failureEl = this.element.querySelector('input[data-limit="failure"]');
    const countEl = this.element.querySelector('[data-hero-count]');

    // Only update values if the GM hasn't manually overridden them
    if (successEl && this._phase1Data.customSuccessLimit === null) {
      successEl.value = limits.successLimit;
    }
    if (failureEl && this._phase1Data.customFailureLimit === null) {
      failureEl.value = limits.failureLimit;
    }
    if (countEl) countEl.textContent = heroCount;
  }

  /**
   * Read Phase 2 form inputs back into #phase2Data.
   */
  _syncPhase2FromForm() {
    if (!this.element) return;

    for (const comp of this._phase2Data.complications) {
      const descInput = this.element.querySelector(`[name="comp-desc-${comp.id}"]`);
      const failInput = this.element.querySelector(`[name="comp-fail-${comp.id}"]`);
      if (descInput) comp.description = descInput.value;
      if (failInput) comp.failureOutcome = failInput.value;
    }

    const tsInput = this.element.querySelector('[name="gmNotes-totalSuccess"]');
    const psInput = this.element.querySelector('[name="gmNotes-partialSuccess"]');
    const tfInput = this.element.querySelector('[name="gmNotes-totalFailure"]');
    if (tsInput) this._phase2Data.gmNotes.totalSuccess = tsInput.value;
    if (psInput) this._phase2Data.gmNotes.partialSuccess = psInput.value;
    if (tfInput) this._phase2Data.gmNotes.totalFailure = tfInput.value;
  }

  /* ================================================ */
  /*  Actions                                         */
  /* ================================================ */

  /** Phase 0 — Navigate to Phase 1 to create a new test. */
  static #onNewTest() {
    this._currentPhase = 1;
    this._phase1Initialized = false;
    this.render();
  }

  /** Phase 0 — Open an existing draft test for editing (Phase 2). */
  static #onSelectTest(event, target) {
    const testId = target.dataset.testId;
    this._editingTestId = testId;
    this._currentPhase = 2;
    this._phase2Initialized = false;
    this.render();
  }

  /** Phase 0 — Delete a saved draft test. */
  static async #onDeleteTest(event, target) {
    const testId = target.dataset.testId;
    await deleteDraftTest(testId);
    this.render();
  }

  /** Phase 1 / Phase 2 — Navigate back to Phase 0. */
  static #onBackToList() {
    this._currentPhase = 0;
    this._editingTestId = null;
    this._phase1Initialized = false;
    this._phase2Initialized = false;
    this.render();
  }

  /**
   * Phase 1 — Create the montage test, save as draft, then transition to Phase 2.
   */
  static async #onCreateTest() {
    const name = this._phase1Data.name || "Montage Test";
    const difficulty = this._phase1Data.difficulty;
    const availableHeroes = getAvailableHeroes();
    const heroes = availableHeroes.filter((h) => this._phase1Data.selectedHeroIds.has(h.actorId));

    if (heroes.length === 0) {
      ui.notifications.warn(game.i18n.localize("MONTAGE.Warn.NoHeroes"));
      return;
    }

    // Read custom limits — sync from DOM in case they were edited
    const successInput = this.element?.querySelector('input[name="successLimit"]');
    const failureInput = this.element?.querySelector('input[name="failureLimit"]');
    if (successInput) {
      const val = parseInt(successInput.value);
      this._phase1Data.customSuccessLimit = isNaN(val) || val < 1 ? null : val;
    }
    if (failureInput) {
      const val = parseInt(failureInput.value);
      this._phase1Data.customFailureLimit = isNaN(val) || val < 1 ? null : val;
    }

    const createOptions = {
      name,
      difficulty,
      heroCount: heroes.length,
      heroes,
    };
    if (this._phase1Data.customSuccessLimit !== null) {
      createOptions.successLimit = this._phase1Data.customSuccessLimit;
    }
    if (this._phase1Data.customFailureLimit !== null) {
      createOptions.failureLimit = this._phase1Data.customFailureLimit;
    }

    const testData = createMontageTestData(createOptions);

    await saveDraftTest(testData);
    ui.notifications.info(game.i18n.format("MONTAGE.Notify.TestCreated", { name: testData.name }));

    // Transition to Phase 2 for this test
    this._editingTestId = testData.id;
    this._currentPhase = 2;
    this._phase1Initialized = false;
    this._phase2Initialized = false;
    this.render();
  }

  /**
   * Phase 2 — Add a complication to the specified round.
   */
  static #onAddComplication(event, target) {
    // Sync form first so existing text isn't lost
    this._syncPhase2FromForm();
    const round = parseInt(target.dataset.round) || 1;
    this._phase2Data.complications.push(createComplication({ triggerRound: round }));
    this.render();
  }

  /**
   * Phase 2 — Remove a complication.
   */
  static #onRemoveComplication(event, target) {
    this._syncPhase2FromForm();
    const id = target.dataset.complicationId;
    const idx = this._phase2Data.complications.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this._phase2Data.complications.splice(idx, 1);
      this.render();
    }
  }

  /**
   * Phase 2 — Save complications & notes to draft without activating.
   */
  static async #onSaveSetup() {
    this._syncPhase2FromForm();

    const testData = getDraftTest(this._editingTestId);
    if (!testData) return;

    testData.complications = this._phase2Data.complications.map((c) => ({ ...c }));
    testData.gmNotes = { ...this._phase2Data.gmNotes };

    await updateDraftTest(testData);
    ui.notifications.info(game.i18n.localize("MONTAGE.Notify.SetupSaved"));
  }

  /**
   * Phase 2 — Save, activate the test, and push UI to players.
   */
  static async #onActivateTest() {
    // Guard: don't allow activation if another test is already active
    const existing = loadActiveTest();
    if (existing && existing.status === TEST_STATUS.ACTIVE) {
      ui.notifications.warn(game.i18n.localize("MONTAGE.Warn.ActiveTestRunning"));
      return;
    }

    this._syncPhase2FromForm();

    const testData = getDraftTest(this._editingTestId);
    if (!testData) return;

    // Apply complications & notes
    testData.complications = this._phase2Data.complications.map((c) => ({ ...c }));
    testData.gmNotes = { ...this._phase2Data.gmNotes };

    // Save to active test slot with SETUP status so activateTest() picks it up
    testData.status = TEST_STATUS.SETUP;
    await saveActiveTest(testData);

    // Remove from drafts
    await deleteDraftTest(this._editingTestId);

    // Activate (transitions SETUP → ACTIVE, creates round data, broadcasts)
    await activateTest();

    // Tell all players to open their tracker
    game.socket.emit(SOCKET_NAME, {
      event: SOCKET_EVENTS.MONTAGE_ACTIVATED,
      data: {},
    });

    // Open GM tracker, close config
    const { MontageTrackerGMApp } = await import("./montage-tracker-gm.mjs");
    new MontageTrackerGMApp().render({ force: true });
    this.close();
  }
}

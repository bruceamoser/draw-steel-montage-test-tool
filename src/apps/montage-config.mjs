import { MODULE_ID, MONTAGE_DIFFICULTY } from "../config.mjs";
import { calculateLimits, getDefaultMaxRounds } from "../helpers/difficulty.mjs";
import {
  createMontageTestData,
  createComplication,
  saveActiveTest,
  getAvailableHeroes,
} from "../data/montage-test.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM application for creating and configuring a new Montage Test.
 */
export class MontageConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "montage-config",
    tag: "form",
    classes: ["montage-app", "montage-config"],
    window: {
      title: "MONTAGE.Config.Title",
      icon: "fa-solid fa-mountain-sun",
      resizable: true,
    },
    position: {
      width: 560,
      height: "auto",
    },
    form: {
      handler: MontageConfigApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    actions: {
      addComplication: MontageConfigApp.#onAddComplication,
      removeComplication: MontageConfigApp.#onRemoveComplication,
      recalculate: MontageConfigApp.#onRecalculate,
    },
  };

  /** @override */
  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/montage-config.hbs`,
    },
  };

  /**
   * Working copy of the configuration data.
   * @type {object}
   */
  #formData = {
    name: "",
    difficulty: MONTAGE_DIFFICULTY.MODERATE,
    heroCount: 0,
    maxRounds: getDefaultMaxRounds(),
    successLimit: 0,
    failureLimit: 0,
    manualLimits: false,
    heroes: [],
    complications: [],
    gmNotes: {
      totalSuccess: "",
      partialSuccess: "",
      totalFailure: "",
      general: "",
    },
  };

  /** @override */
  async _prepareContext(options) {
    const availableHeroes = getAvailableHeroes();

    // Initialize hero count from available heroes if not already set
    if (this.#formData.heroCount === 0 && availableHeroes.length > 0) {
      this.#formData.heroCount = availableHeroes.length;
      this.#formData.heroes = availableHeroes;
    }

    // Recalculate limits unless manually overridden
    if (!this.#formData.manualLimits) {
      const limits = calculateLimits(this.#formData.difficulty, this.#formData.heroCount || 1);
      this.#formData.successLimit = limits.successLimit;
      this.#formData.failureLimit = limits.failureLimit;
    }

    return {
      formData: this.#formData,
      availableHeroes,
      difficulties: Object.entries(MONTAGE_DIFFICULTY).map(([key, value]) => ({
        value,
        label: game.i18n.localize(`MONTAGE.Difficulty.${key.charAt(0) + key.slice(1).toLowerCase()}`),
        selected: value === this.#formData.difficulty,
      })),
      roundOptions: [1, 2, 3, 4, 5].map((n) => ({
        value: n,
        label: `${n}`,
        selected: n === this.#formData.maxRounds,
      })),
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Live recalculation on difficulty/hero count change
    const difficultySelect = this.element.querySelector('[name="difficulty"]');
    const heroCountInput = this.element.querySelector('[name="heroCount"]');
    const manualCheckbox = this.element.querySelector('[name="manualLimits"]');

    difficultySelect?.addEventListener("change", () => {
      this.#formData.difficulty = difficultySelect.value;
      if (!this.#formData.manualLimits) this.render();
    });

    heroCountInput?.addEventListener("change", () => {
      this.#formData.heroCount = parseInt(heroCountInput.value) || 1;
      if (!this.#formData.manualLimits) this.render();
    });

    manualCheckbox?.addEventListener("change", () => {
      this.#formData.manualLimits = manualCheckbox.checked;
      if (!manualCheckbox.checked) this.render();
    });

    // Hero selection checkboxes
    this.element.querySelectorAll('.hero-select input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        this.#updateSelectedHeroes();
      });
    });
  }

  /**
   * Update the selected heroes list from checkbox state.
   */
  #updateSelectedHeroes() {
    const checkboxes = this.element.querySelectorAll('.hero-select input[type="checkbox"]:checked');
    const availableHeroes = getAvailableHeroes();
    const selectedIds = new Set([...checkboxes].map((cb) => cb.value));

    this.#formData.heroes = availableHeroes.filter((h) => selectedIds.has(h.actorId));
    this.#formData.heroCount = this.#formData.heroes.length;

    if (!this.#formData.manualLimits) {
      this.render();
    }
  }

  /**
   * Handle adding a new complication.
   */
  static #onAddComplication() {
    this.#formData.complications.push(createComplication({ triggerRound: 1 }));
    this.render();
  }

  /**
   * Handle removing a complication.
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static #onRemoveComplication(event, target) {
    const idx = parseInt(target.dataset.index);
    if (!isNaN(idx)) {
      this.#formData.complications.splice(idx, 1);
      this.render();
    }
  }

  /**
   * Handle recalculate button click.
   */
  static #onRecalculate() {
    this.#formData.manualLimits = false;
    this.render();
  }

  /**
   * Handle form submission — create and save the montage test.
   * @param {Event} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);

    // Read complications from form
    const complications = [];
    const compDescs = this.element.querySelectorAll('[name^="complication-desc-"]');
    const compEffects = this.element.querySelectorAll('[name^="complication-effect-"]');
    const compRounds = this.element.querySelectorAll('[name^="complication-round-"]');
    for (let i = 0; i < compDescs.length; i++) {
      complications.push(createComplication({
        description: compDescs[i]?.value ?? "",
        effect: compEffects[i]?.value ?? "",
        triggerRound: parseInt(compRounds[i]?.value) || 1,
      }));
    }

    const testData = createMontageTestData({
      name: data.name || "Montage Test",
      difficulty: data.difficulty || MONTAGE_DIFFICULTY.MODERATE,
      heroCount: this.#formData.heroes.length,
      heroes: this.#formData.heroes,
      maxRounds: parseInt(data.maxRounds) || getDefaultMaxRounds(),
      successLimit: data.manualLimits ? parseInt(data.successLimit) : undefined,
      failureLimit: data.manualLimits ? parseInt(data.failureLimit) : undefined,
      complications,
      gmNotes: {
        totalSuccess: data["gmNotes.totalSuccess"] ?? "",
        partialSuccess: data["gmNotes.partialSuccess"] ?? "",
        totalFailure: data["gmNotes.totalFailure"] ?? "",
        general: data["gmNotes.general"] ?? "",
      },
    });

    await saveActiveTest(testData);
    ui.notifications.info(game.i18n.format("MONTAGE.Notify.TestCreated", { name: testData.name }));

    // Open the GM tracker
    const { MontageTrackerGMApp } = await import("./montage-tracker-gm.mjs");
    new MontageTrackerGMApp().render({ force: true });
  }
}

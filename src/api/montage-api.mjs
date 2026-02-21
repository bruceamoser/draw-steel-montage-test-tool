import { MODULE_ID, TEST_STATUS } from "../config.mjs";
import {
  loadActiveTest,
  saveActiveTest,
  clearActiveTest,
  createMontageTestData,
} from "../data/montage-test.mjs";
import { adjustTally, activateTest, advanceRound, endTestEarly } from "../socket.mjs";

/**
 * Public API exposed on `game.modules.get("draw-steel-montage").api`.
 * Provides programmatic access to the montage test lifecycle.
 */
export class MontageAPI {

  /**
   * Get the currently active montage test data, or null.
   * @returns {object|null}
   */
  getActiveTest() {
    return loadActiveTest();
  }

  /**
   * Create a new montage test with the given options.
   * GM only.
   * @param {object} options - See createMontageTestData for shape
   * @returns {Promise<object>} The created test data
   */
  async createTest(options) {
    if (!game.user.isGM) throw new Error("Only the GM can create a montage test.");
    const testData = createMontageTestData(options);
    await saveActiveTest(testData);
    return testData;
  }

  /**
   * Activate the current montage test.
   * GM only.
   */
  async activateTest() {
    if (!game.user.isGM) throw new Error("Only the GM can activate a montage test.");
    await activateTest();
  }

  /**
   * Advance to the next round.
   * GM only.
   */
  async advanceRound() {
    if (!game.user.isGM) throw new Error("Only the GM can advance rounds.");
    await advanceRound();
  }

  /**
   * End the test early.
   * GM only.
   */
  async endTestEarly() {
    if (!game.user.isGM) throw new Error("Only the GM can end the test early.");
    await endTestEarly();
  }

  /**
   * Manually adjust the success/failure tallies.
   * GM only.
   * @param {object} adjustment - { successes?: number, failures?: number }
   */
  async adjustTally(adjustment) {
    if (!game.user.isGM) throw new Error("Only the GM can adjust tallies.");
    await adjustTally(adjustment);
  }

  /**
   * Clear the active test.
   * GM only.
   */
  async clearTest() {
    if (!game.user.isGM) throw new Error("Only the GM can clear the test.");
    await clearActiveTest();
  }

  /**
   * Open the GM tracker window.
   * GM only.
   */
  async openGMTracker() {
    const { MontageTrackerGMApp } = await import("../apps/montage-tracker-gm.mjs");
    new MontageTrackerGMApp().render({ force: true });
  }

  /**
   * Open the player tracker window.
   */
  async openPlayerTracker() {
    const { MontageTrackerPlayerApp } = await import("../apps/montage-tracker-player.mjs");
    new MontageTrackerPlayerApp().render({ force: true });
  }

  /**
   * Open the configuration/creation window.
   * GM only.
   */
  async openConfig() {
    if (!game.user.isGM) throw new Error("Only the GM can open the config.");
    const { MontageConfigApp } = await import("../apps/montage-config.mjs");
    new MontageConfigApp().render({ force: true });
  }
}

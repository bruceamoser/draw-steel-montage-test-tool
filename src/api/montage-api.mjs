import { MODULE_ID } from "../config.mjs";
import { MONTAGE_TEST_ITEM_TYPE } from "../items/montage-test-model.mjs";

/**
 * Public API exposed on `game.modules.get("draw-steel-montage").api`.
 * Item-centric helpers for creating and opening Montage Test items.
 */
export class MontageAPI {


  /**
   * Create a new Montage Test item in the world.
   * @param {object} [options]
   * @param {string} [options.name]
   * @param {boolean} [options.renderSheet]
   */
  async createMontageTest(options = {}) {
    if (!game.user.isGM) throw new Error("Only the GM can create a montage test.");

    const item = await Item.create({
      name: options.name ?? game.i18n.localize("MONTAGE.Item.DefaultName"),
      type: MONTAGE_TEST_ITEM_TYPE,
    });

    if (options.renderSheet) item?.sheet?.render(true);
    return item;
  }

  /**
   * Open the Items sidebar tab.
   */
  openItemsDirectory() {
    ui.sidebar.activateTab("items");
  }
}

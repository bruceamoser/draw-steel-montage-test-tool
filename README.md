# Draw Steel — Montage Test Tool

[![Foundry VTT](https://img.shields.io/badge/Foundry_VTT-v13-orange?style=flat-square)](https://foundryvtt.com)
[![System](https://img.shields.io/badge/System-Draw_Steel-blue?style=flat-square)](https://github.com/MetaMorphic-Digital/draw-steel)
[![Version](https://img.shields.io/badge/version-0.5.0-brightgreen?style=flat-square)](https://github.com/bruceamoser/draw-steel-montage-test-tool/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

A [Foundry VTT](https://foundryvtt.com) module for the [Draw Steel](https://mcdmproductions.com) RPG system that gives Directors a dedicated **Montage Test Item** — a persistent, tabbed sheet for authoring complications, GM outcomes, and tracking per-hero round results.

Montage Test Items live in the World Items directory, so they benefit from Foundry's built-in duplication, folder organization, compendium storage, and permission controls.

---

## Features

| Feature | Detail |
|---|---|
| **Montage Test Item type** | Custom `Item` sub-type registered against the Draw Steel system; appears in the Create Item dialog with the label "Montage Test" |
| **Tabbed sheet — Basic** | Item name, description (rich text, editable by GM) |
| **Tabbed sheet — Round 1 / Round 2** | Per-round **Complications** editor (visible to all with Observer permission) and **GM Outcomes** editor (GM-only) — both are resizable and scrollable ProseMirror editors |
| **Tabbed sheet — Results** | Add participants by drag-and-drop or button; mark each hero Success / Fail / Neither per round; auto-tally vs. limits; display computed outcome (Total Success / Partial / Failure) |
| **Auto-calculated limits** | Success and Failure limits recalculate automatically when difficulty or participant count changes, using the official Draw Steel difficulty table |
| **Persistent storage** | All rich-text content and results are saved to the Item's `system` fields and persist across sessions |
| **Player visibility** | Observers see Complications for both rounds in read-only format; GM Outcomes are hidden from players |
| **Public API** | `game.modules.get("draw-steel-montage").api` exposes helpers for macro authors |

---

## Requirements

| Requirement | Version |
|---|---|
| [Foundry VTT](https://foundryvtt.com/) | v13 (13.351+) |
| [Draw Steel System](https://github.com/MetaMorphic-Digital/draw-steel) | 0.9.0+ |

This module **only** initialises in worlds using the Draw Steel game system.

---

## Installation

### Manifest URL (Recommended)

1. In Foundry VTT, go to **Add-on Modules → Install Module**.
2. Paste the manifest URL into the **Manifest URL** field:
   ```
   https://github.com/bruceamoser/draw-steel-montage-test-tool/releases/latest/download/module.json
   ```
3. Click **Install**.
4. Enable **Draw Steel — Montage Test Tool** in your world under **Settings → Manage Modules**.

### Manual

1. Download `draw-steel-montage.zip` from the [latest release](https://github.com/bruceamoser/draw-steel-montage-test-tool/releases/latest).
2. Extract the zip into your Foundry `Data/modules/` directory (produces a `draw-steel-montage/` folder).
3. Restart Foundry VTT and enable the module.

---

## How to Use

### 1 — Create a Montage Test

As GM, open the **Items** sidebar tab and click **Create Item**. Choose the type **Montage Test** and give it a name (e.g., "Escape the Collapsing Ruin").

> You can also create one via macro:
> ```js
> game.modules.get("draw-steel-montage").api.createMontageTest({ renderSheet: true });
> ```

### 2 — Fill In the Sheet

Open the item sheet. You will see four tabs:

#### Basic tab
- Enter a **Description** — narrative framing, special rules, or player-facing context for the test.
- Set the **Difficulty** (Easy / Moderate / Hard) — Success and Failure limits update automatically.
- Adjust **Success Limit** and **Failure Limit** manually if needed.

#### Round 1 and Round 2 tabs
Each round tab has two rich-text editors:

| Editor | Who can see it |
|---|---|
| **Complications** | All players with Observer (or higher) permission |
| **GM Outcomes** | GM only |

Write the complication text that players will face for that round in **Complications**. Write your narrative outcome notes (what happens on Total Success, Partial, or Failure) in **GM Outcomes**.

Both editors support full ProseMirror formatting and are resizable — drag the bottom edge to make them taller.

#### Results tab
1. Click **Add Participant** or drag a hero **Actor** from the sidebar onto the drop zone.
2. Participants are added with their linked actor's name and portrait.
3. For each hero and each round, select **Success**, **Fail**, or **Neither**.
4. The **tally bar** at the top of the tab tracks totals vs. limits and shows the computed outcome once the test resolves.

### 3 — Share with Players

Grant **Observer** (or higher) permission on the Item to your players via **Right-click → Configure Ownership** in the Items sidebar. Players opening the sheet will see the Basic description and Round Complications, but not GM Outcomes.

### 4 — Reuse as Templates

Once a Montage Test is filled in, right-click it in the Items sidebar and choose **Duplicate** to create a clean copy for future runs. Store master templates in an **Items Compendium** for long-term reuse.

---

## Rules Reference

<details>
<summary><strong>Montage Difficulty Table</strong></summary>

| Difficulty | Base Success Limit | Base Failure Limit |
|------------|--------------------|--------------------|
| Easy       | 5                  | 5                  |
| Moderate   | 6                  | 4                  |
| Hard       | 7                  | 3                  |

Limits adjust **+1 per hero** above or below the baseline of 5 heroes (minimum 2). Adjustments apply automatically when you add or remove participants.

</details>

<details>
<summary><strong>Montage Resolution</strong></summary>

| Outcome         | Condition                                              |
|-----------------|--------------------------------------------------------|
| Total Success   | Successes reach the Success Limit                      |
| Partial Success | Time/failures run out **and** successes minus failures is 2 or more |
| Total Failure   | Time/failures run out **and** successes minus failures is less than 2 |

</details>

<details>
<summary><strong>Individual Test Power Roll Tiers</strong></summary>

| Difficulty | Tier 1 (11 or lower)    | Tier 2 (12-16)           | Tier 3 (17+)          |
|------------|-------------------------|--------------------------|-----------------------|
| Easy       | Success w/ consequence  | Success                  | Success w/ reward     |
| Medium     | Failure                 | Success w/ consequence   | Success               |
| Hard       | Failure w/ consequence  | Failure                  | Success               |

A natural 19-20 always counts as Tier 3 with a reward.

</details>

---

## Public API

Available after the `ready` hook at `game.modules.get("draw-steel-montage").api`.

```js
const api = game.modules.get("draw-steel-montage").api;

// Create a new Montage Test item and open its sheet
await api.createMontageTest({ name: "My Test", renderSheet: true });

// Open the Items sidebar tab
api.openItemsDirectory();
```

---

## File Structure

```
draw-steel-montage/
├── module.json                       # Module manifest
├── package.json                      # NPM metadata + build version
├── lang/
│   └── en.json                       # English localisation
├── scripts/
│   └── package.mjs                   # Build + zip script
├── src/
│   ├── module.mjs                    # Entry point: hooks, init, registration
│   ├── config.mjs                    # Module constants
│   ├── socket.mjs                    # Socket event handler
│   ├── api/
│   │   └── montage-api.mjs           # Public API class
│   ├── apps/
│   │   ├── montage-config.mjs        # Config dialog
│   │   ├── montage-tracker-gm.mjs    # GM Tracker App (ApplicationV2)
│   │   └── montage-tracker-player.mjs # Player Tracker App (ApplicationV2)
│   ├── data/
│   │   └── montage-test.mjs          # Active test state helpers
│   ├── helpers/
│   │   ├── chat.mjs                  # Chat card rendering
│   │   ├── difficulty.mjs            # Difficulty utilities
│   │   └── resolution.mjs            # Outcome / round helpers
│   └── items/
│       ├── montage-test-model.mjs    # TypeDataModel schema + resolution logic
│       └── montage-test-sheet.mjs    # ItemSheet class (AppV1)
├── styles/
│   └── montage.css                   # All module styles (mts-* namespaced)
├── templates/
│   └── items/
│       └── montage-test-sheet.hbs    # Handlebars sheet template
└── dist/                             # Build output (git-ignored)
    ├── module.json
    └── draw-steel-montage.zip
```

---

## Development

```bash
# Install dev dependencies
npm install

# Build release artifacts (dist/module.json + dist/draw-steel-montage.zip)
npm run build

# Or invoke directly with an explicit version
node scripts/package.mjs 1.2.3
```

The build script stamps `#{VERSION}#` in `module.json` with the version from `package.json` and zips everything except `dist/`, `node_modules/`, and dotfiles.

---

## Compatibility

| Software | Version |
|---|---|
| Foundry VTT | v13 (13.351+) |
| Draw Steel System | 0.9.0 - 0.10.0 (verified) |

---

## License

This module is released under the [MIT License](LICENSE).

**Draw Steel** is a trademark of MCDM Productions, LLC. This module is an independent community project and is not affiliated with or endorsed by MCDM Productions, LLC.

---

## Acknowledgements

- [MCDM Productions](https://mcdmproductions.com) for Draw Steel
- [MetaMorphic Digital](https://github.com/MetaMorphic-Digital/draw-steel) for the Draw Steel Foundry VTT system
- The Foundry VTT community

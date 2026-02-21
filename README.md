# Draw Steel - Montage Test Tool

[![Foundry VTT Version](https://img.shields.io/badge/Foundry_VTT-v13-orange)](https://foundryvtt.com)
[![System](https://img.shields.io/badge/System-Draw_Steel-blue)](https://github.com/MetaMorphic-Digital/draw-steel)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

A [Foundry VTT](https://foundryvtt.com) module for building, tracking, and resolving **Montage Tests** as described in the [Draw Steel](https://mcdmproductions.com) RPG by MCDM Productions.

---

## Features

- **Custom Item Type: Montage Test** — Montage Tests are stored as Items, so you get persistence, duplication, and permissions “for free”
- **Tabbed Sheet** — Basic Info, Complications (Round 1 / Round 2), Outcomes (GM-only), and Results (GM-only)
- **Complications by Round** — Players can view round-specific complication lists on the item
- **Outcome Notes (GM-only)** — GM writes narrative outcomes for Total Success / Partial Success / Total Failure
- **Results Tracker (GM-only)** — GM marks each participant as Success / Fail / Neither for each round; totals are computed automatically
- **Public API (minimal)** — Helpers via `game.modules.get("draw-steel-montage").api`

## Rules Reference

<details>
<summary><strong>Montage Difficulty Table</strong></summary>

| Montage Difficulty | Base Success Limit | Base Failure Limit |
|--------------------|--------------------|--------------------|
| Easy               | 5                  | 5                  |
| Moderate           | 6                  | 4                  |
| Hard               | 7                  | 3                  |

Limits adjust ±1 per hero above or below 5 (minimum 2). Default maximum of 2 rounds per test.

</details>

<details>
<summary><strong>Individual Test Outcomes (Power Roll Tiers)</strong></summary>

| Test Difficulty | Tier 1 (≤11)              | Tier 2 (12–16)            | Tier 3 (17+)          |
|-----------------|---------------------------|---------------------------|-----------------------|
| Easy            | Success w/ consequence     | Success                   | Success w/ reward     |
| Medium          | Failure                    | Success w/ consequence    | Success               |
| Hard            | Failure w/ consequence     | Failure                   | Success               |

A natural 19–20 on the power roll always counts as Tier 3 with a reward.

</details>

<details>
<summary><strong>Montage Resolution</strong></summary>

| Outcome          | Condition                                               |
|------------------|---------------------------------------------------------|
| Total Success    | Successes reach the limit                               |
| Partial Success  | Time/failures run out and successes − failures ≥ 2      |
| Total Failure    | Time/failures run out and successes − failures < 2      |

</details>

<details>
<summary><strong>Aid / Assist Outcomes</strong></summary>

| Tier   | Effect on Aided Hero's Next Roll |
|--------|----------------------------------|
| Tier 1 | Bane (−)                         |
| Tier 2 | Edge (+)                         |
| Tier 3 | Double Edge (++)                 |

</details>

## Installation

### Manifest URL (Recommended)

1. In Foundry VTT, navigate to **Add-on Modules → Install Module**
2. Paste the manifest URL into the **Manifest URL** field:
   ```
   https://github.com/bruceamoser/draw-steel-montage-test-tool/releases/latest/download/module.json
   ```
3. Click **Install**
4. Enable **Draw Steel - Montage Test Tool** in your Draw Steel world under **Settings → Manage Modules**

### Manual Installation

1. Download `draw-steel-montage.zip` from the [latest release](https://github.com/bruceamoser/draw-steel-montage-test-tool/releases/latest)
2. Extract the archive into your Foundry `Data/modules/` directory (the zip contains a `draw-steel-montage/` folder)
3. Restart Foundry VTT and enable the module

## How to Use

1. **Open Items** — Click the mountain (⛰) icon in Token controls, or type `/montage` in chat
2. **Create a Montage Test** — As GM, run `/montage new` (or create an Item of type **Montage Test**)
3. **Fill in the sheet**
   - **Basic Info**: enter the test description/instructions
   - **Complications**: enter Round 1 and Round 2 complication lists (players can read these)
   - **Outcomes (GM-only)**: write what happens for Total Success / Partial Success / Total Failure
   - **Results (GM-only)**: add participants and mark Success / Fail / Neither for each round
4. **Duplicate for templates** — Duplicate an item when you want a reusable “blank” test template

## Compatibility

| Requirement   | Version          |
|---------------|------------------|
| Foundry VTT   | v13 (13.351+)    |
| Draw Steel    | 0.9.0 – 0.10.0   |

## Development

```bash
# Install dev dependencies
npm install

# Lint source files
npm run lint

# Build release artifacts into dist/
npm run build

# Build with a specific version
node scripts/package.mjs 1.2.3
```

The build script outputs `dist/module.json` (version-stamped) and `dist/draw-steel-montage.zip` ready to attach to a GitHub release.

## License

This module is released under the [MIT License](LICENSE).

**Draw Steel** is a trademark of MCDM Productions, LLC. This module is an independent community project and is not affiliated with or endorsed by MCDM Productions.

## Acknowledgments

- [MCDM Productions](https://mcdmproductions.com) for the Draw Steel RPG
- [MetaMorphic Digital](https://github.com/MetaMorphic-Digital/draw-steel) for the Draw Steel Foundry VTT system
- The Foundry VTT community

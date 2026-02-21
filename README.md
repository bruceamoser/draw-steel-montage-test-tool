# Draw Steel - Montage Test Tool

[![Foundry VTT Version](https://img.shields.io/badge/Foundry_VTT-v13-orange)](https://foundryvtt.com)
[![System](https://img.shields.io/badge/System-Draw_Steel-blue)](https://github.com/MetaMorphic-Digital/draw-steel)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

A [Foundry VTT](https://foundryvtt.com) module for building, tracking, and resolving **Montage Tests** as described in the [Draw Steel](https://mcdmproductions.com) RPG by MCDM Productions.

---

## Features

- **GM Configuration** — Create montage tests with difficulty selection, hero roster, optional complications per round, and custom round limits
- **Automatic Limit Calculation** — Success and failure limits calculated from montage difficulty and hero count per the Draw Steel rules (with manual override)
- **Player Tracker** — Each player receives a dedicated window to choose their action each round: Roll, Aid Another Hero, Use an Ability, or Do Nothing
- **GM Approval Flow** — Every player action is submitted to the GM for review; the GM sets individual test difficulty, then approves or rejects
- **Live Progress** — Real-time success/failure progress bars synced across all connected clients
- **Complication Management** — Define complications that trigger on specific rounds
- **Manual Tally Adjustment** — GM can adjust success/failure counts at any time
- **Chat Integration** — Round summaries and test completion cards posted to chat automatically
- **Outcome Notes** — GM can pre-write narrative text for total success, partial success, and total failure
- **Victory Tracking** — Automatic victory awards based on difficulty and outcome
- **Public API** — Programmatic access via `game.modules.get("draw-steel-montage").api`

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

1. **Open the tool** — Click the mountain (⛰) icon in the Token controls sidebar, or type `/montage` in chat
2. **Create a montage test** — Use `/montage new` or the toolbar button. Configure difficulty, select participating heroes, add round complications, and write outcome notes
3. **Activate** — Click **Activate Test**. All players with a hero in the test automatically receive their tracker window
4. **Player actions** — Each player selects an action type, describes their approach, and submits
5. **GM approval** — The GM reviews each submitted action, sets the individual test difficulty, and approves or rejects
6. **Rolling** — After approval the player makes a power roll; the GM can also enter results manually
7. **Auto-tally** — Successes and failures are tallied automatically based on the roll tier and test difficulty
8. **Advance rounds** — Once all heroes have acted, advance to the next round (or let it auto-advance)
9. **Resolution** — The test resolves automatically when a limit is reached or rounds are exhausted; a summary card is posted to chat

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

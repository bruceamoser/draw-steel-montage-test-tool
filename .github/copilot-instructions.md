# draw-steel-montage-test-tool — Copilot Instructions

Foundry VTT V13 module for Draw Steel montage test encounters. See ARCHITECTURE.md for design details.

## Stack
- TypeScript source in `src/`, compiled to `scripts/`
- Module manifest: `module.json`
- Templates: `templates/` (Handlebars)
- Styles: `styles/`
- Localization: `lang/`
- Build: `npm run build`

## Conventions
- Follow Foundry VTT V13 API patterns
- Use the MCP server's `generate_montage_test` tool to create test montage data
- Use `lookup_rule` or `get_rules_for_topic` to verify montage test mechanics
- Reference `reference/` for Draw Steel montage test rules

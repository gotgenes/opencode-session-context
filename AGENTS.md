# AGENTS.md

## Project Overview

OpenCode plugin (`@gotgenes/opencode-session-context`) that exposes a `parent_session_messages` tool, allowing subagents to read the full conversation from their parent session via the OpenCode SDK.

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **Linting:** Biome (formatting + linting), markdownlint-cli2 (Markdown)
- **Testing:** Bun's built-in test runner (`bun:test`)
- **Pre-commit hooks:** prek (trailing whitespace, EOF fixer, markdownlint, Biome)
- **CI:** GitHub Actions (type check, lint, test)
- **Releases:** release-please with npm publish via OIDC trusted publishing
- **Build:** `bun build` for bundling, `tsc` for declaration files only

## Commands

```bash
bun run check        # Type check (tsc --noEmit)
bun run lint         # Biome check
bun run lint:md      # Markdown lint
bun run lint:all     # Biome + Markdown lint
bun run lint:fix     # Biome auto-fix
bun run test         # Run tests
bun run test:watch   # Run tests in watch mode
bun run build        # Bundle + emit declarations
```

## Source Structure

All source lives in `src/`. The codebase is small — a single feature module:

- `index.ts` — Public API re-export
- `parent-session.ts` — Plugin implementation: registers `parent_session_messages` tool, fetches and formats parent session messages
- `types.ts` — Type augmentations for SDK v1 gaps (agent field missing from Message type, tracked at [opencode#15916](https://github.com/anomalyco/opencode/issues/15916))
- `parent-session.test.ts` — Unit tests using manual mocks of the SDK client

## Key Dependencies

- `@opencode-ai/plugin` — Plugin registration API (`Plugin` type, `tool()` helper)
- `@opencode-ai/sdk` — SDK types (`Part`, `Message`) used at the type level; the live `client` is injected at runtime by OpenCode

## Conventions

### Plugin architecture

The plugin exports an async factory (`ParentSessionPlugin`) that receives `{ client }` from OpenCode and returns a `tool` map. The client is the sole external dependency — all SDK interactions go through it.

### Testing approach

Tests mock the SDK client by constructing plain objects matching the client interface shape. No mocking libraries are used. Test helpers (`makeClient`, `makeContext`) live in the test file alongside the tests.

### Code style

Biome enforces formatting (2-space indent, double quotes) and linting (recommended rules). Test files relax `noExplicitAny` and `noNonNullAssertion`. Markdown enforces MD040 (fenced code language) and allows duplicate headings among siblings.

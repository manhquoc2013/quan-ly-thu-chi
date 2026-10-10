# quan-ly-thu-chi

workspace-type: mini
repo-type: mini
stack: none
framework: react

## Framework discipline (MANDATORY — read before delegating code work)

This project is built on **react**. Prefer the framework's CLI/generators over hand-writing files:

- Scaffold components / entities / migrations / modules via the framework CLI — hand-written files drift from the framework's expected structure and can break builds, dependency injection, or schema sync. Frameworks like ASP.NET Zero (ABP), Angular, NestJS, and Nx all enforce CLI-based generation.
- When unsure of the exact command or its current-version syntax, resolve live docs via context7 (`resolve-library-id` → `get-library-docs`) BEFORE generating.
- Main / project manager MUST carry these constraints into every worker task brief (workers do not read this file).

## SDLC convention

All SDLC scaffolding goes through `ai-kit` CLI (ADR-005).
Skills MUST NOT Write/mkdir under docs/{modules,features,hotfixes}/**.

## Custom MCP Operating Policies (MANDATORY — Auto-invoke)

The agent MUST proactively look up schemas and invoke MCP tools via `call_mcp_tool` when relevant, without waiting for the user to name specific tools:

### 1. `frontend-mcp` (UI / UX / Styling / Design Tokens)
- **New screens & components**: Call `generate_design_context` or `recommend_design_system` if design specs are missing. Retrieve base patterns via `get_ui_kit_catalog` and `get_ui_component` instead of inventing components.
- **Pre-flight UI verification**: Before finalizing UI code, run `validate_ui_code` followed by `audit_ux_interface`. Resolve hardcoded hex colors, arbitrary spacing, and smells, then audit once more (aim for UX health score >= 70 with 0 critical smells).
- **Restyling & Tokens**: Use `transform_ui_aesthetic` for aesthetic shifts. Use `inspect_token_drift` -> `compile_design_tokens` -> `update_theme_registrations` for design token changes.
- **Context synchronization**: Call `sync_ai_context` upon completing significant UI or architectural updates.

### 2. `universal-polyglot-agent` (Code Intelligence & Project Memory)
- **Memory & Decisions**: Check `recall_memory` for prior decisions, `get_recent_actions` for recent activity, and `lookup_term` / `define_term` for domain jargon.
- **Search & Navigation**: Prefer `query` or `search_codebase` (run `index_workspace` if unindexed); use `get_code_outline` and targeted `read_code_snippet` over loading whole files.
- **Impact analysis**: Run `context` and `impact` before editing shared symbols. Use `trace` for call flows and check `detect_changes` before finishing.
- **Syntax check**: Run `validate_syntax` after modifying TypeScript/JavaScript code.
- **Action logging**: Record key architectural decisions with `record_action` and save status snapshots with `save_context_snapshot`.


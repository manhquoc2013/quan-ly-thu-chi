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

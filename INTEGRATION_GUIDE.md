# Lumière integration — exact file locations

If you already have the fixed Dynamo dashboard running locally, these are the files involved.

## Add these new files

- `components/lumiere-dashboard.tsx`
- `components/project-switcher.tsx`

## Replace / restructure these files

- Existing `components/dashboard.tsx` becomes `components/dynamo-dashboard.tsx`.
  - Its Dynamo logic is preserved.
  - The component export is renamed from `Dashboard` to `DynamoDashboard`.
  - A project switcher is added to the sidebar.
- New `components/dashboard.tsx` is a tiny wrapper that switches between Dynamo and Lumière.
- Replace `lib/types.ts` with the included version (same Dynamo types + Lumière types).
- Replace `app/globals.css` with the included version (Dynamo styles + the larger readability overrides + completely separate Lumière styles).

## Optional cosmetic replacements

- `app/layout.tsx` only changes browser title/description.
- `README.md`, `start-dashboard.bat`, and `start-dashboard.ps1` only rename the launcher/project documentation.

## No change required

- `app/page.tsx`
- `lib/tasks.ts`
- `app/api/github/sync/route.ts`
- `.env.example`
- `package.json` dependencies

No new npm package is required.

## Data separation

Dynamo continues using:

`dynamo-control-payments-v1`

Lumière uses:

`lumiere-engineering-state-v1`

They do not read or write each other's state.

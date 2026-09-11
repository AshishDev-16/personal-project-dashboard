# Ashish · Project Control

One personal dashboard containing two fully separated project workspaces:

- **Project Dynamo** — GitHub fork/PR status + manual payment tracking.
- **Project Lumière (Engineering)** — manual AI-training task registry, review workflow and accepted-task earnings.

## Important separation

The projects intentionally do not share task or payment state.

- Dynamo payments: `localStorage` key `dynamo-control-payments-v1`
- Lumière tasks/settings: `localStorage` key `lumiere-engineering-state-v1`
- GitHub sync only updates Dynamo GitHub fields.
- Lumière is manual-only and never calls GitHub.
- Lumière earnings are calculated only as `Accepted tasks × global accepted-task rate`.

## Lumière workflow

Each manual submission stores:

- Task ID
- Submission date
- Category
- Prompt / task-identifying prompt text
- Status: In Review / Fixing in Progress / Accepted / Rejected
- Rejection reason when rejected

Changing a Lumière task to **Rejected** opens a required rejection-reason dialog.
Changing it to **Accepted** immediately counts the task as paid using the global rate configured in the Lumière workspace.

## Run locally

Requirements: current Node.js LTS and npm.

On Windows, double-click:

```text
start-dashboard.bat
```

Or run:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Files added for the Lumière integration

```text
components/dashboard.tsx          project-level switcher wrapper
components/dynamo-dashboard.tsx   existing Dynamo dashboard, kept isolated
components/lumiere-dashboard.tsx  Lumière manual workflow + UI
components/project-switcher.tsx   shared project selector
lib/types.ts                      adds Lumière data types
app/globals.css                   adds Lumière design + switcher + readable sizing
```

## Optional GitHub token

Only Dynamo uses GitHub. The public PRs work without a token, but a token gives a higher rate limit.
Copy `.env.example` to `.env.local` and set:

```env
GITHUB_TOKEN=github_pat_...
```

## Backups

Both project workspaces have separate backup flows.

- Dynamo Backup exports only Dynamo payment records.
- Lumière Backup exports only Lumière tasks and rate settings.

This V2 still uses browser local storage so it stays zero-database and immediately runnable. Supabase can be added later for cross-device syncing without changing the project separation model.

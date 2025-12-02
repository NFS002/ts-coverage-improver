# TS Coverage Improver

NestJS + React demo service that inspects TypeScript coverage, queues AI-driven test generation jobs, and surfaces status/PR links in a tiny dashboard (no CLI required).

## Quick start

```
cp .env.example .env # optional

# backend
cd backend
npm install
npm run start:dev

# frontend (in another shell)
cd ../frontend
npm install
npm run dev -- --host
```

- Backend defaults to `http://localhost:3000`.
- Frontend reads `VITE_API_URL` (defaults to the backend URL).
- Vite currently warns about Node 20.15; build/dev still works, but upgrading Node to 20.19+ removes the warning.
- For an offline demo you can point `repoUrl` to any local repo path; the scanner will still list `.ts` files with placeholder coverage.

## How it works

- **DDD slices**
  - `domain/`: entities (`CoverageFile`, `ImprovementJob`), value objects (`JobStatus`), and ports (`JobRepository`, `CoverageScanner`).
  - `application/`: use cases (`AnalyseCoverageUseCase`, `StartImprovementUseCase`, `ProcessJobUseCase`, etc.) that orchestrate domain services and ports.
  - `infrastructure/`: adapters (Drizzle + SQLite repo, Istanbul coverage scanner, AI CLI runner, dry-run PR service, filesystem repo prep, HTTP controller, in-memory queue).
- **Coverage scanning**: `LocalTsCoverageScanner` looks for `ts-coverage-improver.summary.json`. If none is found, it reads `tsconfig.json`, include/exclude globs to find `.ts` files. If the config doesnt exist, it looks for the `tsconfig.json` and parses this to find which files to include/exclude. If no `tsconfig.json` is found, it performs a DFS traversal
of the entire repo, skipping hidden directories, dependencies, etc.
- **Job handling**: `StartImprovementUseCase` writes a queued job to SQLite and drops it into `InMemoryJobQueue`. The queue processes one job at a time via `ProcessJobUseCase` to keep work serialized per process (simpler than per-repo locks for this demo).
- **AI CLI isolation**: `SimpleAiRunner` shells out with the `AI_CLI_COMMAND` template (defaults to `echo "Generated tests for {file}"`). Placeholders `{repo}` and `{file}` are replaced with the workspace path and target file, allowing you to wrap any CLI you trust.
- **PR publishing**: `DryRunPullRequestService` returns a deterministic fake PR URL (`<repo>/pull/<id>`) instead of hitting GitHub. Swap it for a real implementation if you provide a token.
- **Repo prep**: `FileSystemRepoPreparer` clones a repo into `.workspace/<hash>` (or reuses/pulls it) and also accepts a local path for offline demos.

## API surface (NestJS)

- `GET /health` – liveness check.
- `POST /coverage/analyse` – `{repoUrl}` to prepare the repo and return `{repository, files:[{filePath, coveragePct}]}` (repository payload includes id/owner/repo/path/fork metadata).
- `GET /repositories/:id/coverage` – prepare the repo by id and return `{repository, files:[{filePath, coveragePct}]}` (repository payload includes id/owner/repo/path/fork metadata).
- `POST /jobs` – `{repoId, filePath}` → creates a queued job for a tracked repository (URL inputs are no longer accepted here). Jobs store a strict `repoId` foreign key to repositories.
- `GET /jobs?repoId=<id>` – list jobs (filtered to a repository when `repoId` is provided) with status/logs/PR URLs. Each job includes `repoId`, `filePath`, status, optional `prUrl`, log, and timestamps.
- `GET /jobs/:id` – single job.
- `GET /repositories` – tracked repositories with open/queued/total job counts.
- `GET /repositories/:id` – single repository summary.

Paths: see `backend/src/infrastructure/http/api.controller.ts`.

## Minimal React dashboard

- Located in `frontend/src/App.tsx`.
- Lets you paste a repo URL, run coverage analysis, and click “Improve” on any row to create a job; or pick an existing repository from the new “Repositories” tab.
- Coverage and jobs tabs are scoped to the currently selected repository; repository cards include refresh buttons to pull the latest counts.
- Polls `/jobs` for the selected repository every ~3s to show progress, status pills, and PR links.
- Styles live in `frontend/src/App.css` and are intentionally minimal but not boilerplate.

## Environment variables

- `PORT` – backend port (default `3000`).
- `AI_CLI_COMMAND` – template command, supports `{repo}` and `{file}` tokens.
- `DB_PATH` – SQLite location (default `backend/data/coverage.sqlite`).
- `VITE_API_URL` (frontend) – API base URL.

## Design decisions & tradeoffs

- **Minimal but layered**: Avoided Nest modules/plugins to keep the DDD layering obvious. Wiring happens in `app.module.ts` via factories.
- **Safe defaults**: PR flow is dry-run, and the AI runner defaults to a harmless echo command so the service is demoable without secrets.
- **SQLite + Drizzle**: Better-sqlite3 driver with a tiny Drizzle schema and a programmatic `CREATE TABLE IF NOT EXISTS` to keep setup minimal; still fine for the single-process queue in this exercise.
- **Background worker**: Simple interval-based queue keeps the “improve coverage” flow asynchronous without bringing in a broker. Swap for Bull/RabbitMQ if scaling.
- **Coverage inputs**: Istanbul summary parsing keeps things realistic; the fallback stub ensures the UI always has data to work with during demos.
- **tsconfig-aware discovery**: Placeholder coverage now follows `tsconfig.json` include/exclude rules (using TypeScript’s defaults when not provided), converting those globs into include/exclude directories for traversal; this relies on the `typescript` package being available at runtime and falls back to the directory walk if the config cannot be read.
- **Frontend choice**: Explicit React dashboard (per instructions) instead of a CLI, with polling to reflect job status without WebSockets complexity.
- **Repository tracking**: Repositories are persisted by owner/repo plus fork metadata; API summaries expose ids and job counts only. Coverage responses add owner/repo/path details, so the UI merges that metadata into the summaries and falls back to displaying the repository id when owner/repo are unavailable. Jobs post `repoId` only (no URL echo on job payloads).

## Domain glossary

- **CoverageFile**: A TS file and its line coverage percent.
- **ImprovementJob**: A queued/running/completed/failed attempt to improve coverage for one file; includes logs and optional PR URL.
- **CoverageScanner**: Domain service that extracts `CoverageFile[]` from a repo workspace.
- **JobQueue/ProcessJobUseCase**: Background executor that prepares the repo, runs the AI CLI, and opens (stub) PRs.

## Extending to production

- Replace `DryRunPullRequestService` with a GitHub implementation (Octokit + a bot token), wiring branch pushes in the repo workspace.
- Harden the AI runner (per-job sandboxes, timeouts, resource limits).
- Add per-repo locks and a durable job queue for concurrency.
- Replace the fallback 42% coverage with real test runs (`npm test -- --coverage`) inside the workspace.
- Add authentication and API rate limiting before exposing externally.

- only supports input https
- clone via ssh
- publicly accessible repos only
- fork mode and fork owner and fork org
- Diffocullty knowing which directoeries to traverse to find ts files (uses tsconfig)
- Only supports ts
- supports both
  -       path.join(repositoryPath, 'coverage', 'coverage-summary.json'),
  -     path.join(repositoryPath, 'coverage-summary.json'),
- tsconfig must be in root directory

Default exclude paths are in utils:

export const INCLUDED_PATHS = [
    /^.*\.ts$/
];

export const EXCLUDED_PATHS = [
    /node_modules(?:\/|$)/,
    /vendor(?:\/|$)/,
    /dist(?:\/|$)/,
    /build(?:\/|$)/,
    /coverage(?:\/|$)/,
    /bower_components(?:\/|$)/,
    /jspm_packages(?:\/|$)/,
    /^\./,
    /\.d\.ts$/,
    /\.spec\.ts$/,
    /\.test\.ts$/
];


-- only unix paths
- GIT CLIENT TOKENS!!!
- AUTH ?
- Use repo & owner rather than protocol to be repo agnostic

- Global dependencies
  - Github CLI
  -  Codex CLI npm i -g @openai/codex

  Prereqs

Node.js 18+

npm install openai @octokit/rest simple-git

Your repo must already have a remote named origin

You have a GitHub token with repo scope
- Mention AGENTS.md or AGENTS.override.md in the repo, and how this can be used

# ./backend/.workspace/AGENTS.override.md

## ts-coverage-improver

- Always run a build and lint before committing any changes (See the package.json for the exact commands to run)
- When asked to create a file named ts-coverage-improver.summary.json, this file should have the structure

```json

{
    "path/to/file1.ts": {
      "include": true,
      "filePath": "path/to/file1.ts",
      "coveragePct": 85.5
    },
    "path/to/file2.ts": {
     "include": true,
     "filePath": "path/to/file2.ts",
     "coveragePct": 90.0
    }
};

```
- Any *.ts file recorded in the above json object should always have `included` set to `true`. Any other file type than a typescript (*.ts) file should have `included` set to `false`.
- If you run into any unexpected errors when trying to run any command, please exit immediately.
- End every task with a random stoic philisophy quote


- codex permssions
- OpenAIConfig.initialize() not working
- Global error handling, avoid leaking errors
such as ENOENT: no such file or directory, stat '/Users/noahfs/dev/ts-coverage-improver/backend/.workspace/35310825b90afb9823912db339e881fajkhkjnhk/blahblah'
- FORK MODE DOES NOT RESYNC FROM CHANGES TO ORIGINAL REPO!
- please run `gh repo set-default` to select a default remote repository. 
+ `gh repo sync` 
- fixes above
- Remove logs
- You shouldnt need to care about the fork at all.
- Fork config is wrong, should just need to store 'forkedFrom' in DB in case of sync
- MAKE 'ANALYZE' async
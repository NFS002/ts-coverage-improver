# TS Coverage Improver

## A service to manage repositories and test coverage.

- Analyse a new repository and start tracking it
- View test coverage percentage per source file
- Run AI agents that target specific files in the repository, and create pull requests to imporove their coverage
- View live updates on running and queued jobs and get a link to the new pull request. 
- Manage and run all these actions from a web dashboard
- **[Screenshots and demos](#screenshots-and-demos) are included at the bottoms of this file.**


## Built in Node.js/Typescript with React and NestJS

NestJS + React demo service that inspects TypeScript coverage, queues AI-driven test generation jobs, and surfaces status/PR links in a tiny dashboard (no CLI required).

*Specific instructions on running the server and client can be found in the README file in the [backend](backend/README.md) and [frontend](frontend/README.md) directories files respectively.*

### Architecture

- Layered structure
    - [HTTP API](./backend/src/infrastructure/http/api.controller.ts)
        - Request validation via Zod schemas
    - [Application use-cases](./backend/src/application/)
    - [Service ports](./backend/src/application/ports/)
        - Integrations to Github, OpenAI, Coverage Scanner
    - [Domain entites and DTOS](./backend/src/domain)
    - [Infrastructure](./backend/src/infrastructure/)
        - [AI Runner](./backend/src/infrastructure/ai/simple-ai.runner.ts)
        - [Pull Request Service](./backend/src/infrastructure/github/pull-request.service.ts)
        - [Repo Preparer](./backend/src/infrastructure/github/fs-repo.preparer.ts)
        - [Job Queue](./backend/src/infrastructure/queue/db-job-queue.queue.ts)
        - [Peristence](./backend/src/infrastructure/persistence/entities/)
            - Implemented using sqlite and drizzle ORM
    - [Configuration](./backend/src/infrastructure/config/)
    - Wiring and Dependency Injection handled by Nest factories in [app.module.ts](./backend/src/app.module.ts)


![Backend architecture](backend/diagrams/architecture.png)


## How it works (generalised)
1.  A new repository is analysed via the `POST /coverage/analyse` endpoint in the [API controller](./backend/src/infrastructure/http/api.controller.ts).
    - First, the request is validated, and ensures that this repository is not already being tracked.
    - This controller then calls the [AnalyseCoverageUseCase](./backend/src/application/use-cases/analyse-coverage.usecase.ts) application service.
        - This prepares the repository, via the [RepoPreparer](./backend/src/application/ports/repo-preparer.ts) port.
            - The [FileSystemRepoPreparer](./backend/src/infrastructure/github/fs-repo.preparer.ts) implementation clones the repository into a local workspace.
            - If fork mode is enabled, it also creates a fork of the repository on Github into the configured fork account or organisation.
            - The [RepoPreparer](./backend/src/application/ports/repo-preparer.ts) port returns a domain entity representing the prepared repository.
        - Next, the [CoverageScanner](./backend/src/domain/services/coverage-scanner.ts) port is called to scan the prepared repository for TypeScript coverage.
            - The [LocalTsCoverageScanner](./backend/src/infrastructure/coverage/local-ts-coverage-scanner.ts) implementation first looks for an existing coverage summary file in the repository workspace. If that file exists, it reads the coverage data from there. If not, it falls back to traversing the repository directory tree, respecting the `tsconfig.json` include/exclude configuration. If no `tsconfig.json` is found, it performs a DFS traversal of the entire repo, skipping hidden directories, dependencies, etc.
    - The [AnalyseCoverageUseCase](./backend/src/application/use-cases/analyse-coverage.usecase.ts) then returns the prepared repository and the list of coverage files to the API controller.
    - Finally, the API controller returns the repository and coverage files to the client.
2. A new improvement job is created via the `POST /jobs` endpoint in the [API controller](./backend/src/infrastructure/http/api.controller.ts)
    - First, the request is validated, and ensures that the repository is being tracked.
    - This controller then calls the [StartImprovementUseCase](./backend/src/application/use-cases/start-improvement.usecase.ts) application service.
        - This creates a new [ImprovementJob](./backend/src/domain/entities/improvement-job.entity.ts) entity in the database job queue, with status `QUEUED`.
    - The new job is returned to the client.
    
3. The [DbJobQueue](./backend/src/infrastructure/queue/db-job-queue.queue.ts) background worker continously scans for queued jobs, and processes them. To avoid two agent concurrently working on the same local clone of a repository, the queue only processes one job per repository at a time.
    - The queue calls the [ProcessJobUseCase](./backend/src/application/use-cases/process-job.usecase.ts) application service to process each job.
        - First, the job is validated to ensure it points to a valid repository, and the repository is up to date with the remote origin.
        - Next, it calls the [AiRunner](./backend/src/application/ports/ai-runner.ts) port to run an AI agent to execute the job.
            - The [SimpleAiRunner](./backend/src/infrastructure/ai/simple-ai.runner.ts) implementation of this port uses the codex CLI as well as the GitHub CLI and git commands to run the agent, committing the changes to a new branch in the local repository, pushing them upstream to a remote named 'origin', and finally creating a pull request, returning the newly created PR URL.
            - The prompt for the AI agent is constructed from a markdown template in [AGENTS.ts-coverage-improver.md](./backend/src/infrastructure/ai/AGENTS.ts-coverage-improver.md) file, with placeholders for the target file to increase coverage for, and the name and JSON format of the coverage summary file to either create or update.
            - Shell commands are executed using Node.js child processes, and the output is captured and stored in the job log.
        - After the [AiRunner](./backend/src/application/ports/ai-runner.ts) completes, the job status is updated to `COMPLETED` or `FAILED` based on the result, and the PR URL if applicable.

### API
- `GET /health`: Health check
    - Response: `{ ok: true }`.
- `POST /coverage/analyse`: Track and scan a new repository
    - Body: `{ repoUrl }` (GitHub URL, https and default branch only).  
    - Response `{ repository, coverageFiles }`
- `GET /repositories/:id/coverage`: Rescans a tracked repository 
    - Path `id`: repository id of the repository to return coverage for. 
    - Response: `{ repository, coverageFiles }` 
- `GET /jobs`: Get all jobs
    - Response `ImprovementJob[]`
- `Get /jobs/:id`: Get all jobs for a repository
    - Path `id`: the repository id to get jobs for
    - Response: `ImprovementJob[]`
- `POST /jobs`: Start a new improvement job for a tracked repository
    - Body: `{ repoId, filePath }`
    - Response: `ImprovementJob`
- `GET /repositories`: List all tracked repositories
    - Response: `RepositorySummaryDto[]`
- `GET /repositories/:id`: Get a tracked repository
    - Path: `id`: the repository id.
    - Response: `RepositoryDto`


### Key concepts and components

- [FsRepoPreparer](./backend/src/infrastructure/github/fs-repo.preparer.ts):
    - Invoked when analysing a new repository.
    - Clones the repository into a local workspace under `./.workspace/<hash>`, where `<hash>` is a MD5 hash of the repository owner and name, as well as the global fork parameters configured when the service starts.
    - If fork mode is enabled, it forks the repository into the configured fork account or organisation, and clones the fork instead.
- [LocalTsCoverageScanner](./backend/src/infrastructure/coverage/local-ts-coverage-scanner.ts):
    - Invoked when analysing a new repository andscanning an existing one.
    - First looks for an existing coverage summary file in the repository workspace under the name `ts-coverage-improver.summary.json`. If that file exists, it attempts to parse it to the known format, and extract the list of TypeScript files and their coverage percentages.
    - If no coverage summary file is found, it looks for a `tsconfig.json` file in the repository root. If found, it parses that file using the `typescript` package and extract the list of typescript source files from there.
    - If no `tsconfig.json` is found, it performs a DFS traversal of the entire repo, skipping hidden directories, dependencies, etc.
    - If no `ts-coverage-improver.summary.json` file is found, all source files are assumed to have 0% coverage.
- [SimpleAiRunner](./backend/src/infrastructure/ai/simple-ai.runner.ts):
    - Invoked when processing an improvement job to increase test coverage for a specific file.
    - Uses the codex CLI to run an AI agent based on the prompt template in [AGENTS.ts-coverage-improver.md](./backend/src/infrastructure/ai/AGENTS.ts-coverage-improver.md).
- [DbJobQueue](./backend/src/infrastructure/queue/db-job-queue.queue.ts):
    - Background worker that continuously scans for queued jobs, and processes them asynchronously (to avoid blocking the event loop), but only one job per repository at a time.
    - Invokes the [ProcessJobUseCase](./backend/src/application/use-cases/process-job.usecase.ts) application service to process each job.

### React dashboard

- Located in [`frontend/src/App.tsx`](./frontend/src/App.tsx).
- The basic layout is
    - A top level input to paste a repo URL and run coverage analysis
    - A three tab layout that makes up the main body of the page
        - Repositories tab: lists all tracked repositories with job counts, and buttons to select a repository or refresh the displayed coverage/jobs data for that repository.
        - Jobs tab: lists all jobs for the selected repository, with live updates on status, progress, output logs, and PR links.
- **[Screenshots and demos](#screenshots-and-demos) are included at the bottoms of this file.**

### Fork mode
 - Fork mode is a global setting that can be configured via environment variables when starting the service. It controls whether repositories are forked into a specified account or organisation before analysis.
 - Fork mode can be used as a safety mechanism or sandbox environment to avoid pushing branches and pull requests directly to the original repository whilst the prompt/agent behavior is being developed and tested.
 - Pull requests created from repositories analysed in fork mode will target the forked repository, not the original one.
 - However, repositories analysed in fork mode do not automatically resync with the original repository. If the original repository changes, the local clone of the forked repository must be manually synced if that is desired.\
- The way fork mode is implemented currently is not ideal, and could be improved. See the [Limitations and areas for improvement](#limitations-and-areas-for-improvement) section below for more details.

 #### Coverage sumamry file format
 The `ts-coverage-improver.summary.json` coverage summary file must be in the following format:
 ```json
 {
     "src/file1.ts": {
       "coveragePct": 75
     },
     "src/file2.ts": {
       "coveragePct": 42
     }
 }
 ```

#### OpenAI/Codex configursation

- The [SimpleAiRunner](./backend/src/infrastructure/ai/simple-ai.runner.ts) uses the codex CLI to run AI agents, and so requires the codex CLI to be installed and configured. This service authenticates to the codex API using an OpenAI API key, that can be created [here](https://platform.openai.com/settings/organization/api-keys), and must either be 

- Set as an environment variable under they key `OPENAI_API_KEY` before starting the service
- Given in `~/.codex/auth.json` directly in the following format:
```json
{
  "OPENAI_API_KEY": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```
- Set in `.env` file in the root of the backend directory as `OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

- API Login to OpenAi is handle on app startup via [OpenAIConfig](./backend/src/infrastructure/config/openai.config.ts).

#### GitHub configuration

- The [EnsureRepositoryUseCase](./backend/src/application/use-cases/ensure-repository.usecase.ts) and [SimpleAiRunner](./backend/src/infrastructure/ai/simple-ai.runner.ts) both interact with GitHub, and so require the GitHub CLI to be installed and configured. In some cases [Octokit REST](https://octokit.github.io/rest.js/v22) is also used, and so a GitHub access token with repo scope is also required. You can create a personal access token [here](https://github.com/settings/tokens).
    - This must be set the `.env` file in the root of the backend directory as `GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### Known issues
- Before the AI agent runs, the local repository should be on the default branch. The AI agent makes its changes on this branch, and then after it exits, the [SimpleAiRunner](./backend/src/infrastructure/ai/simple-ai.runner.ts) switches back to the default branch. However, if the program exits during the AI run, or the AI runner exits unexpectedly, the branch may not be reset back to the default branch, and subsequent jobs on the same repository will always fail. The branch must be reset manually in this case.
 
 
 #### Limitations and areas for improvement
- The `/analyse` API endpoiints runs synchronously, blocking the server from responding to other requests until it completes.
- Only supports https GitHub URLs on the default branch.
- Only supports TypeScript files (`*.ts`).
- Only supports publicly accessible GitHub repositories.
- Limited features in the dashboard 
    - No search, sort, filtering, pagination, etc.
- The dashboard could use websockets or streaming to get live updates on job progress, rather than polling, which would reduce latency and server load, and provide a better user experience.
- Output from codex task should form the body of the PR description.
- The 'Open Jobs' label in the dashbooard is ambiguous. It translates to 'running' jobs, but could be easily misinterpreted as 'queued' in the sense of 'not yet started'.
- No authentication or rate limiting on the API.
- Integration with existing code coverage tools:
    - At the moment, if no `ts-coverage-improver.summary.json` file is found, all source files are assumed to have 0% coverage.
    - Should integrate with NYC/Istanbul and parse the `coverage/coverage-summary.json` file created by `nyc` to get real coverage data.
- Error handling could be more robust and informative.
- No unit or integration tests.
- Unecessary console logging in some places.
- No pre-commit hooks or linting/formatting.
- Job logs could moe more informative, i.e with log levels, and showing the output of each command executed.
- Unecessary use of both [Octokit REST](https://octokit.github.io/rest.js/v22) and the [GitHub CLI](https://cli.github.com/) for GitHub interactions. Standardising to one or the other would reduce dependencies and configuration complexity.
- Unecessary dependencies may be present in the `package.json` files for both the backend and frontend.
- Repository functions could be more performant with better indexing and more optimised queries, especially when retrieving the next queued job for processing.
- Some API endpoints are unused and could be removed, for example `GET /jobs` (That returns all jobs for all repositories).
- Fork config is uneccessarilly comples. When a repository is forked, it should be persisted in the same format as other repositories, with the only requirement to store an extra field `forkedFrom` to indicate the original repository.
    - Currently, the `owner` and `repo` fields of a forked repository are incorrectly stored as the `owner` and `repo` of the original repository, and three extra fields (`isFork`, `forkOwner`, `forkOrg`) are persisted with each repository and to indicate the fork status and location.


## Screenshots and demos

- There are 3 main usages demonstrated below:
    1. Analysing a new repository (without a `ts-coverage-improver.summary.json` file) to start tracking it and get its coverage data (defauls to 0% coverage for all files if no summary file exists). [See screenhot here](#analyse-new-repo-img)
        - Start an improvement job for a specific file in that repository. [See screenshot here](#improve-coverage-img)
        - Manually approve the PR created by the AI agent running that job, meanwhile viewing live updates on the job progress.
            - [See PR created here](https://github.com/ts-coverage-improver/Typescript-Starter/pull/1)
            - [See screenshot of live job updates here](#job-live-updates-img)
            - [See screenshot here of the updated job status, job logs and PR link, once the job completes](#job-completed-img)
        - Refresh the coverage data for the repository to see the updated coverage for that file after merging the PR. [See screenshot here](#updated-coverage-img)
    2. Analysing a new repository (already with a `ts-coverage-improver.summary.json` file, but not tracked by this service) [See screenhot here](#analyse-existing-repo-img)
        - Scan the repository to get its coverage data from the existing summary file. [See screenshot here](#existing-coverage-data-img)

- The github reposoitories used in these demos are:
    1. [ts-coverage-improver/Typescript-Starter](https://github.com/ts-coverage-improver/Typescript-Starter)
        - Forked from [nea/Typescript-Starter](https://github.com/nea/Typescript-Starter)
    2. [ts-coverage-improver/ts-food](https://github.com/ts-coverage-improver/ts-food)
        - Contains an existing `ts-coverage-improver.summary.json` file with coverage data.
        - Forked from [NFS002/ts-food](https://github.com/NFS002/ts-food)

<a  href='./screenshots/analyse-new-repo.png' id="analyse-new-repo-img">Analysing a new repository</a>

![1) Analysing a new repository](screenshots/analyse-new-repo.png "Analysing a new repository")

--------

<a  href='./screenshots/improve-coverage.png' id="improve-coverage-img">Starting an improvement job for 'src/greeter.ts'</a>

![1a) Starting an improvement job for 'src/greeter.ts'](screenshots/improve-coverage.png "Starting an improvement job for 'src/greeter.ts'")

--------

<a href='./screenshots/job-live-updates.png' id="job-live-updates-img">Live job updates while the AI agent is running</a>

![1b) Live job updates while the AI agent is running](screenshots/job-live-updates.png "Live job updates while the AI agent is running")

--------

<a href='./screenshots/job-completed.png' id="job-completed-img">Job completed with PR link</a>

![1bi) Job completed with PR link](screenshots/job-completed.png "Job completed with PR link")

--------

<a  href='./screenshots/updated-coverage.png' id="updated-coverage-img">Viewing updated coverage after merging the PR</a>

![1c) Viewing updated coverage after merging the PR](screenshots/updated-coverage.png "Viewing updated coverage after merging the PR")

--------
<a  href='./screenshots/analyse-existing-repo.png' id="analyse-existing-repo-img">Analysing an existing repository with a coverage summary file</a>

![2) Analysing an existing repository already with with a coverage summary file](screenshots/analyse-existing-repo.png "Analysing an existing repositor already with a coverage summary file")

--------
<a  href='./screenshots/existing-coverage-data.png' id="existing-coverage-data-img">Viewing coverage data from existing summary file</a>

![2a) Viewing coverage data from existing summary file](screenshots/existing-coverage-data.png "Viewing coverage data from existing summary file")









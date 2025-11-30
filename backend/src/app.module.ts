import { Module } from '@nestjs/common';
import { ApiController } from './infrastructure/http/api.controller';
import { createDbClient, DbClient } from './infrastructure/config/database';
import { JobDrizzleRepository } from './infrastructure/repositories/job.drizzle.repository';
import { FileSystemRepoPreparer } from './infrastructure/github/fs-repo.preparer';
import { LocalTsCoverageScanner } from './infrastructure/coverage/istanbul-scanner';
import { SimpleAiRunner } from './infrastructure/ai/simple-ai.runner';
import { DryRunPullRequestService } from './infrastructure/github/dry-run.pr-service';
import { ProcessJobUseCase } from './application/use-cases/process-job.usecase';
import { StartImprovementUseCase } from './application/use-cases/start-improvement.usecase';
import { ListJobsUseCase } from './application/use-cases/list-jobs.usecase';
import { AnalyseCoverageUseCase } from './application/use-cases/analyse-coverage.usecase';
import { GetJobUseCase } from './application/use-cases/get-job.usecase';
import { InMemoryJobQueue } from './infrastructure/queue/in-memory.queue';
import { RepositoryDrizzleRepository } from './infrastructure/repositories/repository.drizzle.repository';
import { EnsureRepositoryUseCase } from './application/use-cases/ensure-repository.usecase';
import { ListRepositoriesUseCase } from './application/use-cases/list-repositories.usecase';
import { GetRepositoryUseCase } from './application/use-cases/get-repository.usecase';

@Module({
  controllers: [ApiController],
  providers: [
    {
      provide: 'DB_CLIENT',
      useFactory: () => createDbClient(),
    },
    {
      provide: JobDrizzleRepository,
      useFactory: (db: DbClient) => new JobDrizzleRepository(db),
      inject: ['DB_CLIENT'],
    },
    {
      provide: RepositoryDrizzleRepository,
      useFactory: (db: DbClient) => new RepositoryDrizzleRepository(db),
      inject: ['DB_CLIENT'],
    },
    {
      provide: FileSystemRepoPreparer,
      useFactory: () => new FileSystemRepoPreparer(undefined),
    },
    {
      provide: 'COVERAGE_SCANNER',
      useFactory: () => new LocalTsCoverageScanner(),
    },
    {
      provide: SimpleAiRunner,
      useFactory: () =>
        new SimpleAiRunner(process.env.AI_CLI_COMMAND || 'echo "Generated tests for {file}"'),
    },
    {
      provide: DryRunPullRequestService,
      useFactory: () => new DryRunPullRequestService(),
    },
    {
      provide: ProcessJobUseCase,
      useFactory: (
        repo: JobDrizzleRepository,
        repositoryRepo: RepositoryDrizzleRepository,
        preparer: FileSystemRepoPreparer,
        ai: SimpleAiRunner,
        pr: DryRunPullRequestService,
      ) => new ProcessJobUseCase(repo, repositoryRepo, preparer, ai, pr),
      inject: [JobDrizzleRepository, RepositoryDrizzleRepository, FileSystemRepoPreparer, SimpleAiRunner, DryRunPullRequestService],
    },
    {
      provide: InMemoryJobQueue,
      useFactory: (processor: ProcessJobUseCase, repo: JobDrizzleRepository) =>
        new InMemoryJobQueue(processor, repo),
      inject: [ProcessJobUseCase, JobDrizzleRepository],
    },
    {
      provide: StartImprovementUseCase,
      useFactory: (
        repo: JobDrizzleRepository,
        queue: InMemoryJobQueue,
      ) => new StartImprovementUseCase(repo, queue),
      inject: [JobDrizzleRepository, InMemoryJobQueue],
    },
    {
      provide: ListJobsUseCase,
      useFactory: (repo: JobDrizzleRepository) => new ListJobsUseCase(repo),
      inject: [JobDrizzleRepository],
    },
    {
      provide: AnalyseCoverageUseCase,
      useFactory: (prep: FileSystemRepoPreparer, scanner: LocalTsCoverageScanner) =>
        new AnalyseCoverageUseCase(prep, scanner),
      inject: [FileSystemRepoPreparer, 'COVERAGE_SCANNER'],
    },
    {
      provide: GetJobUseCase,
      useFactory: (repo: JobDrizzleRepository) => new GetJobUseCase(repo),
      inject: [JobDrizzleRepository],
    },
    {
      provide: EnsureRepositoryUseCase,
      useFactory: (repoRepo: RepositoryDrizzleRepository) =>
        new EnsureRepositoryUseCase(repoRepo),
      inject: [RepositoryDrizzleRepository],
    },
    {
      provide: ListRepositoriesUseCase,
      useFactory: (repoRepo: RepositoryDrizzleRepository, jobRepo: JobDrizzleRepository) =>
        new ListRepositoriesUseCase(repoRepo, jobRepo),
      inject: [RepositoryDrizzleRepository, JobDrizzleRepository],
    },
    {
      provide: GetRepositoryUseCase,
      useFactory: (repoRepo: RepositoryDrizzleRepository, jobRepo: JobDrizzleRepository) =>
        new GetRepositoryUseCase(repoRepo, jobRepo),
      inject: [RepositoryDrizzleRepository, JobDrizzleRepository],
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ApiController } from './infrastructure/http/api.controller';
import { createDbClient, DbClient, ForkModeConfig, GithubConfig } from './infrastructure/config';
import { JobDrizzleRepository } from './infrastructure/repositories/job.drizzle.repository';
import { FileSystemRepoPreparer } from './infrastructure/github/fs-repo.preparer';
import { LocalTsCoverageScanner } from './infrastructure/coverage/local-ts-coverage-scanner';
import { SimpleAiRunner } from './infrastructure/ai/simple-ai.runner';
import { ProcessJobUseCase } from './application/use-cases/process-job.usecase';
import { StartImprovementUseCase } from './application/use-cases/start-improvement.usecase';
import { ListJobsUseCase } from './application/use-cases/list-jobs.usecase';
import { AnalyseCoverageUseCase } from './application/use-cases/analyse-coverage.usecase';
import { GetJobUseCase } from './application/use-cases/get-job.usecase';
import { DbJobQueue } from './infrastructure/queue/db-job-queue.queue';
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
      provide: 'GH_CONFIG',
      useFactory: () => new GithubConfig(),
    },
    {
      provide: 'FORK_CONFIG',
      useFactory: () => new ForkModeConfig(),
    },
    {
      provide: JobDrizzleRepository,
      useFactory: (db: DbClient) => new JobDrizzleRepository(db),
      inject: ['DB_CLIENT'],
    },
    {
      provide: RepositoryDrizzleRepository,
      useFactory: (db: DbClient, forkMode: ForkModeConfig) => new RepositoryDrizzleRepository(db, forkMode),
      inject: ['DB_CLIENT', 'FORK_CONFIG'],
    },
    {
      provide: FileSystemRepoPreparer,
      useFactory: (forkMode: ForkModeConfig, ghConfig: GithubConfig) => new FileSystemRepoPreparer(forkMode, ghConfig),
      inject: ['FORK_CONFIG', 'GH_CONFIG'],
    },
    {
      provide: 'COVERAGE_SCANNER',
      useFactory: () => new LocalTsCoverageScanner(),
    },
    {
      provide: SimpleAiRunner,
      useFactory: () => new SimpleAiRunner(),
    },
    {
      provide: ProcessJobUseCase,
      useFactory: (
        repo: JobDrizzleRepository,
        repositoryRepo: RepositoryDrizzleRepository,
        ai: SimpleAiRunner,
      ) => new ProcessJobUseCase(repo, repositoryRepo, ai),
      inject: [JobDrizzleRepository, RepositoryDrizzleRepository, SimpleAiRunner],
    },
    {
      provide: DbJobQueue,
      useFactory: (processor: ProcessJobUseCase, repo: JobDrizzleRepository) =>
        new DbJobQueue(processor, repo),
      inject: [ProcessJobUseCase, JobDrizzleRepository],
    },
    {
      provide: StartImprovementUseCase,
      useFactory: (
        repo: JobDrizzleRepository,
        queue: DbJobQueue,
      ) => new StartImprovementUseCase(repo, queue),
      inject: [JobDrizzleRepository, DbJobQueue],
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
      useFactory: (repoRepo: RepositoryDrizzleRepository, forkConfig: ForkModeConfig, ghConfig: GithubConfig) =>
        new EnsureRepositoryUseCase(repoRepo, forkConfig, ghConfig),
      inject: [RepositoryDrizzleRepository, 'FORK_CONFIG', 'GH_CONFIG'],
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

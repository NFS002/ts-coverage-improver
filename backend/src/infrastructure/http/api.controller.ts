import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z, ZodError } from 'zod';
import { AnalyseCoverageUseCase } from '../../application/use-cases/analyse-coverage.usecase';
import { StartImprovementUseCase } from '../../application/use-cases/start-improvement.usecase';
import { ListJobsUseCase } from '../../application/use-cases/list-jobs.usecase';
import { GetJobUseCase } from '../../application/use-cases/get-job.usecase';
import { CreateJobRequest } from './dto/create-job.request';
import { EnsureRepositoryUseCase } from '../../application/use-cases/ensure-repository.usecase';
import { ListRepositoriesUseCase } from '../../application/use-cases/list-repositories.usecase';
import { RepositorySummaryDto } from '../../application/dto/repository-summary.dto';
import { GetRepositoryUseCase } from '../../application/use-cases/get-repository.usecase';
import { destructureGithubSshUrl, GITHUB_HTTPS_URL_REGEX, httpsToSshUrl } from '@utils';

@Controller()
export class ApiController {
  constructor(
    private readonly analyseCoverage: AnalyseCoverageUseCase,
    private readonly startImprovement: StartImprovementUseCase,
    private readonly listJobs: ListJobsUseCase,
    private readonly getJob: GetJobUseCase,
    private readonly ensureRepository: EnsureRepositoryUseCase,
    private readonly listRepositories: ListRepositoriesUseCase,
    private readonly getRepository: GetRepositoryUseCase,
  ) { }

  @Get('/health')
  health() {
    return { ok: true };
  }

  /* Analyse coverage endpoints */
  @Post('/coverage/analyse')
  async analyseCoverageForUrl(@Body() body: { repoUrl?: string }) {
    const { repoUrl: httpsUrl } = parseWithZod(repoUrlSchema, body);
    // Check if a repository record exists for the same url
    const sshUrl = httpsToSshUrl(httpsUrl);
    const repoDao = await this.getRepository.findByUrls({ httpsUrl, sshUrl });
    if (repoDao) {
      throw new BadRequestException('Repository already exists');
    }
    const { owner, repo } = destructureGithubSshUrl(sshUrl);
    const remoteRepository = await this.ensureRepository.getRemoteRepository({ owner, repo });
    if (!remoteRepository) {
      throw new BadRequestException('Repository does not exist or is inaccessible');
    }
    const repository = await this.ensureRepository.createRepository({ httpsUrl, sshUrl });
    try {
      const files = await this.analyseCoverage.execute({
        owner,
        repo,
      });
      return { repository, files };
    } catch (err) {
      console.error("Error analysing coverage: ", err);
      throw new BadRequestException('Unable to analyse coverage');
    }
  }

  @Get('/repositories/:id/coverage')
  async coverageForRepository(@Param('id') id: string) {
    const repository = await this.getRepository.execute(id);
    if (!repository) {
      throw new BadRequestException('Repository not found');
    }
    try {
      const { owner, repo } = destructureGithubSshUrl(repository.sshUrl);
      const files = await this.analyseCoverage.execute({
        owner,
        repo,
      });
      return { repository, files };
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Unable to analyse coverage');
    }
  }

  @Get('/jobs')
  async jobs(@Query('repoId') repoId?: string) {
    const jobs = await this.listJobs.execute(repoId);
    const repositoryMap = repoId
      ? new Map<string, RepositorySummaryDto | undefined>([
        [repoId, (await this.getRepository.execute(repoId)) ?? undefined],
      ])
      : new Map<string, RepositorySummaryDto | undefined>(
        (await this.listRepositories.execute()).map((r) => [r.id, r]),
      );

    return jobs.map((job) => {
      const repo = repositoryMap.get(job.repoId);
      return mapJob(job, repo);
    });
  }

  @Get('/jobs/:id')
  async job(@Param('id') id: string) {
    const job = await this.getJob.execute(id);
    if (!job) {
      throw new BadRequestException('Job not found');
    }
    const repo = await this.getRepository.execute(job.repoId);
    return mapJob(job, repo);
  }

  @Post('/jobs')
  async createJob(@Body() body: CreateJobRequest) {
    const parsed = parseWithZod(createJobSchema, body);
    const repository = await this.resolveRepository(parsed);
    try {
      const job = await this.startImprovement.execute({
        repoId: repository.id,
        filePath: parsed.filePath,
      });
      return mapJob(job, repository);
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Unable to create job');
    }
  }

  @Get('/repositories')
  async repositories() {
    const repos = await this.listRepositories.execute();
    return repos.map(mapRepository);
  }

  @Get('/repositories/:id')
  async repository(@Param('id') id: string) {
    const repo = await this.getRepository.execute(id);
    if (!repo) {
      throw new BadRequestException('Repository not found');
    }
    return mapRepository(repo);
  }

  private async resolveRepository(input: { repoId?: string; repoUrl?: string }): Promise<RepositorySummaryDto> {
    const { repoId, repoUrl } = input;
    if (repoId) {
      const repo = await this.getRepository.execute(repoId);
      if (!repo) {
        throw new BadRequestException('Repository not found');
      }
      return repo;
    }
    const sshUrl = httpsToSshUrl(repoUrl!);
    const ensured = await this.ensureRepository.execute({
      httpsUrl: repoUrl!,
      sshUrl,
    });
    const repoWithStats =
      (await this.getRepository.execute(ensured.id)) ??
      {
        id: ensured.id,
        httpsUrl: ensured.httpsUrl,
        sshUrl: ensured.sshUrl,
        createdAt: ensured.createdAt,
        updatedAt: ensured.updatedAt,
        openJobs: 0,
        queuedJobs: 0,
        totalJobs: 0,
      };
    return repoWithStats;
  }
}

const mapJob = (job: any, repo?: RepositorySummaryDto | null | undefined) => ({
  id: job.id,
  repoId: repo?.id ?? job.repoId,
  repoUrl: repo?.httpsUrl ?? null,
  repoSshUrl: repo?.sshUrl ?? null,
  filePath: job.filePath,
  status: job.status,
  prUrl: job.prUrl,
  log: job.log,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
});

const mapRepository = (repo: RepositorySummaryDto) => ({
  id: repo.id,
  httpsUrl: repo.httpsUrl,
  sshUrl: repo.sshUrl,
  createdAt: repo.createdAt,
  updatedAt: repo.updatedAt,
  openJobs: repo.openJobs,
  queuedJobs: repo.queuedJobs,
  totalJobs: repo.totalJobs,
});

const repoUrlSchema = z.object({
  repoUrl: z.string().regex(GITHUB_HTTPS_URL_REGEX, {
    error: 'repoUrl must be a valid git URL (https only)',
  }),
});

const repoIdentifierSchema = z
  .object({
    repoId: z.uuid().optional(),
    repoUrl: repoUrlSchema.shape.repoUrl.optional(),
  })
  .refine(
    (value) => typeof value.repoId === 'string' || typeof value.repoUrl === 'string',
    'Either repoId or repoUrl is required',
  );

const createJobSchema = repoIdentifierSchema.safeExtend({
  filePath: z
    .string({ error: 'filePath is required' })
    .trim()
    .min(1, 'filePath is required'),
});

const parseWithZod = <T>(schema: z.ZodSchema<T>, payload: unknown): T => {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map((i) => i.message).join('; ');
      throw new BadRequestException(message);
    }
    throw error;
  }
};

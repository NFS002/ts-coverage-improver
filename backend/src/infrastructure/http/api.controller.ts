import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { file, z, ZodError } from 'zod';
import { AnalyseCoverageUseCase } from '../../application/use-cases/analyse-coverage.usecase';
import { StartImprovementUseCase } from '../../application/use-cases/start-improvement.usecase';
import { ListJobsUseCase } from '../../application/use-cases/list-jobs.usecase';
import { GetJobUseCase } from '../../application/use-cases/get-job.usecase';
import { CreateJobRequest } from './dto/create-job.request';
import { EnsureRepositoryUseCase } from '../../application/use-cases/ensure-repository.usecase';
import { ListRepositoriesUseCase } from '../../application/use-cases/list-repositories.usecase';
import { RepositorySummaryDto } from '../../application/dto/repository-summary.dto';
import { GetRepositoryUseCase } from '../../application/use-cases/get-repository.usecase';
import { destructureGitHubHttpsUrl, GITHUB_HTTPS_URL_REGEX } from '@utils';
import { CoverageFile } from 'domain/entities/coverage-file.entity';
import { ImprovementJob } from 'domain/entities/improvement-job.entity';

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

  /* Analyse coverage for a new remote repository */
  @Post('/coverage/analyse')
  async analyseCoverageForUrl(@Body() body: { repoUrl?: string }) {
    console.info("Received request to analyse coverage: ");
    const { repoUrl: httpsUrl } = parseWithZod(repoUrlSchema, body);
    const destructured = destructureGitHubHttpsUrl(httpsUrl)
    // Check if a repository record exists for the same url
    const repoDao = await this.getRepository.findByOwnerAndName(destructured);
    if (repoDao) {
      throw new BadRequestException('Repository already exists');
    }
    const remoteRepository = await this.ensureRepository.getRemoteRepository(destructured);
    if (!remoteRepository) {
      throw new BadRequestException('Repository does not exist or is inaccessible');
    }
    try {
      const {
        repository: repositoryDao,
        files: coverageFiles,
      } = await this.analyseCoverage.prepareAndScan(destructured);
      const normalisedFiles = coverageFiles.map(file => {
        const normalisedPath = file.filePath.replace(repositoryDao.path + '/', '');
        return new CoverageFile(normalisedPath, file.coveragePct, file.include);
      });
      const repository = await this.ensureRepository.createRepository(repositoryDao);
      return { repository, files: normalisedFiles };
    } catch (err) {
      console.error("Error analysing coverage: ", err);
      throw new BadRequestException('Unable to analyse coverage');
    }
  }

  /* Rescan a previously analysed repository and return coverage files */
  @Get('/repositories/:id/coverage')
  async coverageForRepository(@Param('id') id: string) {
    const repositoryDao = await this.getRepository.findById(id);
    if (!repositoryDao) {
      throw new BadRequestException('Repository not found');
    }
    try {
      const rawCoverageFiles = await this.analyseCoverage.scan(repositoryDao.path);
      const normalisedFiles = rawCoverageFiles.map(file => {
        const normalisedPath = file.filePath.replace(repositoryDao.path + '/', '');
        const f = new CoverageFile(normalisedPath, file.coveragePct, file.include);
        console.info("Normalised file: ", {
          original: file,
          normalised: f,
        });
        return f
      });
      return { repository: repositoryDao, files: normalisedFiles };
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Unable to analyse coverage');
    }
  }

  @Get('/jobs')
  async jobs(@Query('repoId') repoId?: string) {
    const jobs = await this.listJobs.execute(repoId);
    // const repositoryMap = repoId
    //   ? new Map<string, RepositorySummaryDto | undefined>([
    //     [repoId, (await this.getRepository.execute(repoId)) ?? undefined],
    //   ])
    //   : new Map<string, RepositorySummaryDto | undefined>(
    //     (await this.listRepositories.execute()).map((r) => [r.id, r]),
    //   );

    // return jobs.map((job) => {
    //   const repo = repositoryMap.get(job.repoId);
    //   return mapJob(job);
    // });
    return jobs.map(mapJob);
  }

  @Get('/jobs/:id')
  async job(@Param('id') id: string) {
    const job = await this.getJob.execute(id);
    if (!job) {
      throw new BadRequestException('Job not found');
    }
    //const repo = await this.getRepository.execute(job.repoId);
    return mapJob(job);
  }

  @Post('/jobs')
  async createJob(@Body() body: CreateJobRequest) {
    const { repoId, filePath } = parseWithZod(createJobSchema, body);
    const repository = await this.getRepository.findById(repoId);
    if (!repository) {
      throw new BadRequestException('Repository not found');
    }
    try {
      const job = await this.startImprovement.execute(repository, filePath);
      return mapJob(job);
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Unable to create job');
    }
  }

  @Get('/repositories')
  async repositories() {
    return await this.listRepositories.execute();
  }

  @Get('/repositories/:id')
  async repository(@Param('id') id: string) {
    const repo = await this.getRepository.execute(id);
    if (!repo) {
      throw new BadRequestException('Repository not found');
    }
    return repo;
  }
}

const mapJob = (job: ImprovementJob) => ({
  id: job.id,
  repoId: job.repoId,
  filePath: job.filePath,
  status: job.status,
  prUrl: job.prUrl,
  log: job.log,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
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

const createJobSchema = z.object({
  repoId: z.uuid({
    message: 'repoId is required and must be a valid UUID',
  }),
  filePath: z.string().min(1, { message: 'filePath is required' }),
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

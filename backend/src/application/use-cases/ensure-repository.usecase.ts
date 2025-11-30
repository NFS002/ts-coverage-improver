import { v4 as uuid } from 'uuid';
import { RepositoryRepository } from '../../domain/repositories/repository.repository';
import { Repository } from '../../domain/entities/repository.entity';
import type { OctokitResponse } from "@octokit/types";
import type { components } from "@octokit/openapi-types";
import { ForkModeConfig, GithubConfig } from 'infrastructure/config';

type ReposGetResponseData = components["schemas"]["full-repository"];
type ReposGetResponse = OctokitResponse<ReposGetResponseData>;

export class EnsureRepositoryUseCase {

  constructor(private readonly repositoryRepo: RepositoryRepository, private readonly forkConfig: ForkModeConfig, private readonly ghConfig: GithubConfig) {}

  // async createRepositoryOld(params: { repo: string; owner: string }): Promise<Repository> {
  //   const { repo, owner } = params;
  //   const now = new Date();
  //   const { enabled: forkEnabled, owner: forkOwner, org: forkOrg } = this.forkConfig
  //   const repositoryDao = new Repository({
  //     id: uuid(),
  //     repo,
  //     owner,
  //     forkMode: forkEnabled,
  //     forkOwner,
  //     forkOrg,
  //     updatedAt: now,
  //     createdAt: now
  //   })
  //   await this.repositoryRepo.save(repositoryDao);
  //   return repositoryDao;
  // }

  async createRepository(repositoryDao: Repository): Promise<Repository> {
    await this.repositoryRepo.save(repositoryDao);
    return repositoryDao;
  }

  async getRemoteRepository(params: {
    owner: string;
    repo: string;
  }): Promise<ReposGetResponse | null> {
    try {
      const client = this.ghConfig.gitClient;
      return await client.repos.get(params);
    }
    catch (error) {
      console.error("Error fetching remote repository: ", error);
      return null;
    }
  }
}
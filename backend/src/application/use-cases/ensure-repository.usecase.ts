import { v4 as uuid } from 'uuid';
import { RepositoryRepository } from '../../domain/repositories/repository.repository';
import { Repository } from '../../domain/entities/repository.entity';
import { Octokit } from '@octokit/rest';
import type { OctokitResponse } from "@octokit/types";
import type { components } from "@octokit/openapi-types";
import { BadRequestException } from '@nestjs/common';

type ReposGetResponseData = components["schemas"]["full-repository"];
type ReposGetResponse = OctokitResponse<ReposGetResponseData>;

export class EnsureRepositoryUseCase {
  gitClient: Octokit;

  constructor(private readonly repositoryRepo: RepositoryRepository) {
    this.gitClient = new Octokit({
      userAgent: 'ts-coverage improve v1.0.0',
      auth: process.env.GITHUB_TOKEN,
    })
  }


  async execute(input: { httpsUrl: string; sshUrl: string }): Promise<Repository> {
    const { httpsUrl, sshUrl } = input;
    const existing =
      (await this.repositoryRepo.findByHttpsUrl(httpsUrl)) ||
      (await this.repositoryRepo.findBySshUrl(sshUrl));
    if (existing) {
      existing.touch();
      await this.repositoryRepo.save(existing);
      return existing;
    }
    const now = new Date();
    const repo = new Repository(uuid(), httpsUrl, sshUrl, now, now);
    await this.repositoryRepo.save(repo);
    return repo;
  }

  async createRepository(params: { httpsUrl: string; sshUrl: string }): Promise<Repository> {
    const { httpsUrl, sshUrl } = params;
    const now = new Date();
    const repo = new Repository(uuid(), httpsUrl, sshUrl, now, now);
    await this.repositoryRepo.save(repo);
    return repo;
  }

  async getRemoteRepository(params: {
    owner: string;
    repo: string;
  }): Promise<ReposGetResponse | null> {
    try {
      return await this.gitClient.repos.get(params);
    }
    catch (error) {
      console.error("Error fetching remote repository: ", error);
      return null;
    }
  }
}
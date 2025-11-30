import { RepoPreparer } from '../../application/ports/repo-preparer';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { toSshUrl } from '@utils'
import { ForkModeConfig, GithubConfig } from 'infrastructure/config';
import { Repository } from 'domain/entities/repository.entity';

export class FileSystemRepoPreparer implements RepoPreparer {
  private readonly forkConfig: ForkModeConfig;
  private readonly ghConfig: GithubConfig;
  private readonly baseDir: string;

  constructor(forkConfig: ForkModeConfig, ghConfig: GithubConfig) {
    this.baseDir = path.join(process.cwd(), '.workspace');
    this.forkConfig = forkConfig;
    this.ghConfig = ghConfig;

  }

  async prepare(params: { repo: string; owner: string; }): Promise<Repository> {
    const { repo, owner } = params;

    let cloneUrl: string = toSshUrl(repo, owner);

    const { enabled: forkMode, owner: forkOwner, org: forkOrg } = this.forkConfig;

    // Unique hash is used for the parent directory where the repo is cloned to
    const repoHash = crypto.createHash('md5')
      .update(`${owner}/${repo}/${forkMode}/${forkOwner || ''}/${forkOrg || ''}`)
      .digest('hex');

    // If 'FORK_MODE' fork the repository first, and use the fork URL for cloning
    if (forkMode) {
      const  gitClient = this.ghConfig.gitClient;
      const response = await gitClient.rest.repos.createFork({
        owner,
        repo,
        ...(forkOrg ? {
          organization: forkOrg
        } : {})
      })
      cloneUrl = response.data.ssh_url
      console.info("Sucessfully forked repository to: ", cloneUrl)
    }

    const repoDir = path.join(this.baseDir, repoHash);

    if (fs.existsSync(repoDir)) {
      throw new Error(`Repository already exists at path: ${repoDir}`);
    }

    fs.mkdirSync(this.baseDir, { recursive: true })

    console.info("Preparring to clone repository", {
      cloneUrl,
      repoDir
    })

    try {
      execSync(`git clone ${cloneUrl} ${repoDir}`, { stdio: 'inherit' });
    } catch {
      throw new Error('Repository does not exist or cannot be cloned. Please confirm the URL and access.');
    }
    const now = new Date();
    return new Repository({
      id: crypto.randomUUID(),
      owner,
      repo,
      forkMode,
      forkOwner,
      forkOrg,
      path: repoDir,
      updatedAt: now,
      createdAt: now,
    });
  }
}
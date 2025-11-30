import { RepoPreparer } from '../../application/ports/repo-preparer';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { destructureGithubSshUrl, toSshUrl } from '@utils'
import { Octokit } from '@octokit/rest';

export class FileSystemRepoPreparer implements RepoPreparer {
  private readonly baseDir: string;
  private readonly forkMode: boolean;
  private readonly forkOwner?: string;
  private readonly gitClient: Octokit
  private readonly forkOrg?: string

  constructor(baseDir: string = path.join(process.cwd(), '.workspace')) {
    this.baseDir = baseDir;
    this.forkMode = process.env.FORK_MODE === "true"
    this.forkOwner = process.env.FORK_OWNER
    this.forkOrg = process.env.FORK_ORG
    this.gitClient = new Octokit({
      userAgent: 'ts-coverage improve v1.0.0',
      auth: process.env.GITHUB_TOKEN,
    })

  }

  async prepare(params: { repo: string; owner: string; }): Promise<string> {
    const { repo, owner } = params;

    let cloneUrl: string = toSshUrl(repo, owner);

    // Unique hash is used for the parent directory where the repo is cloned to
    const repoHash = crypto.createHash('md5')
      .update(`${owner}/${repo}/${this.forkMode}/${this.forkOwner || ''}/${this.forkOrg || ''}`)
      .digest('hex');

    // If 'FORK_MODE' fork the repository first, and use the fork URL
    if (this.forkMode) {
      const response = await this.gitClient.rest.repos.createFork({
        owner,
        repo,
        ...(this.forkOrg ? {
          organization: this.forkOrg
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
    return repoDir;

  }
}
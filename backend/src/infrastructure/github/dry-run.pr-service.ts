import { PullRequestInfo, PullRequestService } from '../../application/ports/pr-service';

export class DryRunPullRequestService implements PullRequestService {

  forkMode: boolean
  forkOwner: string

  constructor() {
    this.forkMode = process.env.FORK_MODE === 'true'
    this.forkOwner = process.env.FORK_OWNER!

  }

  async openPullRequest(
    repoUrl: string,
    branchName: string,
    title: string,
    body: string,
  ): Promise<PullRequestInfo> {
    const targetRepo = this.resolveTargetRepo(repoUrl);
    const fakeId = Math.floor(Math.random() * 10000);
    const url = `${toWebUrl(targetRepo)}/pull/${fakeId}`;
    return { url, title: `${title} (dry-run on ${branchName})` };
  }

  private resolveTargetRepo(repoUrl: string): string {
    if (this.forkMode && this.forkOwner && isGithubUrl(repoUrl)) {
      return toForkSshUrl(repoUrl, this.forkOwner);
    }
    return repoUrl;
  }
}

const isGithubUrl = (url: string): boolean => /github\.com[:/]/i.test(url);

const toWebUrl = (repoUrl: string): string => {
  if (repoUrl.startsWith('git@')) {
    const match = repoUrl.match(/^git@([^:]+):(.+?)(\.git)?$/);
    if (match) {
      const path = match[2].replace(/^\/+/, '').replace(/\.git$/, '');
      return `https://${match[1]}/${path}`;
    }
  }
  return repoUrl.replace(/\.git$/, '');
};

const toForkSshUrl = (sshUrl: string, forkOwner: string): string => {
  const match = sshUrl.match(/^git@([^:]+):\/?([^/]+)\/(.+?)(\\.git)?$/);
  if (!match) return sshUrl;
  const [, host, , repo] = match;
  const repoName = repo.replace(/\\.git$/, '');
  return `git@${host}:${forkOwner}/${repoName}.git`;
};

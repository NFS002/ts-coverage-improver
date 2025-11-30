export interface PullRequestInfo {
  url: string;
  title: string;
}

export interface PullRequestService {
  openPullRequest(repoUrl: string, branchName: string, title: string, body: string): Promise<PullRequestInfo>;
}

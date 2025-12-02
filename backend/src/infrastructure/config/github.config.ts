import { Octokit } from "@octokit/rest";

export class GithubConfig {

    gitClient: Octokit;

    constructor() {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            console.error("GITHUB_TOKEN is not set, some commands may not work properly");
        }
        this.gitClient = new Octokit({
            userAgent: 'ts-coverage-improver v1.0.0',
            auth: token,
        })
    }
}
import fs from 'fs';
import path from 'path';

export const GITHUB_SSH_URL_REGEX = /^git@github\.com:\/?([^/]+)\/(.+?)(?:\.git)?$/

export const GITHUB_HTTPS_URL_REGEX = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:\.git)?(?:#)?$/;

// Assumes the input is already a valid github ssh url
export const destructureGithubSshUrl = (sshUrl: string): {
    owner: string,
    repo: string
} => {
    const match = sshUrl.match(GITHUB_SSH_URL_REGEX)
    if (!match) {
        throw new Error(`Error destructuring github ssh url: ${sshUrl}`)
    }
    return {
        owner: match[1],
        repo: match[2]
    }
}

// Destructure a github shh url to (owner, repo)
export function destructureGitHubHttpsUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(GITHUB_HTTPS_URL_REGEX);
  if (!match) return null;

  const [, owner, repo] = match;
  return { owner, repo };
}

// Assumes the input is already a valid github ssh url
export const destructureGithubHttpsUrl = (sshUrl: string): {
    owner: string,
    repo: string
} => {
    const match = sshUrl.match(GITHUB_SSH_URL_REGEX)
    if (!match) {
        throw new Error(`Error destructuring github ssh url: ${sshUrl}`)
    }
    return {
        owner: match[1],
        repo: match[2]
    }
}


export function httpsToSshUrl(githubUrl: string): string {
    const { pathname } = new URL(githubUrl);
    const repoPath = pathname.endsWith(".git") ? pathname : `${pathname}.git`;
    return `git@github.com:${repoPath}`;
}

export const toSshUrl = (repo: string, owner: string): string => `git@github.com:${owner}/${repo}.git`;




const toPathRegex = (path: string): RegExp => new RegExp(`${String.raw`(?:\/|^)${path}(?:\/|$)`}$`);

const INCLUDED_PATHS = [
    /^.*\.ts$/
];

// export const EXCLUDED_PATHS = [
//     /node_modules(?:\/|$)/,
//     /vendor(?:\/|$)/,
//     /dist(?:\/|$)/,
//     /build(?:\/|$)/,
//     /coverage(?:\/|$)/,
//     /bower_components(?:\/|$)/,
//     /jspm_packages(?:\/|$)/,
//     /^\./,
//     /\.d\.ts$/,
//     /\.spec\.ts$/,
//     /\.test\.ts$/
// ];

const EXCLUDED_PATHS = [
    toPathRegex("node_modules"),
    toPathRegex("vendor"),
    toPathRegex("dist"),
    toPathRegex("build"),
    toPathRegex("coverage"),
    toPathRegex("bower_components"),
    toPathRegex("jspm_packages"),
    /^\./,
    /\.d\.ts$/,
    /\.spec\.ts$/,
    /\.test\.ts$/
];

export const isExcludedPath = (path: string): boolean => EXCLUDED_PATHS.some((excluded) => excluded.test(path))


export const isIncludedPath = (path: string): boolean => INCLUDED_PATHS.some((excluded) => excluded.test(path))


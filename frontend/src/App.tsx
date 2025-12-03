import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import './App.css';
import type { Job } from './types/job';
import { JobCard } from './components.tsx/JobCard';

type CoverageFile = {
  filePath: string;
  coveragePct: number;
  include: boolean;
};

type Repository = {
  id: string;
  createdAt: string;
  updatedAt: string;
  openJobs: number;
  queuedJobs: number;
  totalJobs: number;
  owner?: string;
  repo?: string;
  forkMode?: boolean;
  forkOwner?: string | null;
  forkOrg?: string | null;
};

const GIT_URL_REGEX = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?(?:#)?$/;

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const repoSchema = z.object({
  repoUrl: z.string().regex(GIT_URL_REGEX, {
    error: 'Please enter a valid git repoistory URL (https only)'
  })
});
const createJobSchema = z.object({
  repoId: z.string({ error: 'repoId is required' }).uuid('repoId must be a valid UUID'),
  filePath: z.string({ error: 'filePath is required' }).trim().min(1, 'filePath is required'),
});

const toRepoLabel = (repo: Repository | null) => {
  if (repo?.owner && repo?.repo) return `${repo.owner}/${repo.repo}`;
  return repo?.id ?? 'Unknown repository';
};

const toRepoHttpsUrl = (repo: Repository) => {
  const owner = repo.forkMode ? (repo.forkOrg ?? repo.forkOwner) : repo.owner;
  return `https://github.com/${owner}/${repo.repo}.git`;
};

function App() {
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});
  const [repoUrl, setRepoUrl] = useState('https://github.com/nea/Typescript-Starter.git');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [coverageByRepo, setCoverageByRepo] = useState<Record<string, CoverageFile[]>>({});
  const [jobsByRepo, setJobsByRepo] = useState<Record<string, Job[]>>({});
  const [loadingRepositories, setLoadingRepositories] = useState(false);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'coverage' | 'jobs' | 'repositories'>('repositories');

  const selectedRepo = selectedRepoId
    ? repositories.find((repo) => repo.id === selectedRepoId) ?? null
    : null;
  const selectedRepoLabel = useMemo(() => toRepoLabel(selectedRepo), [selectedRepo]);
  const hasSelectedRepo = Boolean(selectedRepoId);
  const coverage = useMemo(
    () => (selectedRepoId ? coverageByRepo[selectedRepoId] ?? [] : []),
    [coverageByRepo, selectedRepoId],
  );
  const jobs = useMemo(
    () => (selectedRepoId ? jobsByRepo[selectedRepoId] ?? [] : []),
    [jobsByRepo, selectedRepoId],
  );
  const hasCoverageForRepo = selectedRepoId ? selectedRepoId in coverageByRepo : false;
  const hasJobsForRepo = selectedRepoId ? selectedRepoId in jobsByRepo : false;

  const lowCoverage = useMemo(
    () => coverage.filter((f) => f.coveragePct < 50),
    [coverage],
  );

  const upsertRepository = useCallback((repo: Partial<Repository> & { id: string }) => {
    setRepositories((prev) => {
      const existing = prev.find((r) => r.id === repo.id);
      const merged: Repository = {
        id: repo.id,
        createdAt: repo.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
        updatedAt: repo.updatedAt ?? existing?.updatedAt ?? new Date().toISOString(),
        openJobs: repo.openJobs ?? existing?.openJobs ?? 0,
        queuedJobs: repo.queuedJobs ?? existing?.queuedJobs ?? 0,
        totalJobs: repo.totalJobs ?? existing?.totalJobs ?? 0,
        owner: repo.owner ?? existing?.owner,
        repo: repo.repo ?? existing?.repo,
        forkMode: repo.forkMode ?? existing?.forkMode,
        forkOwner: repo.forkOwner ?? existing?.forkOwner ?? null,
        forkOrg: repo.forkOrg ?? existing?.forkOrg ?? null,
      };

      if (existing) {
        return prev.map((r) => (r.id === repo.id ? merged : r));
      }
      return [...prev, merged];
    });
  }, []);

  // No need to wrap in useCallback - as this should only be called once on load
  const loadRepositories = async () => {
    setLoadingRepositories(true);
    try {
      const res = await fetch(`${apiBase}/repositories`);
      if (!res.ok) {
        const message = (await extractFetchError(res)) ?? 'Failed to load repositories';
        throw new Error(message);
      }
      const repositories: Repository[] = await res.json();
      // Append repositories only to local state.
      // React hooks are called twice in strict mode, so avoid duplications

      repositories.forEach((repo) => {
        setRepositories((prev) => {
          if (prev.find((r) => r.id === repo.id)) {
            return prev;
          }
          return [...prev, repo];
        });
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load repositories';
      setError(message);
    } finally {
      setLoadingRepositories(false);
    }
  }

  const refreshRepository = async (repoId: string) => {
    try {
      const res = await fetch(`${apiBase}/repositories/${repoId}`);
      if (!res.ok) {
        const message = (await extractFetchError(res)) ?? 'Failed to refresh repository';
        throw new Error(message);
      }
      const repo: Repository = await res.json();
      upsertRepository(repo);
      await loadJobsForRepo(repoId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to refresh repository';
      setError(message);
    }
  };

  const loadCoverage = useCallback(async (opts?: { repoId?: string; repoUrlOverride?: string }) => {
    const hasUrlOverride = typeof opts?.repoUrlOverride === 'string';
    const targetRepoId = opts?.repoId ?? (hasUrlOverride ? undefined : selectedRepoId);
    const targetRepoUrl = hasUrlOverride ? opts?.repoUrlOverride ?? '' : repoUrl;

    setError(null);
    setLoadingCoverage(true);
    try {
      let res: Response;
      if (targetRepoId) {
        res = await fetch(`${apiBase}/repositories/${encodeURIComponent(targetRepoId)}/coverage`);
      } else {
        const validation = repoSchema.safeParse({ repoUrl: targetRepoUrl });
        if (!validation.success) {
          setError(validation.error.issues.map((i) => i.message)[0]);
          return;
        }
        const normalizedUrl = validation.data.repoUrl;
        setRepoUrl(normalizedUrl);
        res = await fetch(`${apiBase}/coverage/analyse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl: normalizedUrl }),
        });
      }
      if (!res.ok) {
        const message = (await extractFetchError(res)) ?? 'Failed to load coverage';
        throw new Error(message);
      }
      const json = await res.json();
      const repo: Repository = json.repository;
      const files: CoverageFile[] = json.files?.filter((file: CoverageFile) => file.include) ?? [];
      upsertRepository(repo);
      setSelectedRepoId(repo.id);
      const derivedUrl = toRepoHttpsUrl(repo) ?? targetRepoUrl;
      if (derivedUrl) {
        setRepoUrl(derivedUrl);
      }
      setCoverageByRepo((prev) => ({ ...prev, [repo.id]: files }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoadingCoverage(false);
    }
  }, [repoUrl, selectedRepoId, upsertRepository]);


  const analyse = useCallback(async () => {
    await loadCoverage({ repoId: undefined, repoUrlOverride: repoUrl });
  }, [loadCoverage, repoUrl]);

  const loadJobsForRepo = useCallback(async (repoId: string) => {
    setLoadingJobs(true);
    try {
      const res = await fetch(`${apiBase}/jobs?repoId=${encodeURIComponent(repoId)}`);
      if (!res.ok) {
        const message = (await extractFetchError(res)) ?? 'Failed to load jobs';
        throw new Error(message);
      }
      const jobs: Job[] = await res.json();
      const repoIdx = repositories.findIndex((r) => r.id === repoId);
      setJobsByRepo((prev) => ({ ...prev, [repoId]: jobs }));
      if (repoIdx === -1) {
        console.warn(`Repository ${repoId} not found`, {
          repositories
        });
        return;
      }

      const { queuedJobs, openJobs } = jobs.reduce((acc, job) => {
        switch (job.status) {
          case 'queued':
            acc.queuedJobs += 1;
            break;
          case 'running':
            acc.openJobs += 1;
            break;
        }
        return acc;
      }, { queuedJobs: 0, openJobs: 0 });

      setRepositories((prev) => {
        const next = [...prev];
        next[repoIdx].openJobs = openJobs;
        next[repoIdx].queuedJobs = queuedJobs;
        next[repoIdx].totalJobs = jobs.length;
        return next;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load jobs';
      setError(message);
    } finally {
      setLoadingJobs(false);
    }
  }, [repositories, jobsByRepo]);

  const ensureRepoData = useCallback(async (repoId: string) => {
    if (!coverageByRepo[repoId]) {
      await loadCoverage({ repoId });
    }
    await loadJobsForRepo(repoId);
  }, [coverageByRepo, loadCoverage, loadJobsForRepo]);

  const refreshRepoData = useCallback(async (repoId: string) => {
    await loadCoverage({ repoId });
    await loadJobsForRepo(repoId);
  }, [coverageByRepo, loadCoverage, loadJobsForRepo]);

  const requestImprovement = async (filePath: string) => {
    setError(null);
    if (!selectedRepoId) {
      setError('Select a repository before creating a job');
      return;
    }
    const validation = createJobSchema.safeParse({ repoId: selectedRepoId, filePath });
    if (!validation.success) {
      setError(validation.error.issues.map((i) => i.message).join('; '));
      return;
    }

    const payload = {
      repoId: validation.data.repoId,
      filePath: validation.data.filePath,
    };
    const repoIdForJob = validation.data.repoId;

    try {
      const res = await fetch(`${apiBase}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const message = (await extractFetchError(res)) ?? 'Unable to create job';
        throw new Error(message);
      }
      const job: Job = await res.json();
      const repoKey = job.repoId ?? repoIdForJob;
      if (!repoKey) {
        return;
      }
      setJobsByRepo((prev) => ({
        ...prev,
        [repoKey]: [job, ...(prev[repoKey] ?? [])],
      }));
      setSelectedRepoId(repoKey);
      refreshRepository(repoKey);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to create job';
      setError(message);
    }
  };

  // Should only be called once on initial load, but called twice due to React strict mode
  // so ensure idempotency
  useEffect(() => {
    loadRepositories();
  }, []);


  /* Continously poll for job updates on the selected repository
  /* Only if there are any queued or running jobs */
  useEffect(() => {
    if (!selectedRepoId || loadingRepositories) return;
    const repo = repositories.find((r) => r.id === selectedRepoId);
    if (!repo) {
      console.warn(`Selected repo ID ${selectedRepoId} not found in repositories`);
      return;
    }
    const { queuedJobs, openJobs } = repo;
    if (queuedJobs === 0 && openJobs === 0) return;
    // Load coverage and jobs for selected repo
    ensureRepoData(selectedRepoId);
    const id = setInterval(() => {
      loadJobsForRepo(selectedRepoId);
    }, 3000);
    return () => clearInterval(id);
  }, [selectedRepoId, loadingJobs]);

  useEffect(() => {
    if (!hasSelectedRepo && activeTab !== 'repositories') {
      setActiveTab('repositories');
    }
  }, [activeTab, hasSelectedRepo]);

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">TS Coverage Improver</p>
          <h1>Watch coverage, fire off jobs, get PR links</h1>
          <p className="lede">
            Paste a repo URL, inspect low-coverage files, and trigger an automated improvement
            job. Progress updates and PR links land here as the worker runs.
          </p>
          <form
            className="input-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!loadingCoverage) {
                analyse();
              }
            }}
          >
            <input
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://github.com/your/repo.git"
            />
            <button className="primary" type="submit" disabled={loadingCoverage}>
              {loadingCoverage ? 'Scanning...' : 'Analyse coverage'}
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
      </header>

      <main className="panels">
        <div className="tab-bar" role="tablist" aria-label="Dashboard sections">
          <button
            id="repositories-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'repositories'}
            aria-controls="repositories-panel"
            className={`tab ${activeTab === 'repositories' ? 'active' : ''}`}
            onClick={() => setActiveTab('repositories')}
          >
            Repositories
          </button>
          <button
            id="coverage-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'coverage'}
            aria-controls="coverage-panel"
            className={`tab ${activeTab === 'coverage' ? 'active' : ''}`}
            disabled={!hasSelectedRepo}
            aria-disabled={!hasSelectedRepo}
            onClick={() => {
              if (!hasSelectedRepo) return;
              setActiveTab('coverage');
            }}
          >
            Coverage
          </button>
          <button
            id="jobs-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'jobs'}
            aria-controls="jobs-panel"
            className={`tab ${activeTab === 'jobs' ? 'active' : ''}`}
            disabled={!hasSelectedRepo}
            aria-disabled={!hasSelectedRepo}
            onClick={() => {
              if (!hasSelectedRepo) return;
              setActiveTab('jobs');
            }}
          >
            Jobs
          </button>
        </div>

        <section
          className={`panel ${activeTab === 'coverage' ? 'active' : 'hidden'}`}
          role="tabpanel"
          id="coverage-panel"
          aria-labelledby="coverage-tab"
          hidden={activeTab !== 'coverage'}
        >
          <div className="panel-header">
            <div>
              <h2>Coverage by file</h2>
              {selectedRepo &&
                <div className="muted small">
                  Repository: {selectedRepoLabel}
                  {selectedRepo.forkMode &&
                    <div className="repo-fork-info">
                      <div>
                        <i className="mono smaller">Forked for: {selectedRepo.forkOrg ?? selectedRepo.forkOwner}</i>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
            <div className="panel-header-actions">
              <span className="badge">Below 50%: {lowCoverage.length}</span>
              {selectedRepo && (
                <button
                  className="refresh-btn small-btn"
                  type="button"
                  aria-label="Refresh repository coverage"
                  title="Refresh repository coverage"
                  onClick={() => refreshRepoData(selectedRepo.id)}
                >
                  Refresh
                </button>
              )}
            </div>
          </div>
          {!selectedRepo && (
            <p className="muted">Select a repository from the Repositories tab or analyse a URL to load coverage.</p>
          )}
          {selectedRepo && loadingCoverage && <p className="muted">Loading coverage...</p>}
          {selectedRepo && !loadingCoverage && !hasCoverageForRepo && (
            <p className="muted">No coverage data for this repository yet. Run an analysis to populate this list.</p>
          )}
          {selectedRepo && hasCoverageForRepo && coverage.length === 0 && (
            <p className="muted">No coverage data yet. Run an analysis to populate this list.</p>
          )}
          {selectedRepo && coverage.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Coverage</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((file) => (
                  <tr key={file.filePath}>
                    <td className="mono">{file.filePath}</td>
                    <td>
                      <span className={`pill ${file.coveragePct < 80 ? 'danger' : ''}`}>
                        {file.coveragePct.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <button className="ghost" onClick={() => requestImprovement(file.filePath)}>
                        Improve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section
          className={`panel ${activeTab === 'repositories' ? 'active' : 'hidden'}`}
          role="tabpanel"
          id="repositories-panel"
          aria-labelledby="repositories-tab"
          hidden={activeTab !== 'repositories'}
        >
          <div className="panel-header">
            <div>
              <h2>Repositories</h2>
              <p className="muted small">Click a repository to load its coverage and jobs.</p>
            </div>
            <span className="badge subtle">{repositories.length}</span>
          </div>
          {loadingRepositories && <p className="muted">Loading repositories...</p>}
          {!loadingRepositories && repositories.length === 0 && (
            <p className="muted">No repositories yet. Analyse coverage to add one.</p>
          )}
          <div className="repo-grid">
            {repositories.map((repo) => (
              <article
                key={repo.id}
                className={`repo-card ${repo.id === selectedRepoId ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedRepoId(repo.id);
                  const derivedUrl = toRepoHttpsUrl(repo);
                  if (derivedUrl) {
                    setRepoUrl(derivedUrl);
                  }
                  ensureRepoData(repo.id);
                }}
              >
                <div className="repo-header">
                  <div>
                    <p className="mono small">{toRepoLabel(repo)}</p>
                  </div>
                  <button
                    className="refresh-btn small-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshRepoData(repo.id);
                    }}
                  >
                    Refresh
                  </button>
                </div>
                {repo.forkMode &&
                  <div className="repo-fork-info">
                    <div>
                      <i className="mono smaller">Forked for: {repo.forkOrg ?? repo.forkOwner}</i>
                    </div>
                  </div>
                }
                <div className="repo-stats">
                  <span className="pill subtle">Open: {repo.openJobs}</span>
                  <span className="pill subtle">Queued: {repo.queuedJobs}</span>
                  <span className="pill subtle">Total: {repo.totalJobs}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className={`panel ${activeTab === 'jobs' ? 'active' : 'hidden'}`}
          role="tabpanel"
          id="jobs-panel"
          aria-labelledby="jobs-tab"
          hidden={activeTab !== 'jobs'}
        >
          <div className="panel-header">
            <div>
              <h2>Jobs</h2>
              {selectedRepo &&
                <div className="muted small">
                  Repository: {selectedRepoLabel}
                  {selectedRepo.forkMode &&
                    <div className="repo-fork-info">
                      <div>
                        <i className="mono smaller">Forked for: {selectedRepo.forkOrg ?? selectedRepo.forkOwner}</i>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
            <div className="panel-header-actions">
              <span className="badge subtle">{jobs.length} total</span>
              {selectedRepo && (
                <button
                  className="refresh-btn small-btn"
                  type="button"
                  aria-label="Refresh repository jobs"
                  title="Refresh repository jobs"
                  onClick={() => refreshRepoData(selectedRepo.id)}
                >
                  Refresh
                </button>
              )}
            </div>
          </div>
          {!selectedRepo && <p className="muted">Select a repository to view jobs.</p>}
          {selectedRepo && loadingJobs && <p className="muted">Loading jobs…</p>}
          {selectedRepo && !loadingJobs && !hasJobsForRepo && (
            <p className="muted">Jobs for this repository have not been loaded yet.</p>
          )}
          {selectedRepo && hasJobsForRepo && jobs.length === 0 && (
            <p className="muted">No jobs yet. Start one by clicking on 'improve' on a file in the coverage tab.</p>
          )}
          {selectedRepo && jobs.length > 0 && (
            <div className="job-list">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isOpen={openLogs[job.id] ?? false}
                  onToggle={(open) => setOpenLogs((prev) => ({ ...prev, [job.id]: open }))}
                />
              ))}

            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

const extractFetchError = async (res: Response): Promise<string | null> => {
  try {
    const payload = await res.json();
    if (Array.isArray(payload?.message)) {
      return payload.message.join('; ');
    }
    return payload?.message || payload?.error || null;
  } catch {
    return null;
  }
};

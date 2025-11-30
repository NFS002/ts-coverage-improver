import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import './App.css';

type CoverageFile = {
  filePath: string;
  coveragePct: number;
};

type Job = {
  id: string;
  repoUrl?: string | null;
  repoSshUrl?: string | null;
  repoId?: string;
  filePath: string;
  status: string;
  prUrl?: string | null;
  log: string[];
  createdAt: string;
  updatedAt: string;
};

type RepositorySummary = {
  id: string;
  httpsUrl: string;
  sshUrl: string;
  createdAt: string;
  updatedAt: string;
  openJobs: number;
  queuedJobs: number;
  totalJobs: number;
};

const GIT_URL_REGEX = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?(?:#)?$/;

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const repoSchema = z.object({
  repoUrl: z.string().regex(GIT_URL_REGEX, {
    error: 'Please enter a valid git repoistory URL (https only)'
  })
});
const repoSelectorSchema = z
  .object({
    repoId: z.string().uuid().optional(),
    repoUrl: repoSchema.shape.repoUrl.optional(),
  })
  .refine((value) => Boolean(value.repoId || value.repoUrl), 'Select a repository or enter a URL');
const createJobSchema = repoSelectorSchema.safeExtend({
  filePath: z.string({ error: 'filePath is required' }).trim().min(1, 'filePath is required'),
});

function App() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/bitjson/typescript-starter.git');
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
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
    () => coverage.filter((f) => f.coveragePct < 80),
    [coverage],
  );

  const upsertRepository = useCallback((repo: RepositorySummary) => {
    setRepositories((prev) => {
      const idx = prev.findIndex((r) => r.id === repo.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = repo;
        return next;
      }
      return [...prev, repo];
    });
  }, []);

  const loadRepositories = useCallback(async () => {
    setLoadingRepositories(true);
    try {
      const res = await fetch(`${apiBase}/repositories`);
      if (!res.ok) {
        const message = (await extractFetchError(res)) ?? 'Failed to load repositories';
        throw new Error(message);
      }
      const json: RepositorySummary[] = await res.json();
      setRepositories(json);
      if (!selectedRepoId && json.length > 0) {
        setSelectedRepoId(json[0].id);
        setRepoUrl(json[0].httpsUrl);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load repositories';
      setError(message);
    } finally {
      setLoadingRepositories(false);
    }
  }, [selectedRepoId]);

  const refreshRepository = async (repoId: string) => {
    try {
      const res = await fetch(`${apiBase}/repositories/${repoId}`);
      if (!res.ok) {
        const message = (await extractFetchError(res)) ?? 'Failed to refresh repository';
        throw new Error(message);
      }
      const repo: RepositorySummary = await res.json();
      upsertRepository(repo);
      await loadJobsForRepo(repoId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to refresh repository';
      setError(message);
    }
  };

  const loadCoverage = useCallback(async (opts?: { repoId?: string; repoUrlOverride?: string }) => {
    const targetRepoId = opts?.repoId ?? selectedRepoId;
    const targetRepoUrl = opts?.repoUrlOverride ?? repoUrl;

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
      const repo: RepositorySummary = json.repository;
      const files: CoverageFile[] = json.files || [];
      upsertRepository(repo);
      setSelectedRepoId(repo.id);
      setRepoUrl(repo.httpsUrl);
      setCoverageByRepo((prev) => ({ ...prev, [repo.id]: files }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoadingCoverage(false);
    }
  }, [repoUrl, selectedRepoId, upsertRepository]);

  
  const analyse = useCallback(async () => {
    setError(null);
    setLoadingCoverage(true);
    try {
      let res: Response;
      const validation = repoSchema.safeParse({ repoUrl });
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
      if (!res.ok) {
        const message = (await extractFetchError(res)) ?? 'Failed to load coverage';
        throw new Error(message);
      }
      const json = await res.json();
      const repo: RepositorySummary = json.repository;
      const files: CoverageFile[] = json.files || [];
      upsertRepository(repo);
      setSelectedRepoId(repo.id);
      setRepoUrl(repo.httpsUrl);
      setCoverageByRepo((prev) => ({ ...prev, [repo.id]: files }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoadingCoverage(false);
    }
  }, [repoUrl, selectedRepoId, upsertRepository]);

  const loadJobsForRepo = useCallback(async (repoId: string) => {
    setLoadingJobs(true);
    try {
      const res = await fetch(`${apiBase}/jobs?repoId=${encodeURIComponent(repoId)}`);
      if (!res.ok) {
        const message = (await extractFetchError(res)) ?? 'Failed to load jobs';
        throw new Error(message);
      }
      const json = await res.json();
      setJobsByRepo((prev) => ({ ...prev, [repoId]: json }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load jobs';
      setError(message);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  const ensureRepoData = useCallback(async (repoId: string) => {
    if (!coverageByRepo[repoId]) {
      await loadCoverage({ repoId });
    }
    await loadJobsForRepo(repoId);
  }, [coverageByRepo, loadCoverage, loadJobsForRepo]);

  const requestImprovement = async (filePath: string) => {
    setError(null);
    const selectedRepoUrl = selectedRepo?.httpsUrl;
    const validation = createJobSchema.safeParse({
      repoId: selectedRepoId ?? undefined,
      repoUrl: selectedRepoUrl ?? repoUrl,
      filePath,
    });
    if (!validation.success) {
      setError(validation.error.issues.map((i) => i.message).join('; '));
      return;
    }

    const payload = validation.data.repoId
      ? { repoId: validation.data.repoId, filePath: validation.data.filePath }
      : { repoUrl: validation.data.repoUrl, filePath: validation.data.filePath };
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
      const job = await res.json();
      const repoKey = job.repoId ?? repoIdForJob;
      if (repoKey) {
        setJobsByRepo((prev) => ({
          ...prev,
          [repoKey]: [job, ...(prev[repoKey] ?? [])],
        }));
        setSelectedRepoId(repoKey);
        if (validation.data.repoUrl) {
          setRepoUrl(validation.data.repoUrl);
        }
        void refreshRepository(repoKey);
        upsertRepository(
          repositories.find((r) => r.id === repoKey) ?? {
            id: repoKey,
            httpsUrl: validation.data.repoUrl ?? job.repoUrl ?? selectedRepo?.httpsUrl ?? '',
            sshUrl: job.repoSshUrl ?? selectedRepo?.sshUrl ?? '',
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            openJobs: 0,
            queuedJobs: 0,
            totalJobs: 0,
          },
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to create job';
      setError(message);
    }
  };

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  useEffect(() => {
    if (!selectedRepoId) return;
    ensureRepoData(selectedRepoId);
    const id = setInterval(() => {
      loadJobsForRepo(selectedRepoId);
    }, 3000);
    return () => clearInterval(id);
  }, [selectedRepoId]);

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
              {selectedRepo && <p className="muted small">Repository: {selectedRepo.httpsUrl}</p>}
            </div>
            <span className="badge">Below 80%: {lowCoverage.length}</span>
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
            <span className="badge subtle">{repositories.length} tracked</span>
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
                  setRepoUrl(repo.httpsUrl);
                  void ensureRepoData(repo.id);
                }}
              >
                <div className="repo-header">
                  <div>
                    <p className="mono small">{repo.httpsUrl}</p>
                    <p className="muted small">ID: {repo.id}</p>
                  </div>
                  <button
                    className="ghost small-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void refreshRepository(repo.id);
                    }}
                  >
                    Refresh
                  </button>
                </div>
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
              {selectedRepo && <p className="muted small">Repository: {selectedRepo.httpsUrl}</p>}
            </div>
            <span className="badge subtle">{jobs.length} total</span>
          </div>
          {!selectedRepo && <p className="muted">Select a repository to view jobs.</p>}
          {selectedRepo && loadingJobs && <p className="muted">Loading jobs…</p>}
          {selectedRepo && !loadingJobs && !hasJobsForRepo && (
            <p className="muted">Jobs for this repository have not been loaded yet.</p>
          )}
          {selectedRepo && hasJobsForRepo && jobs.length === 0 && (
            <p className="muted">No jobs yet. Kick one off from the table.</p>
          )}
          {selectedRepo && jobs.length > 0 && (
            <div className="job-list">
              {jobs.map((job) => (
                <article className="job" key={job.id}>
                  <div className="job-header">
                    <div>
                      <p className="mono small">{job.filePath}</p>
                      <p className="muted small">{new Date(job.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`status ${job.status}`}>{job.status}</span>
                  </div>
                  {job.repoUrl && <p className="muted small">{job.repoUrl}</p>}
                  {job.prUrl && (
                    <p className="small">
                      PR: <a href={job.prUrl} target="_blank" rel="noreferrer">{job.prUrl}</a>
                    </p>
                  )}
                  {job.log?.length > 0 && (
                    <details>
                      <summary>Logs</summary>
                      <ul>
                        {job.log.slice(-3).map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
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

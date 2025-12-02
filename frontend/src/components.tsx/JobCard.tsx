import { memo } from 'react';
import type { Job } from '../types/job';

type JobProps = { job: Job; isOpen: boolean; onToggle(open: boolean): void };

export const JobCard = memo(
  ({ job, isOpen, onToggle }: JobProps) => (
    <article className="job">
      <div className="job-header">
        <div>
          <p className="mono small">{job.filePath}</p>
          <p className="muted small">{new Date(job.createdAt).toLocaleString()}</p>
        </div>
        <span className={`status ${job.status}`}>{job.status}</span>
      </div>
      <p className="muted small">Repo ID: {job.repoId}</p>
      {job.prUrl && (
        <p className="small">
          PR: <a href={job.prUrl} target="_blank" rel="noreferrer">{job.prUrl}</a>
        </p>
      )}
      <details open={isOpen} onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}>
        <summary>Logs</summary>
        {isOpen && (
          <ul>
            {job.log.slice(-3).map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        )}
      </details>
    </article>
  ),
  (prev, next) =>
    prev.isOpen === next.isOpen &&
    prev.job.id === next.job.id &&
    prev.job.status === next.job.status &&
    prev.job.prUrl === next.job.prUrl &&
    prev.job.updatedAt === next.job.updatedAt &&
    prev.job.createdAt === next.job.createdAt &&
    prev.job.log.length === next.job.log.length &&
    prev.job.log[prev.job.log.length - 1] === next.job.log[next.job.log.length - 1]
);

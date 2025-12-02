type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type Job = {
  id: string;
  repoId: string;
  filePath: string;
  status: JobStatus;
  prUrl: string | null;
  log: string[];
  createdAt: string;
  updatedAt: string;
};

export type RepositorySummaryDto = {
  id: string;
  httpsUrl: string;
  sshUrl: string;
  createdAt: Date;
  updatedAt: Date;
  openJobs: number;
  queuedJobs: number;
  totalJobs: number;
};

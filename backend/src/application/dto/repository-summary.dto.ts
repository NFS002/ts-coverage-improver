export type RepositorySummaryDto = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  openJobs: number;
  queuedJobs: number;
  totalJobs: number;
};

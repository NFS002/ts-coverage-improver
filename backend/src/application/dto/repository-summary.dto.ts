export type RepositorySummaryDto = {
  id: string;
  owner: string; // Repository owner e.g., "shoebox90902"
  repo: string; // Repository name e.g., "solana-oauth3-proxy"
  forkMode: boolean;
  forkOwner?: string | null;
  forkOrg?: string | null;
  createdAt: Date;
  updatedAt: Date;
  openJobs: number;
  queuedJobs: number;
  totalJobs: number;
};

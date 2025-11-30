export interface JobQueue {
  enqueue(jobId: string): Promise<void>;
}

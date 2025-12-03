import { ImprovementJob } from "domain/entities/improvement-job.entity";

export interface JobQueue {
  enqueue(job: ImprovementJob): Promise<void>;
}

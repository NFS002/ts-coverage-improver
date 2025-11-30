import { CoverageScanner } from '../../domain/services/coverage-scanner';
import { CoverageFile } from '../../domain/entities/coverage-file.entity';
import { RepoPreparer } from '../ports/repo-preparer';
import { Repository } from 'domain/entities/repository.entity';

export class AnalyseCoverageUseCase {
  constructor(
    private readonly repoPreparer: RepoPreparer,
    private readonly coverageScanner: CoverageScanner,
  ) { }

  async scan(repoPath: string): Promise<CoverageFile[]> {
    return await this.coverageScanner.scan(repoPath);
  }

  async prepareAndScan(params: {
    owner: string;
    repo: string;
  }): Promise<{
    repository: Repository;
    files: CoverageFile[];
  }> {
    const repository = await this.repoPreparer.prepare(params);
    const files = await this.scan(repository.path);
    return { repository, files };
  }


}

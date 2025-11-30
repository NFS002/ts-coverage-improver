import { CoverageScanner } from '../../domain/services/coverage-scanner';
import { CoverageFile } from '../../domain/entities/coverage-file.entity';
import { RepoPreparer } from '../ports/repo-preparer';

export class AnalyseCoverageUseCase {
  constructor(
    private readonly repoPreparer: RepoPreparer,
    private readonly coverageScanner: CoverageScanner,
  ) { }

  async execute(params: {
    owner: string;
    repo: string;
  }): Promise<CoverageFile[]> {
    const clonedRepoPath = await this.repoPreparer.prepare(params);
    const coverageFiles = await this.coverageScanner.scan(clonedRepoPath);
    return coverageFiles.map(file =>
    {
      const normalisedPath = file.filePath.replace(clonedRepoPath + '/', '');
      return new CoverageFile(normalisedPath, file.coveragePct);
    });
  }

}

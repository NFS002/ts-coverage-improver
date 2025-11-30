import { CoverageFile } from '../entities/coverage-file.entity';

export interface CoverageScanner {
  scan(repositoryPath: string): Promise<CoverageFile[]>;
}

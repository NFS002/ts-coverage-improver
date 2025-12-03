import * as fs from 'fs';
import * as path from 'path';
import { CoverageScanner } from '../../domain/services/coverage-scanner';
import { CoverageFile } from '../../domain/entities/coverage-file.entity';
import * as ts from 'typescript';
import { COVERAGE_FILE_SUMMARY_NAME, execToString, isExcludedPath, isIncludedPath } from '@utils';
import { safeStatSync } from '@utils';
import { execa } from 'execa';

export class LocalTsCoverageScanner implements CoverageScanner {

  async scan(repositoryPath: string): Promise<CoverageFile[]> {
    await execa('git', ['pull'], { cwd: repositoryPath });
    const currentBranchResult = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repositoryPath });
    const currentBranch = currentBranchResult.stdout.trim();
    console.info(`Current branch is ${currentBranch}`);
    const coverageFileSummaryPath = path.join(repositoryPath, COVERAGE_FILE_SUMMARY_NAME);
    const stat = safeStatSync(coverageFileSummaryPath);
    console.info('Stats: ', {
      coverageFileSummaryPath,
      stat,
      isFile: stat?.isFile(),
      isDirectory: stat?.isDirectory(),
    });

    if (safeStatSync(coverageFileSummaryPath)?.isFile()) {
      console.info('Found coverage summary file at', coverageFileSummaryPath);
      const fileContentsStr = fs.readFileSync(coverageFileSummaryPath, 'utf-8');
      console.info('Coverage summary file contents:', fileContentsStr);
      const coverageJson = JSON.parse(fs.readFileSync(coverageFileSummaryPath, 'utf-8'));
      // const files: CoverageFile[] = Object.entries<CoverageFile>(coverageJson)
      //   .filter(([file, _]) => file.endsWith('.ts'))
      //   .map(([file, stats]) => new CoverageFile(file, Number(stats.coveragePct ?? 0)));
      console.info("Raw coverage summary JSON:", coverageJson);
      const allFiles = Object.values<CoverageFile>(coverageJson)
      console.info("All files from coverage summary:", allFiles);
      const tsFiles = allFiles.filter(f => f.filePath.endsWith('.ts'));
      if (tsFiles.length) {
        console.info("Returning .ts files now from coverage summary:", tsFiles);
        return tsFiles;
      } else {
        console.warn("No .ts files found in coverage summary, falling back to discovery");
      }
      //   console.info("Returing files now from coverage summary:", files);
      // if (files.length) return files;
    }

    // Discover *.ts files in the repository
    let fileNames: string[] = []
    console.info({
      repositoryPath
    })
    const tsConfigPath = ts.findConfigFile(repositoryPath, ts.sys.fileExists, "tsconfig.json");
    if (tsConfigPath) {
      console.info('Found tsconfig.json at', tsConfigPath);
      const tsConfigFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile)
      const parseTsConfigFile = ts.parseJsonConfigFileContent(
        tsConfigFile.config,
        ts.sys,
        path.dirname(tsConfigPath)
      )
      console.info("Parsed tsconfig.json, found", parseTsConfigFile.fileNames)
      fileNames = parseTsConfigFile.fileNames
    } else {
      console.warn('No tsconfig.json found');
      fileNames = this.collectTsFiles(repositoryPath)
    }
    if (!fileNames.length) {
      throw new Error('No .ts files found to analyse in this repository',);
    }
    console.info(`Found ${fileNames.length} ts files`);


    return fileNames.map((filePath) => new CoverageFile(filePath, 0, true));
  }

  private collectTsFiles(repositoryPath: string): string[] {
    const tsFiles: string[] = [];
    this.walk(repositoryPath, (filePath) => {
      if (filePath.endsWith('.ts') && !filePath.endsWith('.d.ts') && !filePath.endsWith('.test.ts')) {
        tsFiles.push(filePath);
      }
    });
    return tsFiles;
  }

  // BFS traversal of the git repository filesystem, applying onFile callback for each valid file found
  private walk(currentDir: string, onFile: (filePath: string) => void) {
    let entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (isExcludedPath(fullPath)) {
        continue;
      }
      else if (entry.isFile() && isIncludedPath(fullPath)) {
        onFile(fullPath);
      }
      else if (entry.isDirectory()) {
        this.walk(fullPath, onFile);
      }
    }
  }
}

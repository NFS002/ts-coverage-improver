export class CoverageFile {
  constructor(
    public readonly filePath: string,
    public readonly coveragePct: number,
  ) {}

  isBelow(threshold: number): boolean {
    return this.coveragePct < threshold;
  }
}

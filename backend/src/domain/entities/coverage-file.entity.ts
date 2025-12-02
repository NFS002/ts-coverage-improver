export class CoverageFile {
  constructor(
    public readonly filePath: string,
    public readonly coveragePct: number,
    public readonly include: boolean
  ) {}

  isBelow(threshold: number): boolean {
    return this.coveragePct < threshold;
  }
}

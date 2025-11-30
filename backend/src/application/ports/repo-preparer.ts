export interface RepoPreparer {
  /**
   * Prepares and returns a local path to the repository.
   * Implementation may clone or reuse a cached copy.
   */
  prepare(params: { repo: string; owner: string; }): Promise<string>;
}

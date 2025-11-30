import { Repository } from "domain/entities/repository.entity";

export interface RepoPreparer {
  /**
   * Prepares a repository for analysis:
   * - When fork mode is enabled, it will first fork the repository under the configured GitHub user or organization.
   * - When fork mode is disabled, it will clone the original repository.
   * - In both cases, clones the repository (using the ssh url of either the original or forked repository - depending on fork mode)
   *   to a unique directory on the local filesystem.
   * - Return a new Repository entity representing the prepared repository. 
   */
  prepare(params: { repo: string; owner: string; }): Promise<Repository>;
}

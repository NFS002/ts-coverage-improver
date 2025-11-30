import { Repository } from '../entities/repository.entity';

export interface RepositoryRepository {
  save(repository: Repository): Promise<void>;
  findById(id: string): Promise<Repository | null>;
  findByOwnerAndName(params: { owner: string; repo: string}): Promise<Repository | null>;
  list(): Promise<Repository[]>;
}

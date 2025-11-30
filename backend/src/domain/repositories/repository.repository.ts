import { Repository } from '../entities/repository.entity';

export interface RepositoryRepository {
  save(repository: Repository): Promise<void>;
  findById(id: string): Promise<Repository | null>;
  findByHttpsUrl(httpsUrl: string): Promise<Repository | null>;
  findBySshUrl(sshUrl: string): Promise<Repository | null>;
  findByUrls(params: {
    httpsUrl: string;
    sshUrl: string;
  }): Promise<Repository | null>;
  list(): Promise<Repository[]>;
}

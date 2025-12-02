import { InsertRepositoryRow, SelectRepositoryRow } from "infrastructure/persistence/entities";

export class Repository {

  id: string;
  repo: string
  owner: string;
  path: string;
  forkMode: boolean
  forkOwner: string | null;
  forkOrg: string | null
  createdAt: Date;
  updatedAt: Date;


  constructor(
    params: {
      id: string;
      repo: string;
      owner: string;
      path: string;
      forkMode: boolean;
      forkOwner: string | null;
      forkOrg: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  ) {
    const { id, repo, owner, forkMode, path, forkOwner, forkOrg, createdAt, updatedAt } = params;
    
    this.id = id;
    this.repo = repo;
    this.owner = owner;
    this.forkMode = forkMode;
    this.forkOwner = forkOwner;
    this.forkOrg = forkOrg;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.path = path;
  }

  public sanitise() {
    return {
      id: this.id,
      repo: this.repo,
      owner: this.owner,
      forkMode: this.forkMode,
      forkOwner: this.forkOwner,
      forkOrg: this.forkOrg,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }

  public static fromRow (row: SelectRepositoryRow) {
    return new Repository(row);
  }

  public toRow(): InsertRepositoryRow {
    const row: InsertRepositoryRow = {
      id: this.id,
      repo: this.repo,
      owner: this.owner,
      path: this.path,
      forkMode: this.forkMode,
      forkOwner: this.forkOwner,
      forkOrg: this.forkOrg,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
    
    return row;
  }

  touch(): void {
    this.updatedAt = new Date();
  }
}

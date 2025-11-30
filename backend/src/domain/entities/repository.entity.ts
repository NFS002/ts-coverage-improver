export class Repository {
  constructor(
    public readonly id: string,
    public readonly httpsUrl: string,
    public readonly sshUrl: string,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  touch(): void {
    this.updatedAt = new Date();
  }
}

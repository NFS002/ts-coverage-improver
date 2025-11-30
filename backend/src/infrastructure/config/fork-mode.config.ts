export class ForkModeConfig {
    
    enabled: boolean;
    owner: string | null;
    org: string | null;

    constructor() {
        this.enabled = process.env.FORK_MODE === 'true';
        this.owner = process.env.FORK_OWNER ?? null;
        this.org = process.env.FORK_ORG ?? null;
    }
}
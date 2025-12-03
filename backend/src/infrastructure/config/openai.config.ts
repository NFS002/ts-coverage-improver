import { execSync, spawnSync } from "child_process";

export class OpenAIConfig {

    private constructor() { }

    static login(apiKey: string) {
        execSync("codex login --with-api-key", {
            input: `${apiKey}\n`,
            stdio: ["pipe", "pipe", "pipe"],
        });
    }

    static isLoggedIn(): boolean {
        const proc =  spawnSync("codex login status");
        return proc.status === 0;
    }

    static initialize() {
        if (!OpenAIConfig.isLoggedIn()) {
            console.info("Initializing OpenAIConfig");
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                console.error("OPENAI_API_KEY is not set, OpenAI features may not work properly");
            }
        }
    }
}
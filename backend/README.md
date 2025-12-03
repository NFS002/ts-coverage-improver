System requirements
- Node.js 22+
- GitHub CLI
- Codex CLI

(Tested on macOS 13.6.6)

## Quick start

Make sure your working directory is the ./backend directory of this repository.

```
cd backend
```

Copy the example environment file and set your environment variables in the new .env file. See [the main README.md](../README.md) for details on how to obtain necessary API keys and tokens.

```
cp .env.example .env
```

Install dependencies and start the development server:

```
npm install
npm run start:dev  # Defaults to localhost:3000
```

- [Start the frontend](../frontend/README.md)

## Navigate to http://localhost:5173 to access the application.

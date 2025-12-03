System requirements
- Node.js 22+

(Tested on macOS 13.6.6)

## Quick start

Make sure your working directory is the ./frontend directory of this repository.

```
cd frontend
```
Install dependencies and start the development server:

```
npm install
npm run dev
```

- Frontend reads `VITE_API_URL` (defaults to the backend default URL) for API requests. 
- [Make sure your backend is running and set this variable accordingly if needed](../backend/README.md).

### Navigate to http://localhost:5173 on a modern chromium-based browser to access the application.

### React Compiler and live updates

The React Compiler is not enabled on this template because of its impact on dev & build performance. 
As a consequence, components may re-render more often than necessary, and flicker or appear less smoothly, especially when viewing live updates on job logs in the dashboard.
To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

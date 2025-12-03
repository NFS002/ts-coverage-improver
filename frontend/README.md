System requirements
- Node.js 22+

(Tested on MacOS 13.6.6)

## Quick start

Make sure your working directory is the ./frontend directory of this repodository.

```
cd frontend
```
Install dependencies and start the development server:

```
npm install
npm run dev
```

- [Start the frontend](../frontend/README.md)

## Navigate to http://localhost:5173 to access the application.

### React Compiler and live updates

The React Compiler is not enabled on this template because of its impact on dev & build performances. 
As a consequence, components may re-render more often than necessary, and flicker or appear less smoothly, especially whern viewing live updates on job logs in the dashboard.
To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).


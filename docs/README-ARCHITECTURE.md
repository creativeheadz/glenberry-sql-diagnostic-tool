# Architecture Overview

This project is a portable, self-contained SQL Server diagnostic tool with a built-in web UI and optional AI analysis.

## Key Components
- WebServer: Express + Socket.IO server that serves the UI and exposes /api endpoints
- ApiRoutes: REST endpoints for configuration, report retrieval and export
- WebRoutes: Serves the embedded UI when no built client is found
- ConnectionManager: Manages SQL Server connections
- QueryParser: Loads and organizes diagnostic queries by SQL Server version and section
- ExecutionEngine: Executes queries with progress callbacks and error handling
- ReportGenerator: Builds HTML/CSV (and placeholder Excel) reports
- AIAnalyzer: Optional AI integration (OpenAI or Ollama)

## Data Flow
1. Client submits connection config via Socket.IO (`start-diagnostic`)
2. Server connects, loads queries, executes with progress events
3. Results (and optional AI insights) are compiled into a report
4. Report is saved (JSON + HTML), and a `diagnostic-complete` event returns the report id
5. Client offers direct links to export HTML/CSV/JSON via `/api/reports/:id/export/*`

## Portability
- The server can be packaged into a single binary via `pkg`
- A minimal embedded UI is served if `client/dist` is not present

## Security & Privacy
- Supports SQL auth and Windows auth
- Sensitive values are not logged and are masked in config output
- Reports are stored locally under the configured data directory

## Extensibility
- Add new queries in the `queries/` folder grouped by SQL Server version
- Enhance ReportGenerator to include visuals or additional metadata
- Add test coverage for core execution and report generation paths


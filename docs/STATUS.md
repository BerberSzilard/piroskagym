# Project Status

## Current status
- Monorepo-style app/API structure is in place (`app/`, `api/`).
- Docker-based orchestration exists via `docker-compose.yml`.
- Baseline docs for workflow and deployment are now established.

## Next steps
1. Add CI checks for build/test on pull requests.
2. Document required environment keys per service in `.env.example`.
3. Add service health endpoints and automated smoke checks.
4. Define release tagging/versioning conventions.

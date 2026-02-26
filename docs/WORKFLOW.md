# Codex Cloud PR Workflow

## 1) Start work
1. Sync `main`.
2. Create a focused feature branch.
3. Implement small, reviewable changes.

## 2) Validate before PR
1. Run project checks/tests locally.
2. Verify Docker build/runtime if infra changed.
3. Confirm no secrets are added to tracked files.

## 3) Open PR (Codex flow)
1. Push branch to GitHub.
2. Open PR against `main`.
3. Include:
   - scope summary
   - changed files/areas
   - validation commands + results
   - deployment notes (if applicable)

## 4) Review and iterate
1. Address review comments in follow-up commits.
2. Re-run checks after each update.
3. Keep PR description current.

## 5) Merge
1. Require green checks and reviewer approval.
2. Squash merge (recommended for concise history).
3. Delete merged branch.

## 6) Deploy
1. Pull latest `main` on server.
2. Rebuild/restart containers via Docker Compose.
3. Smoke test API + frontend.

See [DEPLOY.md](./DEPLOY.md) for concrete deployment commands.

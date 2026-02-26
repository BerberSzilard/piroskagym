# Deployment (AWS)

## Server prerequisites
- Docker Engine + Docker Compose plugin installed
- Access to repository checkout on the host
- Runtime `.env` file present on server (not committed)

## Deploy steps
From the repository root on the AWS host:

```bash
git checkout main
git pull origin main
docker compose pull || true
docker compose up -d --build
```

## Environment configuration
- Keep secrets only in server-side `.env` files or secret managers.
- Do **not** commit real env values to git.
- Use `.env.example` as the key template for required variables.

## Post-deploy checks
- `docker compose ps` shows healthy/running services.
- Frontend is reachable and loads expected content.
- API health/auth endpoints respond as expected.

## Rollback (quick)
- Re-deploy last known good commit:

```bash
git checkout <known-good-sha>
docker compose up -d --build
```

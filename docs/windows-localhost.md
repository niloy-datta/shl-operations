# Windows localhost quick start

This is an **isolated development environment** for SHL Operations OS. It is not production-ready and must not contain real customer, supplier, payment or commission records.

## Requirements

Install [Git for Windows](https://git-scm.com/downloads/win) and [Docker Desktop](https://www.docker.com/products/docker-desktop/). Start Docker Desktop with **Linux containers** and wait for the engine to be ready.

## Launch

Download `scripts/Start-SHL-Operations.ps1` from this repository to your Downloads folder. In PowerShell, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\Downloads\Start-SHL-Operations.ps1"
```

The launcher clones/updates the repo at `$HOME\Projects\shl-operations`, creates a `.env` once (with distinct cryptographically random passwords), validates placeholders, and starts the existing PostgreSQL + Spring Boot + Next.js services with Docker Compose. It opens [http://127.0.0.1:3000](http://127.0.0.1:3000) after checking the web HTTP response.

The bootstrap username and password are in `$HOME\Projects\shl-operations\.env`. **Never share or commit `.env`**. Changing that password after the database first boots does not rotate an existing staff user's password.

## Inspect and stop

Run any of these against the same downloaded script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\Downloads\Start-SHL-Operations.ps1" -Action Status
powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\Downloads\Start-SHL-Operations.ps1" -Action Logs
powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\Downloads\Start-SHL-Operations.ps1" -Action Check
powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\Downloads\Start-SHL-Operations.ps1" -Action Stop
```

`Stop` preserves the named PostgreSQL volume; it does not delete business records. If Docker cannot start, verify Docker Desktop is running and port 3000 is available. For debugging, execute `docker compose logs --tail=100 db api web` inside the repo folder.

## Validation limitations

CI checks PowerShell syntax and action names. GitHub Actions web and API jobs separately run their own build/test gates. **The actual startup on your Windows PC still must be checked locally**; CI does not prove Docker Desktop or port availability on your machine.

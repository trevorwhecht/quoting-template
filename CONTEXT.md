---
description: Development context and decisions for the quoting-template project
---

# Quoting Template — Development Context

## Decisions Log

### Execution Strategy
- **Execute Plan 1 first, write Plan 2 after** — Plan 2 depends on what Plan 1 actually built (auth shape, session structure, component conventions). Writing Plan 2 against a working foundation is more accurate than writing it against a spec only.
- **Plan execution order:** Plan 1 (Foundation) → Plan 2 (Dashboard) → Plan 3 (Get Quote + Account)

### Local Development Database
- **Docker PostgreSQL** — local dev uses a Docker container, not a hosted Prisma/cloud DB
- Container name: `quoting-pg`, password: `postgres`, db: `quoting_template`, port: `5432`
- Start command: `docker run --name quoting-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=quoting_template -p 5432:5432 -d postgres:16`
- Restart stopped container: `docker start quoting-pg`
- When forking the template into a real client project, swap `DATABASE_URL` in `.env.local` and Vercel — zero code changes needed

### Code Review Approach
- **Full review on every task** — read generated code, check against plan and CLAUDE.md rules, flag issues before moving to the next task

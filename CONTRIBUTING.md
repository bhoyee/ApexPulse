# Contributing

## Setup
- Node 20+, npm
- `npm install`
- `cp .env.example .env` and set secrets (no secrets committed!)
- `npx prisma migrate dev`

## Development
- `npm run dev` (app on 3100)
- `npm run cron` (manual cron run)
- Keep tests/lint tidy: `npm run lint`

## Git hygiene
- Do not commit `.env` or secrets.
- Prefer small, focused commits.
- Run `npm run lint` before opening PRs.


# Soccer Fantasy Game

**Genre:** Sports Companion App  
**Stack:** Next.js · TypeScript · Tailwind CSS  
**Deploy:** Cloudflare Workers (via OpenNext)  
**Status:** Active Development

## Quick Links
- [Game Design Document](docs/GDD.md)
- [Latest Audit / Gap Analysis](docs/2026-06-08-gap-analysis-report.md)
- [Auth & Onboarding](docs/architecture/AUTH.md)
- [Design Prompt](docs/design/soccer-fantasy-app-design-prompt.md)
- [Deployment Guide](docs/deployment/DEPLOY-CLOUDFLARE.md)
- [Changelog](docs/CHANGELOG.md)

## Structure
```
soccer-fantasy-game/
├── docs/
│   ├── GDD.md                        Product Design Document
│   ├── CHANGELOG.md
│   ├── VERIFICATION-AUDIT.md         Reusable V&V checklist
│   ├── 2026-06-08-gap-analysis-report.md   Latest audit findings
│   ├── architecture/                 AUTH.md, etc.
│   ├── design/                       Design prompts, mockups
│   └── deployment/                   Deploy guides + migration SQL records
├── src/                              Next.js app (App Router)
│   ├── app/                          Routes + API handlers
│   ├── components/                   UI components
│   └── lib/                          Scoring engines, Supabase clients, auth
├── migrations/                       Supabase SQL migrations (applied to prod)
├── cron-worker/                      Standalone Cloudflare cron Worker
├── tests/ + src/lib/*.test.ts        Vitest unit tests
├── public/                           Static assets
├── archive/bracket/                  Legacy HTML bracket viewer
├── schema.sql / schema-bracket.sql   Base DB schema (run first)
└── wrangler.toml                     Cloudflare config (main = .open-next/worker.js)
```

## Dev Setup
```powershell
npm install
npm run dev
```

## Deploy
See [`docs/deployment/DEPLOY-CLOUDFLARE.md`](docs/deployment/DEPLOY-CLOUDFLARE.md).

# World Cup Fantasy

**Genre:** Sports Companion App  
**Stack:** Next.js · TypeScript · Tailwind CSS  
**Deploy:** Cloudflare Workers (via OpenNext)  
**Status:** Active Development

## Quick Links
- [Game Design Document](docs/GDD.md)
- [Design Prompt](docs/design/world-cup-app-design-prompt.md)
- [Deployment Guide](docs/deployment/DEPLOY-CLOUDFLARE.md)
- [Changelog](docs/CHANGELOG.md)

## Structure
```
worldcup-fantasy/
├── docs/
│   ├── GDD.md                        Product Design Document
│   ├── CHANGELOG.md
│   ├── design/                       Design prompts, mockups
│   └── deployment/                   Deploy guides (Cloudflare, etc.)
├── src/                              Next.js app source
├── public/                           Static assets
├── archive/
│   └── bracket/                      Legacy HTML bracket viewer
└── wrangler.toml                     Cloudflare config
```

## Dev Setup
```powershell
npm install
npm run dev
```

## Deploy
See [`docs/deployment/DEPLOY-CLOUDFLARE.md`](docs/deployment/DEPLOY-CLOUDFLARE.md).

# ProCV Frontend

React + Vite application serving three portals: candidate/public, employer and admin.

## Commands

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
npm run test:e2e
```

Copy `.env.example` to `.env` before local development.

Source code follows a simplified Feature-Sliced Design:

```text
src/
├── app/       # providers, router, route layouts
├── pages/     # route-level pages for main, employer and admin portals
├── widgets/   # larger portal UI blocks
├── features/  # user actions
├── entities/  # business-domain modules
└── shared/    # framework-agnostic infrastructure and UI
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for dependency rules and file
conventions.

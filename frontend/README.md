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

Copy `.env.example` to `.env` before local development. Route-level pages are
lazy-loaded through `src/routes/lazyPages.jsx`; reusable UI belongs in
`src/components`, while feature-only components stay next to their page.

See [`../docs/08-frontend/cau-truc-frontend.md`](../docs/08-frontend/cau-truc-frontend.md)
for the portal layout and code conventions.

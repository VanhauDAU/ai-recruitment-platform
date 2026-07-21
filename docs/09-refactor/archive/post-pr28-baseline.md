# Post PR #28 baseline

- Commit: `6f0de70e149b5753e1defdacf85c90989329805c`
- Branch: `refactor/frontend-post-pr28`
- Node version: `v25.6.1`
- npm version: `11.9.0`
- Baseline date: `2026-07-13`

## Clean install

`frontend/node_modules` was removed and `npm ci` completed successfully.

## Verification results

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | Passed |
| Unit tests | `npm run test` | Passed — 11 files, 41 tests |
| Production build | `npm run build` | Passed |
| E2E | `npm run test:e2e` | Passed — 16 tests, desktop and mobile Chromium |

## Known runtime bugs

1. `features/search-jobs/ui/SearchDropdown.jsx` calls `localStorage.removeItem(HISTORY_KEY)`, but `HISTORY_KEY` is not defined in that component. Clearing search history throws at runtime.
2. `features/saved-jobs/model/SavedJobsProvider.jsx` has no per-job pending mutation lock. Consecutive save/unsave interactions can send duplicate or out-of-order requests and require explicit race-condition coverage.

## Known architecture violations

The required import-graph scan found these invalid feature-to-feature imports:

- `features/saved-jobs/model/SavedJobsProvider.jsx` imports `features/save-job`.
- `features/saved-jobs/model/SavedJobsProvider.jsx` imports `features/auth`.
- `features/submit-feedback/ui/FeedbackModal.jsx` imports `features/auth`.
- `features/auth/model/AuthProvider.jsx` imports `features/two-factor`.
- `features/auth/ui/LoginForm.jsx` imports `features/two-factor`.

The following prohibited directions had no matches at the baseline:

- `features → pages`
- `features → widgets`
- `entities → features`
- `shared → entities`

## Baseline conclusion

The existing automated suite is green, but it does not cover the two P0 regressions above. Phase 1 may begin only with regression tests for the search-history model and saved-job mutation behavior.

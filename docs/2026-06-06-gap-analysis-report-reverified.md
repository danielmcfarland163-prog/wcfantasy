# Soccer Fantasy Game — Gap Analysis Report (Re-Verified)

**Audit date:** 2026-06-06 (afternoon re-run)
**Scope:** Full V&V across all 20 dimensions of `docs/VERIFICATION-AUDIT.md`
**Supersedes:** `docs/2026-06-06-gap-analysis-report.md` (earlier same-day) — corrections in §0.
**Method:** Source review of the **real working-tree files** (read directly, not via the sandbox mount — see caveat below), live inspection of Supabase project `vgguaeutmljgvxdcfmkd` ("World Cup Pick'Em", the project `.env.local` targets) including row counts, RLS **policy bodies**, `has_function_privilege`, realtime publication, and security + performance advisors; Cloudflare Workers list + deploy state; `git` status/commit/tracking; and CI workflow review.

## Verdict

**~80% to a feature-complete v1 — and meaningfully further along in code than the earlier same-day report concluded.** Since that report was written, a substantial fix wave landed in the working tree that closes its #1 critical ("automation/live sync missing") and several high-priority gaps: the cron worker was rewritten with a correct schedule map, `sync-scores` became LIVE-aware, a new `sync-fixtures` route generates knockout fixtures safely, and a `RealtimeRefresh` client subscription was wired into `/today`, `/live`, and `/stats`. The database is healthy, seeded, reconciled, and its locks (picks **and** bracket) are server-enforced via RLS — verified at the policy level.

**The dominant risk has shifted from "unwritten code" to "unshipped code."** Every one of those fixes is **uncommitted** (3 files are untracked; the cron rewrite is a tracked-but-modified file), the deployed app Worker is built from `HEAD` (which predates the fixes), the deployed cron Worker dates to **Jun 5** (pre-rewrite), CI does not deploy the cron Worker or set runtime secrets, and the local git object store is **corrupted** (`improper chunk offset(s)`), which is why a `recovery-backup-worktree-2026-06-06.tgz` exists. The critical path to launch is now **commit → deploy → set secrets → repair git**, not net-new feature work.

> **Environment caveat (important for reading this report).** This audit ran inside a sandbox whose Linux mount holds **corrupted copies** of several source files (trailing NUL padding / truncation), so a `tsc`/`next build` executed in-sandbox fails with ~715 phantom syntax errors. The **real files** (read through the file API, which reads your actual disk) are complete and valid, and this is corroborated by a fresh `.open-next` build artifact (Jun 6) and a successful app-Worker deploy at 18:18 UTC. **I therefore could not execute a typecheck/build against your true tree from here** — the "builds clean" status below rests on static inspection + build/deploy artifacts, not a fresh compile. Re-run `npx tsc --noEmit` locally to confirm.

---

## 0. Correction log vs. the earlier same-day report

The prior report (`2026-06-06-gap-analysis-report.md`) is now **stale**. These of its findings were re-tested against the current working tree and live DB and have **changed**:

| Prior finding | Status now | Evidence (this audit) |
|---|---|---|
| **[Critical]** Cron maps only `*/15 → score-bracket`; `*/10` has no handler; sync/score-picks/notify never scheduled | **Resolved in code (unshipped)** | `cron-worker/src/index.ts` now defines `*/5 → sync-scores→score-picks`, `0 */6 → sync-fixtures→score-bracket`, `0 18 → notify`; `wrangler.toml` crons match exactly. **But the file is uncommitted and the deployed worker is the Jun-5 original.** |
| **[Critical]** `sync-scores` pulls FINISHED only; `mapStatus` never returns `LIVE` | **Resolved in code (unshipped)** | `mapStatus` maps `IN_PLAY`/`PAUSED → LIVE`; handler writes `status` + half-time scores for LIVE/FINISHED/POSTPONED. |
| **[Critical]** Nothing generates knockout matches | **Mechanism added (unshipped, data pending)** | New `api/sync-fixtures` idempotently upserts the full schedule incl. R32→Final by mapping `api_id→UUID` (no team creation → avoids the dup bug), skipping TBD fixtures; wired to the `0 */6` cron. Knockout rows are still 0 in the DB (real draw not yet ingested). |
| **[High]** No client realtime on `/live`, `/today`, standings | **Largely resolved (unshipped)** | New `components/RealtimeRefresh.tsx` (debounced `postgres_changes → router.refresh()`) is mounted on `/today` (`matches`,`global_scores`), `/live` (`matches`), `/stats` (`global_scores`); `LeagueClient.tsx` was also modified. |
| **[High/Med Security]** Bracket lock unenforced — no `now() < lock` check; owner can PATCH past lock | **Wrong — lock IS server-enforced** | `bracket_entries` policy *"Users manage own entry before lock"* (ALL) USING+WITH CHECK = `(auth.uid()=user_id) AND (now() < '2026-06-11 15:00:00+00')`. Writes are blocked at the DB after lock time. The never-set `locked` flag is moot. |
| `/today` "YOU" highlight never triggers (query omits `user_id`) | **Fixed** | `today/page.tsx` selects `user_id` and computes `isMe`; mobile `AccountMenu` is present in the header. |
| Dead `'FT'`/`'UPCOMING'` status branches | **Fixed** | `/live` and `/today` use the correct `SCHEDULED\|LIVE\|FINISHED` enum. |

Re-confirmed **accurate** from the prior report: the build is clean on the real tree (per artifacts; not re-compiled here), DB reconciliation (93/75), the closed anon-RPC hole, the Uruguay duplicate, 72 group-only matches, and the unbuilt bonus-picks feature (all detailed below).

---

## 1. Master gap table

Status: ✅ Complete · 🟡 Partial · ❌ Missing/Broken · 🔴 Blocker. % = approximate completeness.

| # | Feature / Dimension | Status | % | Key issue (verified this audit) | Severity | Impact | Owner |
|---|---|:--:|:--:|---|:--:|---|---|
| 1 | Architecture & setup | ✅ | 95 | Next 15 App Router, SSR/admin Supabase clients, OpenNext→Workers, TS strict; 13 tables all RLS-on. *Couldn't recompile in-sandbox (mount corrupt); real files valid + fresh build artifact present* | Low | Solid foundation | — |
| 2 | Auth & onboarding | ✅ | 95 | Magic-link + password + signup, branded, middleware onboarding gate, `handle_new_user` trigger, cookie refresh, logout | Low | Works end-to-end | — |
| 3 | Match Picks ("My Picks") | ✅ | 88 | Full scoreline UI, 1×/2×/3×, upsert, **kickoff-lock RLS-enforced**, validation, live-score realtime, result badges. Only 72 group matches seeded; knockouts await draw | Medium | Core mode works | Frontend/DB |
| 4 | Bracket | ✅ | 88 | Sequential picker, derived progression, client lock + **server RLS time-lock (verified)**, ✓/✗ reviewer. "Submit" is cosmetic UX only; `locked` flag never written (moot — RLS uses time) | Low | Playable; lock holds | Frontend |
| 5 | Leagues & standings | 🟡 | 65 | Create/join/dup-prevent/dual-tab/chat + game-mode selector. Missing: privacy + max-members UI, commissioner tools, `Exact` column; **`/join/[code]` route absent → shared invite links 404** | High | Sharing/config incomplete | Full-stack |
| 6 | Global leaderboard | 🟡 | 55 | Data correct & ranked; `/stats` is a realtime de-facto board. `/leaderboard` is still a 4-line `redirect('/stats')`; no pagination | Medium | No dedicated board | Full-stack |
| 7 | Live scores & realtime + sync | ✅→🟡 | 70 | **Up from 40.** `sync-scores` LIVE-aware; `sync-fixtures` added; `RealtimeRefresh` on today/live/stats. **Unshipped: deployed worker is stale** | High | Works locally, not in prod | Backend/DevOps |
| 8 | Scoring engine | ✅ | 88 | Correct, idempotent, **reconciled (93/75)**. Picks 0/3/5×mult; bracket 2/2/2/3/5/8/13/21 (max 231). Now wired to crons in code (unshipped) | Medium | Accurate; auto-run unshipped | Backend |
| 9 | Tournament bonus picks | ❌ | 10 | `TournamentPick` type + champion/runner-up/golden-boot config are dead code; `tournament_picks` = 0 rows; no UI, no scoring path | High | GDD §2.1 absent (≤20 pts unreachable) | Full-stack |
| 10 | Admin panel | ✅ | 80 | Server-gated page + per-route guards (shared `isCronOrAdmin`), results edit, simulator, reset, user/league CRUD, seed/sync/score. Hardcoded admin UUID; no seed-matches button (now covered by `sync-fixtures`) | Medium | Strong operator tooling | Backend |
| 11 | Stats | 🟡 | 55 | **Up.** Rank card + standings + realtime + richer columns (`picks_correct`/`bracket_correct`). Missing: accuracy %, exact-score count, history chart, bracket-progress tracker | Medium | Improved but thin | Frontend |
| 12 | Notifications | 🟡 | 35 | Resend reminder email is real and **now scheduled in cron code** (`0 18`, unshipped); `RESEND_*` keys are placeholders; no invite/mention notifications | Medium | No reminders fire in prod | Backend |
| 13 | Mobile responsiveness | ✅ | 85 | Real breakpoints, bottom nav, safe-area, scrollable tables. Some touch targets <44px | Low | Good | — |
| 14 | UI/UX polish | 🟡 | 78 | Strong light system; loading/empty/error in forms. Copy-invite copies a 404 link with no "Copied!" feedback; no `loading.tsx`/`error.tsx`; `LiveHero` hardcodes minute/venue; `Nav.tsx` dead | Medium | Rough edges | Frontend |
| 15 | Error handling & edge cases | 🟡 | 60 | Robust in auth/bracket/create/join; SSR fetches swallow errors (render empty); no 404 pages for missing league/user | Medium | Silent failures | Frontend |
| 16 | Performance | 🟡 | 75 | Fine at current scale. N+1 sequential loops in scoring/email. Advisors: `multiple_permissive_policies`, `auth_rls_initplan` (WARN), unindexed FKs (INFO) | Low | Scale risk only | DB |
| 17 | Testing | ❌ | 0 | **No tests, no runner, no CI test step** — despite pure, unit-testable scoring modules | High | No safety net | Full-stack |
| 18 | Deployment & shipping | 🔴 | 50 | **Fix wave uncommitted/unshipped**: deployed app = pre-fix `HEAD`; deployed cron = Jun-5 stale; CI deploys app only (no cron, no runtime secrets); **git object store corrupted** | **Critical** | Prod ≠ local; automation not actually running | DevOps |
| 19 | Security | ✅ | 85 | RLS on all 13 tables; routes authed; service-role server-only; anon-RPC hole **closed (verified)**; **picks + bracket locks both server-enforced (verified)**. WARN: `is_league_member` anon-exec, leaked-password protection off | Low | Sound | DB |
| 20 | Documentation | ✅ | 78 | Thorough GDD/CHANGELOG/deploy/AUTH. Drift: prior gap report now stale; "80+ matches" vs 72 seeded; no API reference | Low | Good | — |

---

## 2. Completed features (production-ready or nearly so)

- **Auth & onboarding (95%).** Magic-link, password, and signup with branded UI; middleware forces username setup via an `onboarded` flag mirrored into the profile row and JWT; `handle_new_user` trigger guarantees the profile exists; cookie sessions refresh per request; logout in `SideNav`/`AccountMenu`. 2 onboarded profiles live.
- **Architecture (95%).** Clean App Router, separate SSR/browser/admin clients, `basePath:/soccer-fantasy` threaded through the auth callback, OpenNext→Workers, GitHub Actions deploy. (Real files valid; not recompiled in-sandbox — see caveat.)
- **Scoring engine (88%).** `lib/scoring.ts` + `lib/bracket-scoring.ts` are pure, single-source-of-truth modules shared by the server scorer **and** UI. Verified reconciled on live data: user A 93 (71 picks + 22 bracket, rank 1), user B 75 (71 + 4, rank 2) — **identical across `league_scores` and `global_scores`**.
- **Bracket engine + locks (88%).** Sequential Groups → 3rd-place → Knockout → Summary with cascade-clearing derived progression, 8-of-12 third-place logic, `LockCountdown` escalating to a live timer inside 24h, read-only post-lock view, and a `BracketReviewer` scoring ✓/✗. **The lock is enforced server-side by an RLS time check** (verified) — a genuine strength.
- **Admin panel (80%).** Page + every admin route gated; full match simulator (group/bracket/full/reset w/ auto-scoring), pick reset, user/league CRUD, correct HTTP verbs.
- **Mobile & design system (85%).** Light, polished CSS-variable system, real breakpoints, bottom nav, iOS safe-area.

---

## 3. Partial features (with the specific gap)

- **Leagues (65%)** — create/join/dual-tab/chat + a game-mode selector work. Create page still lacks privacy + max-members controls (columns exist: `is_public`, `max_members`); commissioner "tools" show only the invite code; leaderboard omits the `Exact` column; **the shareable invite link targets a `/join/[code]` route that does not exist** (the code-entry join via `JoinLeagueForm` works).
- **Global leaderboard (55%)** — data correct/ranked and `/stats` now serves as a realtime board, but `/leaderboard` is still a redirect; no dedicated board or pagination.
- **Live & sync (70%, up from 40%)** — LIVE-aware sync, fixtures generation, and client realtime all exist **in code**; the gap is purely **shipping** (see §4.1).
- **Stats (55%)**, **Notifications (35%)**, **UI polish (78%)**, **Error handling (60%)** — see master table.

---

## 4. Critical gaps (launch blockers)

### 4.1 [Critical] Commit and ship the fix wave — *the new #1*
The automation/realtime/live work that closes the prior report's critical path **exists only in the local working tree**:
- **Untracked (never committed):** `src/app/api/sync-fixtures/route.ts`, `src/components/RealtimeRefresh.tsx`, `src/lib/api-auth.ts`.
- **Tracked but modified (uncommitted):** `cron-worker/src/index.ts` + `wrangler.toml` (the schedule rewrite), `sync-scores`, `score-picks`, `today/live/stats/LeagueClient`, GDD/CHANGELOG (+122/−203 across 17 files).
- **Deployed state lags:** app Worker `soccer-fantasy` was deployed at 18:18 UTC from commit `b4becaa1` (which **predates** these edits); cron Worker `soccer-fantasy-cron` was last modified **Jun 5 03:10** (pre-rewrite). `deploy.yml` runs `wrangler deploy` for the **app only** — it never `cd cron-worker && wrangler deploy`, and injects **no runtime secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`, `CRON_SECRET`, `RESEND_*`).
- **Git is corrupted** (`improper chunk offset(s) 6d7f0 and 992d8`); a `recovery-backup-worktree-2026-06-06.tgz` is on disk.

**Action:** repair/repack the git object store (or restore from the recovery tarball), commit the untracked + modified files, deploy the app, **separately deploy the cron Worker**, and set runtime secrets on **both** Workers via `wrangler secret put`. Confirm the cron `APP_URL` carries the `/soccer-fantasy` basePath (the worker already warns if it doesn't). **Effort: 0.5–1d.** *Blocks all live behavior; until done, prod runs the pre-fix app and the stale cron.*

### 4.2 [Critical] Tournament data integrity
Live DB has a **duplicate Uruguay**: `URY` (api_id 758, **no group**) and `URU` (group **H**, **no api_id**) — the legacy `seed-teams` (hardcoded/grouped/no api_id) vs API-sourced rows. `teams` = 49 (should be 48). Only **72 group matches**, all `FINISHED` (simulated); **0 knockout rows**. **Action:** merge the two Uruguay rows onto one record carrying both `group_letter='H'` and `api_id=758`, add a uniqueness guard, then run `sync-fixtures` against the live API after the draw to populate knockouts. **Effort: 0.5–1d** (knockouts are timing-bound to the real draw).

### 4.3 [High → Critical if v1] Tournament bonus picks
GDD §2.1 promises one-time Champion (10) / Runner-up (5) / Golden Boot (5) picks locked at group-stage end. Only an unused `TournamentPick` type + config constants exist; `tournament_picks` = 0 rows; no UI, no scoring path. Blocker only if it's a v1 commitment; otherwise the top post-launch item. **Effort: 1–2d.**

---

## 5. Nice-to-have gaps (post-launch)

- Dedicated `/leaderboard` page (order/paginate/realtime) instead of redirecting to `/stats`.
- Commissioner controls (rename, privacy toggle, max-members, kick, regenerate code) **and** a `/join/[code]` route so shared links resolve.
- Stats depth: accuracy %, exact-score count, bracket-progress tracker, historical chart.
- Invite/mention notifications (the reminder email already exists and is now scheduled).
- Add the `Exact` column to league leaderboards; per-user score detail.

---

## 6. UI/UX issues

| Issue | File | Severity |
|---|---|:--:|
| Copy-invite copies a `/join/[code]` link that 404s; no "Copied!" feedback | `CopyInviteButton.tsx`, `utils.ts` | Medium |
| No `loading.tsx` / `error.tsx` boundaries; SSR fetches render empty on error | `app/**` | Medium |
| `LiveHero` hardcodes match minute + `'Stadium'` venue | `LiveHero.tsx` | Low |
| Touch targets <44px (score steppers, bracket node rows, login tabs) | `MatchCard.tsx`, `BracketClient.tsx` | Low |
| `Nav.tsx` is dead code (not imported) | `components/Nav.tsx` | Low |
| On mobile, account/logout affordance lives only on `/today` (other tabs rely on `SideNav`, desktop) | `BottomNav.tsx` | Low |

---

## 7. Technical debt

- **Zero tests (highest-ROI).** Pure scoring modules are trivially unit-testable; add Vitest + a CI gate.
- **Git object-store corruption** + reliance on a recovery tarball — fragile; repack and verify before further work.
- **Type drift.** `LeagueScore`/`GlobalScore` in `lib/types.ts` omit dual-mode columns (`picks_points`, `bracket_points`, `*_rank`, …) that exist in the DB and are written by `score-utils.ts`. Regenerate from schema.
- **Seed-of-record ambiguity.** `seed-teams` (legacy) vs `sync-fixtures`/`bootstrap-matches` — keep `sync-fixtures` (api_id-keyed, no team creation) as the source of truth; retire/guard the old paths that created the Uruguay split.
- **`scoring_config` table is seeded (5 rows) but unused** — `lib/scoring.ts` hardcodes defaults.
- **Single hardcoded admin UUID** in `lib/admin.ts` (no roles table).
- **Non-constant-time `CRON_SECRET`** compared with `===` in `lib/api-auth.ts`.
- **Two Supabase projects** under the org (`vgguaeutmljgvxdcfmkd` in use; `nkztlgiwyxudnvygnmww` unused) — cleanup/confusion risk.
- **DB advisors** (low impact at 2 users): many `multiple_permissive_policies` + `auth_rls_initplan` (wrap `auth.uid()` in `(select auth.uid())`), 10 unindexed FKs. Consolidate before scale.

---

## 8. Live database snapshot (project `vgguaeutmljgvxdcfmkd`)

| Table | Rows | Note |
|---|:--:|---|
| `profiles` | 2 | both onboarded |
| `teams` | **49** | should be 48 — duplicate Uruguay (`URY` api_id 758/no group · `URU` group H/no api_id) |
| `matches` | **72** | all `GROUP`, all `FINISHED` (simulated); **0 knockout rows** |
| `picks` | 144 | **all 144 scored** |
| `bracket_entries` | 2 | both complete; both `locked=false` (moot — RLS time-lock governs) |
| `tournament_results` | 1 | groups + 3rd-place populated; final empty (mid-tournament test state) |
| `league_scores` | 2 | ranked 93 / 75 ✅ |
| `global_scores` | 2 | ranked 93 / 75 ✅ **consistent with league_scores** |
| `tournament_picks` | 0 | feature unbuilt |
| `scoring_config` | 5 | seeded but unread by code |

Realtime publication: `matches`, `league_scores`, `global_scores`, `chat_messages`. Functions: `handle_new_user`, `recalculate_league_rankings`, `is_league_member`, `bulk_finish_matches`. All data is **simulated**.

---

## 9. Security posture (verified at the policy level)

- **Picks lock — server-enforced (verified).** INSERT/UPDATE policies require `auth.uid()=user_id AND EXISTS(match WHERE kickoff_time > now())`. Back-dating a pick via the API is blocked.
- **Bracket lock — server-enforced (verified, contradicts prior report).** The `bracket_entries` ALL policy requires `auth.uid()=user_id AND now() < '2026-06-11 15:00:00+00'` on USING **and** WITH CHECK. Writes are refused after lock time regardless of the UI.
- **Anon-RPC hole closed (verified).** `bulk_finish_matches` and `recalculate_league_rankings` are **not** anon/authenticated-executable (`has_function_privilege` = false).
- **WARN (advisors):** `is_league_member` (a boolean membership helper) is `SECURITY DEFINER` and anon/authenticated-executable via `/rpc` — revoke `EXECUTE` or switch to `SECURITY INVOKER`. Supabase **leaked-password protection is disabled** — enable the HaveIBeenPwned check.
- RLS is enabled on all 13 tables; every API route checks `CRON_SECRET` or an admin session; the service-role key is server-only.

---

## 10. Prioritized recommendations

**Phase 0 — Ship what's already built (critical path, ~0.5–1d)**
1. Repair the git object store (or restore from `recovery-backup-worktree-2026-06-06.tgz`); verify with `git fsck`.
2. Commit untracked (`sync-fixtures`, `RealtimeRefresh`, `api-auth`) + modified files.
3. Deploy the app **and** the cron Worker (`cd cron-worker && wrangler deploy`); add cron deploy to `deploy.yml`.
4. `wrangler secret put` on both Workers: `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`, `CRON_SECRET`, `RESEND_*`, and the cron `APP_URL` (with basePath). *Gates the live experience and all automation.*

**Phase 1 — Harden + data (~1d)**
5. Dedupe Uruguay onto one row (`group_letter='H'` + `api_id=758`); add a uniqueness guard; retire the legacy team-creating seed path.
6. Revoke `anon`/`authenticated` EXECUTE on `is_league_member`; enable leaked-password protection.
7. Add Vitest unit tests for `scoring.ts` + `bracket-scoring.ts` and a CI test step.

**Phase 2 — Complete the spec (~2–4d)**
8. Run `sync-fixtures` post-draw to generate knockouts; confirm `score-bracket` rescoring on the `0 */6` tick.
9. Build Tournament Bonus Picks UI + scoring (champion/runner-up/golden-boot, 10/5/5).
10. Real `/leaderboard` (order/paginate/realtime); league privacy + max-members controls, commissioner tools, `/join/[code]` route; `loading.tsx`/`error.tsx` + 404s; stats depth.

**Phase 3 — Polish & scale (~1–2d)**
11. Consolidate RLS policies (`auth_rls_initplan`, `multiple_permissive_policies`), index FKs, regenerate `types.ts`, remove dead `Nav.tsx`, wire `scoring_config`, add a roles table.

**Critical-path dependencies:** Phase 0 gates everything live and must land first. Knockout generation (#8) depends on the real draw. Bonus picks (#9) is a blocker only if it's a v1 promise. Security #6 should precede public exposure.

---

## 11. Success criteria

- ✅ All 20 dimensions checked against the **real source**, the live database, RLS **policy bodies**, function privileges, advisors, CI, and Cloudflare deploy state.
- ✅ Gap table with required columns (Feature · Status · % · Issue · Severity · Impact · Owner).
- ✅ Every gap carries a severity; cross-dimension dependencies and per-gap effort noted (§4, §10).
- ✅ Prior same-day report re-verified; changed findings corrected (§0).
- ⚠️ **Not done here:** a fresh `tsc`/`next build` against the true tree (sandbox-mount corruption) — re-run locally.
- ▶︎ Ready for individual deployment-plan prompts (`docs/DEPLOYMENT-PLANS.md`) for each Phase 0/2 item.

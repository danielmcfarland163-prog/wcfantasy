# World Cup Fantasy — Gap Analysis Report (Verified)

**Audit date:** 2026-06-06
**Scope:** Full V&V across all 20 dimensions of `docs/VERIFICATION-AUDIT.md`
**Method:** Source review of all 60 app files (~7,400 LOC), `tsc --noEmit` typecheck, live Supabase inspection of project `vgguaeutmljgvxdcfmkd` ("World Cup Pick'Em" — the project `.env.local` actually targets), Supabase security **and** performance advisors, and direct `has_function_privilege` / row-level data verification.
**Verdict:** **~75% to a feature-complete v1.** The codebase **builds clean** (TypeScript strict, zero type errors) and the database is **healthy, seeded, and internally consistent**. The two "Critical" blockers in the prior draft of this report — a broken working tree and an anonymous RPC security hole — are both **now resolved** (verified below). The remaining critical path to a *public, live* launch is **automation** (no live-score sync or scheduled scoring is wired) plus **data integrity** (one duplicate team, knockout matches not yet generated). The single largest *functional* spec gap is the **Tournament Bonus Picks** feature, which is unbuilt.

---

## 0. Verification log — corrections vs. the prior draft

This report supersedes the earlier same-day draft. Three of that draft's most severe findings were re-tested against the current working tree and live DB and are **no longer valid**:

| Prior "Critical/High" finding | Status now | Evidence (this audit) |
|---|---|---|
| Working tree broken — 5 files truncated mid-edit, `next build` fails | **RESOLVED** | All files full-length (`MatchCard.tsx` 340, `PicksClient.tsx` 261, `BracketClient.tsx` 800, `score-bracket/route.ts` 44); `node tsc --noEmit` exits **0**. A `recovery-backup-worktree-2026-06-06.tgz` confirms the restore happened. |
| Anonymous data-tampering hole: `bulk_finish_matches` is `SECURITY DEFINER` callable by `anon` | **RESOLVED** | `has_function_privilege('anon', …)` = **false** for `bulk_finish_matches` *and* `recalculate_league_rankings`. Only `is_league_member` (a boolean RLS helper) is still anon-executable — WARN, not a hole. |
| `global_scores` is all zeros / inconsistent with `league_scores` | **RESOLVED** | Both tables now agree exactly: user A = 93 (71 picks + 22 bracket, rank 1), user B = 75 (71 + 4, rank 2). Scoring has been re-run and reconciled. |

Everything below reflects the **verified current state**, not the prior snapshot.

---

## 1. Master Gap Table

Status: ✅ Complete · 🟡 Partial · ❌ Missing/Broken. % = approximate completeness of that dimension.

| # | Feature / Dimension | Status | % | Key issue (verified) | Severity | Impact | Owner |
|---|---|:--:|:--:|---|:--:|---|---|
| 1 | Architecture & setup | ✅ | 95 | Next 15 App Router, SSR/admin Supabase clients, OpenNext→Workers, TS strict **passes clean**, 13 tables all RLS-enabled | Low | Solid foundation | — |
| 2 | Auth & onboarding | ✅ | 95 | Magic-link + password + signup, branded, middleware onboarding gate, `handle_new_user` trigger creates profile, cookie refresh, logout | Low | Works end-to-end | — |
| 3 | Match Picks ("My Picks") | ✅ | 85 | Full scoreline UI, 1×/2×/3×, upsert, kickoff-lock, validation, live-score subscription, result badges. Gaps: only 72 **group** matches seeded; result badges not realtime | Medium | Core mode works for group stage | Frontend/DB |
| 4 | Bracket | ✅ | 85 | Sequential picker, derived progression, lock 11 Jun 15:00 UTC, 24h countdown, ✓/✗ reviewer. Gap: "Submit" is cosmetic; `locked` never written; lock not server-enforced | Medium | Playable; lock bypassable via direct API write | Frontend/DB |
| 5 | Leagues & standings | 🟡 | 65 | Create/join/dup-prevent/dual-tab board/chat all work. Missing: privacy + max-members UI, commissioner tools, `ExactScores` column; invite **link** → nonexistent `/join/[code]` (404); standings not client-subscribed | High | Sharing & league config incomplete | Full-stack |
| 6 | Global leaderboard | 🟡 | 55 | Data is now correct & ranked, but `/leaderboard` is just `redirect('/stats')`; no dedicated board, no pagination, no realtime wiring | Medium | No standalone global board | Full-stack |
| 7 | Live scores & realtime + sync | 🟡 | 40 | DB realtime publication ready (`matches`, `league_scores`, `global_scores`, `chat_messages`). But `/live` & `/today` are static; `sync-scores` fetches **FINISHED only** (never sets `LIVE`) and is **never scheduled** | **High** | No automatic live updates | Backend |
| 8 | Scoring engine | ✅ | 85 | Logic correct, idempotent, **reconciled** (verified 93/75). Picks 0/3/5×mult; bracket 2/2/2/3/5/8/13/21 (max 231). Gap: only runs on manual/admin trigger | Medium | Scores accurate but not auto-updated | Backend |
| 9 | Tournament bonus picks | ❌ | 10 | `TournamentPick` type + `champion/runner_up/golden_boot` config exist but are **dead code**; `tournament_picks` table has 0 rows; no UI, no scoring path | High | GDD §2.1 feature absent (≤20 pts unreachable) | Full-stack |
| 10 | Admin panel | ✅ | 80 | Server-gated page + per-route guards; results edit, **simulator**, reset, user/league CRUD, seed/sync/score buttons (HTTP methods match routes). Gaps: no seed-**matches** button, hardcoded admin UUID | Medium | Operator tooling strong | Backend |
| 11 | Stats | 🟡 | 45 | Rank card + standings + static groups list. Missing: accuracy %, exact-score count, history chart, real bracket-progress tracker | Medium | Thin | Frontend |
| 12 | Notifications | 🟡 | 30 | Resend picks-reminder email is real but **never scheduled**; no invite/mention notifications; `RESEND_*` keys are placeholders | Medium | No reminders fire | Backend |
| 13 | Mobile responsiveness | ✅ | 85 | Real 768px breakpoints, bottom nav, safe-area, scrollable tables. Some touch targets <44px; bracket tree needs horizontal scroll | Low | Good | — |
| 14 | UI/UX polish | 🟡 | 75 | Strong light design system, loading/empty/error states in forms. No `loading.tsx`/`error.tsx`; dead `'FT'`/`'UPCOMING'` branches; broken "YOU" highlight; copy-invite has no feedback | Medium | Rough edges | Frontend |
| 15 | Error handling & edge cases | 🟡 | 55 | Robust in auth/bracket/create/join; SSR fetches swallow errors; no 404 pages for missing league/user; mobile logout only on `/today` | Medium | Silent failures | Frontend |
| 16 | Performance | 🟡 | 75 | Fine at current scale. N+1 sequential upserts in scoring/email loops. Advisors: 35 `multiple_permissive_policies`, 20 `auth_rls_initplan` (WARN), 10 unindexed FKs (INFO) | Low | Scale risk only | DB/Backend |
| 17 | Testing | ❌ | 0 | **No tests, no runner, no CI test step** — despite pure, unit-testable scoring modules | High | No safety net | Full-stack |
| 18 | Deployment & DevOps | 🟡 | 60 | Env template complete, OpenNext/wrangler set, GH Actions deploy, migrations applied. **Cron wiring broken**: `*/15`→`score-bracket` only; `*/10` has **no handler**; `sync-scores`/`score-picks`/`notify` never auto-run. Runtime secrets not set by workflow; `.env.local` service-role key is a placeholder | High | No working automation | DevOps |
| 19 | Security | ✅ | 80 | RLS on all 13 tables; every API route authenticated; service-role server-only; **prior anon RPC hole closed (verified)**. WARN: `is_league_member` anon-executable, leaked-password protection off, bracket lock not server-enforced, shared `CRON_SECRET` | Medium | Sound; minor hardening left | DB |
| 20 | Documentation | ✅ | 80 | Thorough GDD/CHANGELOG/deploy guides/AUTH.md. Drift: "80+ matches" vs 72 seeded; `schema-dual-mode.sql` referenced vs. applied migrations; no API reference | Low | Good | — |

---

## 2. Completed features (production-ready or nearly so)

**Authentication & onboarding (95%).** Three sign-in modes (magic link, password, signup) with a branded UI and friendly error prettifying; middleware forces username setup via an `onboarded` flag mirrored into both the `profiles` row and the JWT; the `handle_new_user` DB trigger guarantees the profile row exists before onboarding writes to it (so the onboarding `update` is safe); cookie sessions refresh on every request; logout is present in `SideNav` and `AccountMenu`. The live DB holds 2 onboarded profiles.

**Architecture & setup (95%).** Clean App-Router project, separate SSR/browser/admin Supabase clients, `basePath: /worldcup2026` threaded through the auth callback, OpenNext→Cloudflare-Workers build, GitHub Actions deploy. TypeScript `strict` is on and `tsc --noEmit` passes with **zero errors**. All 13 tables exist with RLS enabled.

**Scoring math & engine (85%).** `lib/scoring.ts` and `lib/bracket-scoring.ts` are pure, dependency-free, single-source-of-truth modules shared by the server scorer *and* the UI, so values never drift. Picks score 0 / 3 / 5 × confidence; brackets score 2/2/2/3/5/8/13/21 (max 231), matching GDD §2.2 exactly. Verified correct and **reconciled** on live data: two users at 93 and 75 points, identical across `global_scores` and `league_scores`, with global ranks populated.

**Bracket engine & UI (85%).** Sequential Groups → 3rd-place → Knockout → Summary picker with derived progression (downstream picks cascade-clear on upstream edits), 8-of-12 third-place logic, a `LockCountdown` that escalates to a live HH:MM:SS timer inside 24h, a read-only post-lock view, and a `BracketReviewer` that scores ✓/✗ against actual results.

**Admin panel (80%).** Both the page and every admin API route are gated on an allowlist; results editing, a full match **simulator** (group/bracket/full/reset with auto-scoring), pick reset, and user/league CRUD all work, and the client uses the correct HTTP verbs for each route.

**Mobile & design system (85%).** Light, polished CSS-variable design system with real responsive breakpoints, bottom nav, and iOS safe-area handling.

---

## 3. Partial features (with % and the specific gap)

- **Leagues (65%)** — create/join/dual-tab board/chat work; the create page lacks privacy and max-members controls (both columns exist), commissioner "tools" show only the invite code, the leaderboard omits the `Exact` column, and the shareable invite **link** points at a `/join/[code]` route that does not exist (the **code-entry** join works). Standings are server-rendered with no `league_scores` subscription despite the table being on the realtime publication.
- **Global leaderboard (55%)** — the data is now correct and ranked, but `/leaderboard` is a 4-line redirect to `/stats`; there is no dedicated board, pagination, or realtime.
- **Live & sync (40%)** — only chat and `/picks` subscribe to realtime; `/live` and `/today` render once. `sync-scores` only pulls `?status=FINISHED` and `mapStatus` never returns `LIVE`, so matches jump SCHEDULED→FINISHED with no live phase.
- **Scoring orchestration (within dim 8)** — the engine is correct but only runs when an admin clicks a button or the simulator runs; nothing scores on a schedule.
- **Stats (45%)**, **Notifications (30%)**, **UI polish (75%)**, **Error handling (55%)** — see master table.

---

## 4. Critical gaps (launch blockers)

The build and security blockers from the prior draft are cleared, so the critical path is shorter and concentrated in automation and data:

1. **[Critical] Wire automated live-sync + scoring (dim 7/8/18).** Today the cron worker maps only `*/15 → POST /api/score-bracket`; the declared `*/10` trigger has **no handler**, and `sync-scores` / `score-picks` / `notify-picks-reminder` are never called on any schedule. Additionally, `sync-scores` never sets `LIVE` and queries FINISHED only. Fix the `CRON_MAP`, add a `LIVE`/in-play branch to the sync, confirm the cron `APP_URL` includes the `/worldcup2026` basePath, and ensure runtime Worker secrets (`SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`, `CRON_SECRET`) are set — the GH Actions workflow only injects `NEXT_PUBLIC_*`. **Effort: 1–2 days.** *Blocks the live experience and any hands-off scoring.*
2. **[Critical] Tournament data integrity (dim 3).** The live DB has a **duplicate Uruguay** (`URY`, api_id 758, no group **and** `URU`, no api_id, group H) caused by the `seed-teams` (hardcoded, grouped, no api_id) vs `bootstrap-matches` (API, api_id, no group) collision. Only **72 group matches** are seeded — no knockout match rows exist (expected until the draw, but nothing generates them yet). Dedupe teams, choose one seed-of-record, and add knockout-match generation. **Effort: 1–2 days** (knockout generation is timing-bound to the real draw).
3. **[High → Critical if v1] Tournament bonus picks (dim 9).** GDD §2.1 promises one-time Champion (10) / Runner-up (5) / Golden Boot (5) picks locked at group-stage end. Only an unused type and config constants exist — no UI, no scoring. If this is a v1 commitment it is a blocker; otherwise it is the top post-launch item. **Effort: 1–2 days.**

---

## 5. Nice-to-have gaps (post-launch)

- Client realtime on `/live` and `/today` (the DB publication is already in place — this is a small `useEffect` subscription on each surface).
- A dedicated `/leaderboard` page with order/pagination/realtime instead of redirecting to `/stats`.
- Commissioner controls: rename, privacy toggle, max-members, kick, regenerate code; plus a `/join/[code]` route so shared links resolve.
- Stats depth: accuracy %, exact-score count, bracket-progress tracker, historical chart.
- Schedule the existing reminder email; add invite/mention notifications.
- An admin **seed-matches** button (the `bootstrap-matches` route exists but is unwired) and per-user score detail.

---

## 6. UI/UX issues

| Issue | File | Severity |
|---|---|:--:|
| No `loading.tsx` / `error.tsx` boundaries; SSR fetches destructure `data` only and render empty on error | `app/**` | Medium |
| Mobile users have **no logout/account affordance** off `/today` (`BottomNav` has none; `AccountMenu` mounts only in `today/page.tsx`) | `BottomNav.tsx`, `today/page.tsx` | Medium |
| `/today` "YOU" leaderboard highlight never triggers (query omits `user_id`) | `today/page.tsx` | Low |
| Dead status branches — queries reference `'FT'`/`'UPCOMING'` but the enum is `SCHEDULED\|LIVE\|FINISHED\|POSTPONED` | `live/page.tsx`, `today/page.tsx` | Low |
| `LiveHero` hardcodes the `LIVE` badge, a blank match minute, and a `'Stadium'` venue | `LiveHero.tsx` | Low |
| Copy-invite button: no "Copied!" feedback, and it copies a 404 link | `CopyInviteButton.tsx`, `utils.ts` | Low |
| Touch targets below 44px (score steppers ~22px, bracket node rows 28px, login mode tabs) | `MatchCard.tsx`, `BracketClient.tsx` | Low |
| `Nav.tsx` is dead code (not imported anywhere) | `components/Nav.tsx` | Low |

---

## 7. Technical debt

- **Zero tests (dim 17, highest-ROI debt).** The pure scoring modules are trivially unit-testable; add Vitest with a handful of cases plus a CI gate.
- **Type drift.** `LeagueScore` / `GlobalScore` in `lib/types.ts` omit the dual-mode columns (`picks_points`, `bracket_points`, `picks_rank`, `bracket_rank`, …) that exist in the DB and are written by `score-utils.ts`. It compiles only because the rows are read loosely; the interfaces should be regenerated from the schema.
- **Seed duplication / data-of-record ambiguity.** `seed-teams` and `bootstrap-matches` both write `teams` and disagree, producing the split Uruguay rows.
- **`scoring_config` table is unused** — `lib/scoring.ts` hardcodes `DEFAULT_CONFIG` rather than reading it.
- **Single hardcoded admin UUID** in `lib/admin.ts` (no roles table) — lose that account, lose admin.
- **Cron config fragility** — comments in `cron-worker/wrangler.toml` describe schedules the code doesn't implement; `APP_URL` must include the basePath or every call 404s.
- **Two Supabase projects** exist under the org (`vgguaeutmljgvxdcfmkd` in use; `nkztlgiwyxudnvygnmww` older/unused) — a cleanup/confusion risk.
- **DB advisors (low impact at 2 users):** 35 `multiple_permissive_policies`, 20 `auth_rls_initplan` (wrap `auth.uid()` in `(select auth.uid())`), 10 unindexed FKs. Worth a consolidation pass before scale.
- **Shared, non-constant-time `CRON_SECRET`** compared with `===` across routes.

---

## 8. Live database snapshot (project `vgguaeutmljgvxdcfmkd`)

| Table | Rows | Note |
|---|:--:|---|
| `profiles` | 2 | both onboarded |
| `teams` | **49** | should be 48 — duplicate Uruguay (`URY`/`URU`); 1 row has null group, 1 null api_id |
| `matches` | **72** | all `GROUP`, all `FINISHED` (simulated); **no knockout rows** |
| `picks` | 144 | **all 144 scored** |
| `bracket_entries` | 2 | both complete, both `locked = false` |
| `tournament_results` | 1 | groups + 3rd-place populated; final empty (mid-tournament test state) |
| `league_scores` | 2 | populated & ranked (93 / 75) ✅ |
| `global_scores` | 2 | populated & ranked (93 / 75) ✅ **consistent with league_scores** |
| `tournament_picks` | 0 | feature unused |

Realtime publication includes `matches`, `league_scores`, `global_scores`, `chat_messages`. Functions present: `handle_new_user`, `recalculate_league_rankings`, `is_league_member`, `bulk_finish_matches`. All data is currently **simulated**.

---

## 9. Security posture (verified)

RLS is enabled on all 13 tables, every API route checks `CRON_SECRET` or an admin session, and the service-role key is used server-side only. Verified findings, all WARN-level:

- `is_league_member` is `SECURITY DEFINER` and executable by `anon`/`authenticated` via RPC (low risk — boolean membership helper). Revoke `EXECUTE` or switch to `SECURITY INVOKER`.
- Supabase **leaked-password protection is disabled** — enable it (HaveIBeenPwned check).
- **Picks locks are correctly server-enforced** (a genuine strength): the `picks` INSERT/UPDATE RLS policies check `match.kickoff_time > now()`, so a user cannot back-date a pick via the API even if they bypass the UI.
- **The bracket lock, by contrast, is effectively unenforced.** `bracket_entries` RLS gates writes on a `locked` flag (`auth.uid() = user_id AND NOT locked`), but **nothing ever sets `locked = true`** — the UI "Submit" is cosmetic, `stateToDb` omits the column, and no trigger/cron flips it at the 11 Jun 15:00 lock time (both live entries are `locked = false`). There is no `now() < lock` time check either, so an owner can keep PATCHing their bracket past the lock via the API. Fix by flipping `locked` at lock time (trigger or scheduled job) or adding a time check to the policy.
- `bulk_finish_matches` and `recalculate_league_rankings` are **no longer** anon/authenticated-executable (confirmed via `has_function_privilege`) — the prior draft's critical hole is closed.

---

## 10. Prioritized recommendations

**Phase 1 — Harden what exists (~1 day)**
1. Revoke `anon`/`authenticated` `EXECUTE` on `is_league_member`; enable leaked-password protection; add a server-side bracket write-lock. — **2–4h**
2. Dedupe the Uruguay rows and pick a single team seed-of-record; add a unique constraint to prevent recurrence. — **2–4h**
3. Add Vitest unit tests for `scoring.ts` + `bracket-scoring.ts` and a CI test step. — **3–4h**

**Phase 2 — Make it live (~3–4 days, critical path)**
4. Rewrite the cron worker: map every schedule, call `sync-scores` → `score-picks` → `score-bracket`, add a `LIVE`/in-play branch to `sync-scores`, and confirm `APP_URL` carries the `/worldcup2026` basePath. Set all runtime Worker secrets. *(blocks live launch)* — **1–2d**
5. Add knockout-match generation after the group stage / draw. — **1–2d**
6. Wire client realtime subscriptions on `/live`, `/today`, league standings, and the global board (publication already exists). — **1d**

**Phase 3 — Complete the spec (~3–5 days)**
7. Build the Tournament Bonus Picks UI + scoring (champion/runner-up/golden boot, 10/5/5). — **1–2d**
8. Build a real `/leaderboard` page (order/paginate/realtime); add league privacy + max-members controls, commissioner tools, and a `/join/[code]` route. — **1–2d**
9. `loading.tsx` / `error.tsx` + 404 pages; surface SSR fetch errors; mobile logout; stats depth. — **1d**

**Phase 4 — Polish & scale (~1–2 days)**
10. Consolidate RLS policies (`auth_rls_initplan`, `multiple_permissive_policies`), index FKs, regenerate `types.ts` from the schema, remove dead `Nav.tsx`, wire `scoring_config`, add a roles table for admin. — **1–2d**

**Critical-path dependency:** Phase 2 #4 is the gate to a live public launch; #5 depends on the real draw; bonus picks (#7) is a blocker only if it is a v1 promise. Security #1 should land before any public exposure.

---

## 11. Success criteria

- ✅ All 20 dimensions of `docs/VERIFICATION-AUDIT.md` checked against source, the live database, advisors, and a typecheck.
- ✅ Gap analysis report generated with the required columns (Feature · Status · % · Issue · Severity · Impact · Owner).
- ✅ Every gap carries a severity (Critical / High / Medium / Low).
- ✅ Cross-dimension dependencies identified (§10 critical path).
- ✅ Effort estimated per gap (hours/days in §4 and §10).
- ✅ Prior draft's findings re-verified; resolved items corrected (§0).
- ▶︎ Ready for individual deployment-plan prompts (see `docs/DEPLOYMENT-PLANS.md`) for each Phase 2/3 item.

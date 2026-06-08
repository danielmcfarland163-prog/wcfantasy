# Soccer Fantasy Game — Gap Analysis & Audit Report

**Audit date:** 2026-06-08 (Rev 2 — re-run)
**Scope:** Full V&V across the 20 dimensions of `docs/VERIFICATION-AUDIT.md`, plus a security & functional code review.
**Method:** Fresh source review of the working tree (file:line evidence from four parallel code-audit passes), live inspection of Supabase project `vgguaeutmljgvxdcfmkd` ("Soccer Cup Pick'Em") — `list_tables`, function privileges via `has_function_privilege`, security + performance advisors, row counts, realtime publication — plus a direct read of `git fsck`, the CI workflow, and the cron worker.
**Supersedes:** the earlier 2026-06-08 pass (same date). This revision re-verifies every prior claim against current source and **corrects the deployment finding** (CI now deploys both workers with a test gate — see §2) while adding several new findings (§3).

---

## Verdict

**~84% to a feature-complete v1.** Both core game loops — My Picks (scoreline + confidence, dual-layer kickoff lock, live scoring, result badges) and Bracket (sequential picker, derived progression, time-lock, ✓/✗ reviewer, GDD-exact scoring) — are genuinely production-ready. The scoring engine is correct, centralized, unit-tested, and the picks path is a set-based RPC. The live DB is clean (48 teams, 0 duplicates) and the `score_picks()` anon-exec hole flagged previously is **confirmed fixed** (`anon=false, authenticated=false, service_role=true`).

**The risk profile is operational hardening and breadth, not broken core features.** The headline items: (1) the **git index is corrupted** (`git fsck` fails) — staging/committing is unreliable until repaired; (2) `bootstrap-matches` is a live, destructive, service-role route that **fails open** if `CRON_SECRET` is unset; (3) **no error/loading/not-found boundaries exist anywhere** and every SSR fetch swallows its Supabase error, so failures render as empty states; and (4) **Tournament Bonus Picks** (champion/runner-up/golden-boot) is fully unbuilt dead code.

**What changed vs the earlier same-day pass.** The prior report listed CI as a blocker ("deploys the app only; no cron worker; no secrets"). That is **no longer accurate**: `.github/workflows/deploy.yml` now runs `npm test` as a gate, then deploys **both** the app worker and the standalone cron worker, injecting the correct `/soccer-fantasy` basePath at build. The real remaining deploy gap is narrower — **app-worker runtime secrets are set manually** and must be verified. Also corrected: `LiveHero`'s minute is data-driven (renders blank, not hardcoded) while only the venue is hardcoded; admin match-score edits go through the **browser anon client** (RLS-reliant), not an admin API.

> **Environment caveat.** `npm test` / `tsc --noEmit` could not be executed in the audit sandbox — `node_modules` were installed on Windows, so the Linux-native binaries (`@rollup/rollup-linux-x64-gnu`, esbuild) are absent and vitest/tsc abort before running. Test **files** were read directly and the CI test gate is real. Re-run both locally to confirm green.

---

## 1. Master gap table

Status: ✅ Complete · 🟡 Partial · ❌ Missing/Broken. % = approximate completeness. Severity reflects the highest-severity open item in the row.

| # | Feature / Dimension | Status | % | Key issue (verified this audit) | Severity | Impact | Owner |
|---|---|:--:|:--:|---|:--:|---|---|
| 1 | Architecture & setup | ✅ | 90 | Strict TS, no build escape hatches, OpenNext→Workers coherent. `.env.local` basePath (`/worldcup2026`) + branding drift vs code's `/soccer-fantasy` | Medium | Local/operator env breaks if copied to Worker | Platform |
| 2 | Auth & onboarding | ✅ | 95 | Magic-link + password + signup, middleware onboarding gate, SSR cookie refresh, logout, callback fail-safe | Low | Solid | — |
| 3 | Match Picks ("My Picks") | ✅ | 95 | Scoreline UI, 1×/2×/3×, upsert, dual-layer kickoff lock (client + RLS, verified), realtime live scores, EXACT/CORRECT/WRONG badges. Only 72 group matches seeded; knockouts await draw | Low | Core loop works | FE/DB |
| 4 | Bracket | ✅ | 92 | Sequential picker, derived progression, time-lock (client + RLS), 24h countdown, ✓/✗ reviewer, scoring max 231. "Lock in my bracket" button is cosmetic (no persisted submit flag) | Low | Works; minor UX | FE |
| 5 | Leagues & standings | 🟡 | 70 | Picks/Bracket/Total table + tap-through player summaries solid. Create UI omits **privacy + max_members**; **no commissioner tools**; **`/join/[code]` route missing → shared invite links 404**; max-members TOCTOU | High | Sharing & management incomplete | Full-stack |
| 6 | Global leaderboard | 🟡 | 55 | Real combined board lives at `/stats` (realtime); `/leaderboard` is a 4-line `redirect('/stats')`. No per-mode global ranks; no pagination | Medium | Route/expectation mismatch | Full-stack |
| 7 | Live scores & realtime + sync | ✅ | 82 | `sync-scores` LIVE-aware; `sync-fixtures` safe knockout gen; realtime on matches/league_scores; cron worker correct **and now CI-deployed**. `LiveHero` minute blank + venue hardcoded; sync loops per row (bounded) | Medium | Data flows OK; live cosmetics off | Backend |
| 8 | Scoring engine | ✅ | 90 | Picks 0/3/5×mult via set-based `score_picks()` RPC; bracket 2/2/2/3/5/8/13/21 (max 231), unit-tested. `score-bracket` still N+1; `global_rank` stale between bracket-only cron runs | Medium | Correct now; scale risk | Backend/DB |
| 9 | Tournament bonus picks | ➖ | — | **Descoped (2026-06-08)** — removed from scope. The dead-code scaffolding (`tournament_picks` table, `TournamentPick` type, 10/5/5 constants) has been removed from code + `schema.sql`; drop migration provided for live DBs | — | Out of scope | — |
| 10 | Admin panel | ✅ | 80 | Server-gated page + session-guarded routes, simulator, user/league CRUD, seed/sync/score. **Match-score edit writes via browser anon client** (RLS-reliant, swallows failure); hardcoded admin UUID | Medium | Works for one operator; inconsistent path | Backend |
| 11 | Stats | 🟡 | 60 | Rank card + realtime board + live groups standings. Missing: picks **accuracy %**, history chart, bracket-progress tracker | Medium | Depth gaps | FE |
| 12 | Notifications | 🟡 | 35 | Resend reminder real + `0 18` cron. Keys are placeholders; **per-user `getUserById` N+1**; email lists **all** matches not the recipient's missing ones; no invite/mention notifs | Medium | Reminder works if keys set | Backend |
| 13 | Mobile responsiveness | ✅ | 85 | Real breakpoints, bottom nav, safe-area insets, no h-scroll leaks. Touch targets <44px; **`maximumScale:1` blocks pinch-zoom (WCAG 1.4.4)** | Medium | Usable; a11y gaps | FE |
| 14 | UI/UX polish | 🟡 | 78 | Strong light system + form states. **No `loading.tsx`/`error.tsx`/`not-found.tsx`**; venue hardcoded; copy-invite no feedback + 404 link; Uruguay flag blank; `Nav.tsx` dead code | Medium | Polish + resilience | FE |
| 15 | Error handling & edge cases | 🟡 | 55 | Robust in forms (double-submit guards). But **every SSR fetch ignores its Supabase `error`** → empty render on outage; no `error.tsx`/`not-found.tsx`; admin `saveScore`/`reset` unguarded | High | Failures invisible to users | FE |
| 16 | Performance | 🟡 | 75 | Set-based picks scoring is good. `score-bracket` + notify + `sync-scores` loop per row; **no `next/image`** (external flag CDN per request) | Low | Fine at current scale | DB/FE |
| 17 | Testing | 🟡 | 50 | Vitest scoring + bracket unit suites + CI test gate. Suites are **duplicated** across `tests/` and `src/lib/` (run twice); **zero integration/route/E2E** | Medium | Core math covered only | Full-stack |
| 18 | Deployment & DevOps | 🟡 | 72 | **Corrected:** CI test-gates then deploys **both** app + cron workers with correct basePath. Remaining: app-worker **runtime secrets set manually** (undocumented); **git index corrupted**; recovery tarball still tracked | High | Ship path mostly there; git fragility | DevOps |
| 19 | Security | ✅ | 85 | RLS on all tables; routes authed; service-role server-only; picks + bracket locks server-enforced (verified); **`score_picks()` locked to service_role (verified fixed)**. **`bootstrap-matches` fails open + destructive**; leaked-password off; `is_league_member` anon-exec (accepted) | High | One real hardening hole | DB/Backend |
| 20 | Documentation | ✅ | 82 | GDD/CHANGELOG/AUTH current. GDD's max-points formula reworked to the 72-row group-stage seed after the bonus-picks descope (2026-06-08); no API reference | Low | Minor drift | — |

---

## 2. Completed features (fully implemented & verified)

- **Auth & onboarding (dim 2).** Magic-link, password sign-in, and sign-up (8-char + confirm) in `auth/login/page.tsx`; middleware enforces unauth→login and not-onboarded→onboarding, refreshes the SSR session cookie correctly (`middleware.ts:18-67`), and logout is wired in three nav surfaces. Auth state gates the whole protected shell.
- **Match Picks core loop (dim 3, ~95%).** Separate clamped home/away steppers, 1×/2×/3× selector, upsert keyed on `(user_id, match_id)`, **dual-layer kickoff lock** (client `isMatchLocked` + RLS `kickoff_time > NOW()`), realtime live-score patching, and EXACT/CORRECT/WRONG result badges with multiplier-applied points. `MatchCard.tsx`, `PicksClient.tsx`.
- **Bracket core loop (dim 4, ~92%).** Full sequential flow (Groups → 3rd quals (8 of 12) → R32→R16→QF→SF→Final), auto-derived knockout progression, **time-lock enforced on both client and RLS** at the exact `2026-06-11T15:00:00Z` constant, 24-hour amber countdown, post-lock read-only reviewer with ✓/✗ per pick. `bracket.ts`, `BracketClient.tsx`, `BracketReviewer.tsx`.
- **Scoring engine (dim 8, ~90%).** `lib/scoring.ts` (0/3/5 × multiplier) and `lib/bracket-scoring.ts` (2/2/2/3/5/8/13/21, `BRACKET_MAX_POINTS=231`) match the GDD exactly and are the single source of truth shared by the server scorer, the SQL RPC, and the UI. Picks scoring is a set-based `public.score_picks()` RPC — one round-trip, locked to `service_role`.
- **League standings table + player summaries (dim 5 partial).** Single Picks/Bracket/Total table sorted by total, medals, rank-change arrows, "YOU" highlight; tap-through to read-only `/leagues/[id]/picks/[userId]` with RLS-gated visibility (opponent picks revealed only LIVE/FINISHED; bracket only after lock).
- **Realtime + sync + automation (dim 7, ~82%).** `RealtimeRefresh` subscribes `matches` (live) and `league_scores` (league); `sync-scores` is LIVE-aware; `sync-fixtures` generates knockout rows idempotently and safely (skips TBD). The standalone cron worker hits the right endpoints with `Bearer CRON_SECRET`, is basePath-aware, and **is now deployed by CI**.
- **DB integrity (dim 19).** RLS enabled on all 13 tables; 48 teams with 0 duplicate names; all privileged RPCs (`score_picks`, `bulk_finish_matches`, `recalculate_league_rankings`, `handle_new_user`) restricted to `service_role`.

---

## 3. New findings (this audit) — not in the prior pass

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low.

1. **🟠 `bootstrap-matches` fails open and is destructive.** `bootstrap-matches/route.ts:13` inline-compares `authHeader !== \`Bearer ${process.env.CRON_SECRET}\``. If `CRON_SECRET` is unset on the Worker, the literal header `Bearer undefined` authorizes a **service-role** route that overwrites all teams + matches. It bypasses the shared `isCronOrAdmin` (which guards `secret && …`), uses a non-constant-time compare, and the file comment itself says "Delete or protect afterwards." Critical if the secret is ever unset. **Fix:** route through `isCronOrAdmin`, or delete (its job is now done by `sync-fixtures`).
2. **🟠 basePath / brand three-way drift.** Code + `wrangler.toml` + CI build use `/soccer-fantasy`; `.env.local` sets `NEXT_PUBLIC_APP_URL=…/worldcup2026` and ships a **placeholder** service-role key. Any operator copying `.env.local` to a Worker secret breaks cron + email links and 500s every admin/cron/join route (`createAdminSupabaseClient` throws on the placeholder — matches the known "missing service key = 401 on admin routes" note). Branding strings also drift ("WORLD CUP FANTASY 2026" vs "Soccer Fantasy Game").
3. **🟠 No error/loading/not-found boundaries + swallowed SSR errors (dim 14/15).** Glob of `src/app/**` for `loading.tsx`/`error.tsx`/`not-found.tsx`/`global-error.tsx` returns **zero files**. Combined with `force-dynamic` and the fact that every server component destructures `const { data } = …` and **ignores `error`** (`today/page.tsx:46-73`, `stats/page.tsx:13-19`, `admin/page.tsx:13-25`), a query failure renders an empty state indistinguishable from "no data," and a thrown error shows the default white Next error page on every route.
4. **🟡 Admin match-score edit bypasses the API layer.** `AdminClient.tsx:63-66` writes results via the **browser anon client** (`supabase.from('matches').update({…status:'FINISHED'})`), unlike every other admin mutation (service-role API). It relies entirely on matches-table RLS to authorize the admin UID and **silently no-ops** on failure (acts only on `!error`, no try/catch).
5. **🟡 Global-rank recompute gap (dim 8).** `global_scores.global_rank` is recomputed **only** inside `score_picks()`. The bracket path (`score-utils.ts:30-89`) updates points but never re-ranks globally, so after the `0 */6` bracket-only cron, `global_rank` is stale until the next `*/5` picks tick (self-heals ≤5 min). The `global_scores.picks_rank` / `bracket_rank` columns exist but are **written by nothing** — there is no per-mode global ranking.
6. **🟡 `maximumScale:1` disables pinch-zoom (dim 13).** `layout.tsx:42` — a WCAG 1.4.4 failure; one-line fix.
7. **🟡 Notify reminder N+1 + wrong content (dim 12/16).** `notify-picks-reminder/route.ts:60-61` calls `supabase.auth.admin.getUserById(u.id)` inside a per-user loop (N sequential admin calls), and the email body lists **all** upcoming matches rather than the recipient's un-picked ones.
8. **🟡 League create UI omits privacy + max_members; no commissioner tools (dim 5).** `leagues/create/page.tsx` exposes only name/description/game_mode (privacy + cap fall to DB defaults). `commissioner_id` is stored and read but there is **no** rename/kick/delete/privacy/cap UI — `LeagueClient` renders identically for commissioner and members.
9. **⚪ Test suites are duplicated (dim 17).** Identical scoring + bracket suites live in both `tests/` and `src/lib/`; `vitest.config.ts` includes both globs, so every scoring test runs twice (inflates the "17 tests" count).
10. **⚪ Smaller items.** "Lock in my bracket" button is cosmetic — never persists a flag, state lost on reload (`BracketClient.tsx:130`). Realtime score patch can't reset a score to null (`PicksClient.tsx:53`). Per-match kickoff renders in **browser-local** TZ while the lock countdown renders **UTC** (display inconsistency). Uruguay flag map (`URU→uy`) mismatches the seed (`URY`) → blank flag. `Nav.tsx` is dead code. `CopyInviteButton` has no "Copied!" feedback and throws on non-HTTPS.

---

## 4. Critical gaps (launch blockers)

Defined as: must be resolved before a public (non-money) launch is reliable. Each carries severity, effort, and dependencies.

| # | Blocker | Severity | Effort | Depends on | Fix |
|---|---|:--:|:--:|---|---|
| B1 | **Git index corrupted** (`git fsck`: "bad index file sha1 signature; index file corrupt"). Staging/committing unreliable. | 🔴 Critical | 0.5h | — (do first) | `Remove-Item .git\index; git reset`, then `git fsck` to confirm the object store. Working tree is untouched by this. |
| B2 | **`bootstrap-matches` fail-open + destructive** (§3.1). | 🟠 High | 1h | B1 (to commit) | Route through `isCronOrAdmin`, or delete the route. |
| B3 | **App-worker runtime secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`, `CRON_SECRET`, `RESEND_*`) are set manually and **unverified**. If unset, admin/cron/scoring/join routes 500. | 🟠 High | 1h | — | `wrangler secret put` each on the app worker; document in deploy runbook; confirm both deployed Workers are current. |
| B4 | **Knockout tournament data** — only 72 GROUP matches seeded; 0 knockout rows. Knockout scoreline picks and full bracket scoring need real fixtures. | 🟠 High | 0.5d (post-draw) | B3 | Run `sync-fixtures` after the draw; verify `score-bracket` on the `0 */6` tick. |
| B5 | **Tournament Bonus Picks** — **Descoped (2026-06-08)**: removed from scope, no longer a blocker. Dead-code scaffolding deleted; `migrations/2026-06-08_drop_tournament_picks_descope.sql` cleans live DBs. | ➖ Resolved | — | — | No action — feature cut. |

**Dependency note:** B1 gates everything that must be committed (B2, and all of §6/§7). B3 gates B4 and any live scoring. Fix order: **B1 → B3 → B2 → B4**.

---

## 5. Nice-to-have gaps (post-launch)

- **Commissioner tools (dim 5)** — rename, kick member, delete league, toggle privacy, edit cap. 🟡 Medium · ~1.5d.
- **Real `/leaderboard` (dim 6)** — promote the `/stats` board to a canonical per-mode, paginated global leaderboard (the `picks_rank`/`bracket_rank` globals need populating first — ties to §6 tech debt). 🟡 Medium · ~1d.
- **Stats depth (dim 11)** — picks accuracy % (data already present), historical accuracy chart (needs history capture), bracket-progress tracker. 🟡 Medium · 1–3d.
- **Invite + @mention notifications (dim 12)** — email on league join; parse `@mentions` in `LeagueChat`. 🟡 Medium · ~1d.
- **League privacy + max_members in create UI (dim 5)** — expose the two fields the DB already supports. 🟡 Medium · 0.5d.
- **Design-brief breadth never built** — team profiles, player leaderboards (Golden Boot/Glove), venue guide, news/highlights, offline cache, i18n/RTL. These are aspirational design-brief items beyond the GDD's v1 scope; flag as roadmap, not gaps against v1. ⚪ Low · large.

---

## 6. UI/UX issues

| Issue | File:line | Severity | Effort |
|---|---|:--:|:--:|
| No `loading.tsx` / `error.tsx` / `not-found.tsx` anywhere → no skeletons, unbranded error page, no 404s | (none exist in `src/app/**`) | 🟠 High | Medium |
| `maximumScale:1` disables pinch-zoom (WCAG 1.4.4) | `layout.tsx:42` | 🟡 Medium | Trivial |
| Touch targets <44px (steppers 30×22, send 38×38, icon-btns 38×38, avatar 34×34) | `MatchCard.tsx:297`, `LeagueChat.tsx:238`, `globals.css:227` | 🟡 Medium | Low |
| `LiveHero` venue hardcoded to "Stadium"; LIVE minute renders blank | `today/page.tsx:129`, `LiveHero.tsx:52,94` | ⚪ Low | Medium |
| Copy-invite link points at non-existent `/join/[code]` (404) + no "Copied!" feedback | `utils.ts:36`, `CopyInviteButton.tsx:6` | 🟡 Medium | Small |
| Uruguay flag blank (`URU→uy` map vs `URY` seed) | `Flag.tsx:68` vs `seed-teams` | ⚪ Low | Trivial |
| Kickoff times in browser-local TZ while lock countdown is UTC (inconsistent) | `utils.ts:9-12` vs `LockCountdown.tsx:19-22` | ⚪ Low | Low |
| `Nav.tsx` dead code; off-system raw Tailwind colors in `CopyInviteButton` | `Nav.tsx`, `CopyInviteButton.tsx:7` | ⚪ Low | Trivial |

---

## 7. Technical debt

| Item | File:line | Severity | Effort |
|---|---|:--:|:--:|
| **SSR fetches swallow Supabase errors** → empty render on outage (systemic) | `today/page.tsx:46-73`, `stats/page.tsx:13-19`, `admin/page.tsx:13-25` | 🟠 High | Medium |
| **`score-bracket` is N+1** (per-user × per-membership upserts + RPC) — same Workers subrequest hazard the picks RPC fixed | `score-utils.ts:47-86` | 🟠 High | Medium |
| **Global-rank recompute gap** + dead `picks_rank`/`bracket_rank` globals | `score-utils.ts:30-89`, `…rpc.sql:142-150` | 🟡 Medium | Small |
| **Type drift** — `LeagueScore`/`GlobalScore` omit dual-mode columns the DB has and pages read; `BracketEntry.third_picks` legacy alongside engine's `third_quals` | `lib/types.ts:89-127` | 🟠 High | 2h |
| **Base `schema.sql` is stale** — `league_scores`/`global_scores` lack dual-mode columns; correct setup depends on running the migrations in order (documented only in comments) | `schema.sql:231-259` + dual-mode migrations | 🟡 Medium | Low |
| **Notify N+1** (`getUserById` per user) + emails list all matches | `notify-picks-reminder/route.ts:60-65` | 🟡 Medium | Low–Med |
| **`sync-scores` loops per actionable row** (bounded today) | `sync-scores/route.ts:78-97` | ⚪ Low | Medium |
| **Test duplication** (`tests/` ≡ `src/lib/`, run twice); **zero integration/route/E2E** | `vitest.config.ts:6` | 🟡 Medium | High (for E2E) |
| **Non-constant-time secret compares** (`===`) | `api-auth.ts:10`, `bootstrap-matches:13` | 🟡 Medium | 2h |
| **No `next/image`** — raw `<img>` to `flagcdn.com` per flag, unsized (CLS) | `Flag.tsx:43` | ⚪ Low | Low |
| **Hardcoded admin UUID, no roles table** | `lib/admin.ts:2` | 🟡 Medium | Low |
| **Recovery tarball still git-tracked** (`*.tgz` now ignored but file remains in index) | `recovery-backup-worktree-2026-06-06.tgz` | ⚪ Low | Trivial (after B1) |
| **Leaked-password protection off**; `is_league_member` anon-exec (accepted — backs RLS) | Supabase Auth settings | 🟡 Medium | Trivial (dashboard) |

---

## 8. Prioritized recommendations

**Now — operational (~0.5d).** Repair the git index (B1); set + verify app-worker runtime secrets (B3); `git rm --cached` the recovery tarball; enable Supabase leaked-password protection (dashboard).

**Next — correctness & spec (~3–5d).** Harden or delete `bootstrap-matches` (B2) and switch `CRON_SECRET` checks to constant-time; add the `/join/[code]` route so shared invite links resolve, plus "Copied!" feedback; add `error.tsx` + `not-found.tsx` (root + `/leagues/[id]`) and stop swallowing SSR `error`; regenerate `lib/types.ts` from the schema; reconcile `.env.local` basePath + branding.

**Later — scale & polish (~2–4d).** Convert `score-bracket` to a set-based `score_brackets()` RPC and fold global re-rank into it (kills the rank-staleness window); promote `/stats` to a real paginated `/leaderboard`; add league privacy + max_members + commissioner tools; stats accuracy %/history/bracket-progress; de-dupe test suites and add route/E2E tests; fix touch targets + pinch-zoom; index the ~10 unindexed FKs and consolidate the `auth_rls_initplan`/`multiple_permissive_policies` advisories.

---

## 9. Live database snapshot (project `vgguaeutmljgvxdcfmkd`)

| Table | Rows | Note |
|---|:--:|---|
| `profiles` | 2 | both onboarded |
| `teams` | **48** | ✅ deduped; all carry `api_id`; 0 duplicate names |
| `matches` | 72 | all `GROUP`; **0 knockout**; all `SCHEDULED` (sim reset) |
| `picks` | 144 | **0 scored** (pre-tournament / post-reset) |
| `bracket_entries` | 2 | both complete |
| `tournament_results` | 1 | single results row |
| `chat_messages` | 7 | LeagueChat is live |
| `leagues` / `league_members` | 1 / 2 | |
| `league_scores` / `global_scores` | 2 / 2 | dual-mode columns present |
| `tournament_picks` | **0** | descoped 2026-06-08 — table dropped from `schema.sql`; run the drop migration to remove it from the live DB |
| `scoring_config` | 5 | `champion_pts`/`runner_up_pts`/`golden_boot_pts` removed from `schema.sql` on descope; drop migration deletes them from the live DB (other 2 keys stay) |

**Function privileges (verified):** `score_picks`, `bulk_finish_matches`, `recalculate_league_rankings`, `handle_new_user` → `service_role` only (`anon=false, authenticated=false`). `is_league_member` → anon/authenticated executable (**accepted**; backs RLS policies incl. the public-leagues read path).

**Realtime publication:** `matches`, `chat_messages`, `league_scores`, `global_scores`. (`picks` intentionally absent.)

**Advisors:** Security — `is_league_member` anon-exec (accepted), leaked-password protection off (manual fix). `score_picks` anon-exec **no longer present** (confirmed fixed). Performance — `auth_rls_initplan` + `multiple_permissive_policies` (WARN), ~10 unindexed FKs (INFO). Low impact at current scale.

The DB is in a **reset / pre-tournament** state — all matches SCHEDULED, nothing scored, all data simulated. Knockout rows stay 0 until `sync-fixtures` runs against the real draw.

---

## 10. Success criteria

- ✅ All 20 dimensions re-checked against the current working tree (file:line evidence), the live database, RLS function privileges, advisors, the CI workflow, and `git fsck`.
- ✅ Master gap table with the required columns (Feature · Status · % · Issue · Severity · Impact · Owner); every gap carries a severity.
- ✅ Findings split into completed / partial / critical / nice-to-have / UI-UX / tech-debt / recommendations.
- ✅ Each gap carries a severity (Critical/High/Medium/Low) and an effort estimate; blocker dependencies and fix order identified (§4).
- ✅ Prior same-day pass reconciled; the deployment finding **corrected** (CI now deploys both workers behind a test gate); new findings documented (§3).
- ⚠️ **Not done here:** a fresh `tsc` / `npm test` run (sandbox `node_modules` are Windows-built) — run locally to confirm green. The CI test gate is real.

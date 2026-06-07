# Soccer Fantasy Game — Full Verification & Validation Audit

**Purpose:** Complete code, UI/UX, functionality, and gaps audit across all features  
**Date:** 2026-06-05  
**Status:** Ready to Run

---

## Verification Prompt (Master)

Run this prompt against the codebase to identify all functionality gaps, UI/UX issues, and implementation blockers:

```
You are auditing the Soccer Fantasy Game web app (Next.js + TypeScript + Supabase + Cloudflare).
Reference the GDD at docs/GDD.md and design brief at docs/design/soccer-fantasy-app-design-prompt.md.

Conduct a COMPLETE verification across these dimensions:

### 1. ARCHITECTURE & SETUP
- [ ] Next.js app router correctly configured
- [ ] Supabase client (SSR and client) properly initialized
- [ ] TypeScript strict mode enabled; all types defined
- [ ] Cloudflare Workers deployment (via OpenNext) ready
- [ ] Environment variables (.env.local) complete
- [ ] Database schema (schema-dual-mode.sql) applied to Supabase project

### 2. AUTHENTICATION & ONBOARDING
- [ ] Supabase Auth sign-up flow (magic link or OAuth)
- [ ] Login page functional and branded
- [ ] Post-login redirect to `/today` works
- [ ] Username/profile setup after sign-up required
- [ ] Session persistence across page reloads
- [ ] Logout functionality present
- [ ] Auth state reflected in navigation

### 3. MATCH PICKS FEATURE ("My Picks" mode)
**Upcoming picks:**
- [ ] `/picks` page loads all matches organized by group/stage
- [ ] Matches filterable: Upcoming / Live / All
- [ ] Match cards show: home team, away team, kickoff time, current odds/prediction
- [ ] Score input: home and away goals separately
- [ ] Confidence multiplier selector (1×, 2×, 3×) visible and functional
- [ ] Picks save to database on submit
- [ ] Picks editable until kickoff lock
- [ ] Visual feedback: locked matches show lock icon
- [ ] Validation: prevent negative scores, non-numeric input

**Live & past matches:**
- [ ] Live match shows real-time score (via Supabase realtime or API)
- [ ] Past matches show actual result with badge: EXACT / CORRECT / WRONG
- [ ] Points earned displayed on match card
- [ ] Confidence multiplier applied correctly to score

**Match data:**
- [ ] All 80+ tournament matches seeded in database
- [ ] Correct kickoff times (UTC) for all matches
- [ ] Group assignments and stage labels accurate
- [ ] Home/away teams correctly assigned

### 4. BRACKET FEATURE ("Bracket" mode)
**Bracket submission:**
- [ ] `/bracket` page loads with sequential picker
- [ ] Group stage: pick 1st and 2nd place for 12 groups (A–L)
- [ ] Third-place qualifiers: pick 8 out of 12 third-place teams
- [ ] Knockout progression: R32 → R16 → QF → SF → Final
- [ ] Submit button appears after all picks complete
- [ ] Bracket locks June 11, 2026 15:00 UTC globally
- [ ] Lock warning displays 24 hours before lock time
- [ ] Post-lock: bracket becomes read-only but visible

**Bracket display:**
- [ ] Completed bracket shows all picks in a readable tree/table
- [ ] Bracket reviewer component shows correct/incorrect picks as results come in
- [ ] Visual indicator: green ✓ / red ✗ for each pick vs. actual

**Scoring:**
- [ ] Bracket scoring implemented per GDD (2 pts group, 3 pts R32, 5 pts R16, 8 pts QF, 13 pts SF, 21 pts Final)
- [ ] Scoring triggered when admin updates tournament results
- [ ] Scores persist to `league_scores.bracket_points`

### 5. LEAGUES & STANDINGS
**League creation & management:**
- [ ] `/leagues` page lists user's leagues and invites
- [ ] Create league page: name, privacy (public/private), max members
- [ ] Commissioner settings visible (if user is commissioner)
- [ ] Invite code generation and copy-to-clipboard
- [ ] Invite link shareable (e.g., `soccer-fantasy.example.com/join?code=ABC123`)

**League leaderboard:**
- [ ] `/leagues/[id]` shows dual-tab leaderboard: "My Picks" | "Bracket"
- [ ] Each tab shows independent rankings and scores
- [ ] Columns: Rank, Player, Points, Exact Scores (or other relevant metrics)
- [ ] Rank change indicator (↑ ↓ —) from previous update
- [ ] Realtime updates: scores update without page refresh
- [ ] Mobile-friendly table layout

**Joining leagues:**
- [ ] Invite code form accepts valid codes
- [ ] Duplicate join prevented (user can't join twice)
- [ ] Post-join: user redirected to league page

### 6. GLOBAL LEADERBOARD
- [ ] `/leaderboard` accessible to all users
- [ ] Dual tabs: "My Picks" | "Bracket"
- [ ] Top N players displayed (configurable, e.g., 50)
- [ ] Pagination or infinite scroll for larger lists
- [ ] Realtime updates as scores change

### 7. LIVE SCORES & REAL-TIME UPDATES
**Live page:**
- [ ] `/live` shows current/upcoming matches
- [ ] Live hero card: scoreboard, match status (PRE / LIVE / FT / etc.)
- [ ] Real-time score updates (via Supabase realtime subscription)
- [ ] Commentary/updates from football-data.org or equivalent API

**Real-time infrastructure:**
- [ ] Supabase realtime enabled on relevant tables (matches, league_scores, picks)
- [ ] Client subscriptions active and receiving updates
- [ ] No polling delays; updates within 5 seconds of source

**Sync worker:**
- [ ] `api/sync-scores` cron job runs periodically (e.g., every 5 mins during matches)
- [ ] Fetches latest scores from football-data.org or ESPN API
- [ ] Updates `matches` table with live score, status, etc.
- [ ] Triggers `api/score-picks` when match finishes (status = FT)

### 8. SCORING ENGINE
**Picks scoring:**
- [ ] `api/score-picks` endpoint receives match result
- [ ] Calculates points: 0 (wrong outcome), 3 (correct outcome), 5 (exact score)
- [ ] Applies confidence multiplier (1×, 2×, or 3×)
- [ ] Stores result in `picks.points_earned` and `picks.pick_result`
- [ ] Recalculates affected user's `league_scores.picks_points`
- [ ] Recalculates global scores

**Bracket scoring:**
- [ ] `api/score-bracket` endpoint triggered when tournament result updated
- [ ] Compares user bracket picks vs. actual tournament results
- [ ] Awards points per GDD (2, 3, 5, 8, 13, 21)
- [ ] Updates `league_scores.bracket_points`

**Ranking recalculation:**
- [ ] After each score update, league rankings recalculated
- [ ] `rank` and `rank_change` fields updated per league and mode
- [ ] Global rankings also updated

### 9. TOURNAMENT BONUS PICKS
- [ ] After group stage lock, user can pick: Champion, Runner-up, Golden Boot
- [ ] One-time picks, 10/5/5 points respectively
- [ ] Locked at group stage end date
- [ ] Visible on picks page as bonus section
- [ ] Results trigger scoring when tournament ends

### 10. ADMIN PANEL
- [ ] `/admin` page restricted to admins
- [ ] Admin features:
  - [ ] Seed teams and matches
  - [ ] Manually update tournament results
  - [ ] Trigger scoring for specific matches
  - [ ] Reset picks (for testing)
  - [ ] View user/league stats
  - [ ] Simulate matches for testing

### 11. STATS & ANALYTICS
- [ ] `/stats` page shows user stats (picks accuracy, bracket progress, etc.)
- [ ] Quick stats: correct outcomes, exact scores, current rank
- [ ] Historical accuracy chart
- [ ] Bracket progress tracker

### 12. NOTIFICATIONS & ALERTS
- [ ] Picks reminder: email/notification before pick locks
- [ ] League invites: notification when invited
- [ ] League chat mentions: notification when @mentioned (if chat enabled)
- [ ] Scheduled notifications configured in Supabase or cron

### 13. MOBILE RESPONSIVENESS
- [ ] All pages render correctly on 375px viewport (mobile)
- [ ] Touch targets ≥48px (buttons, inputs)
- [ ] Horizontal scroll prevented
- [ ] Bottom navigation accessible (if present)
- [ ] Forms usable on mobile keyboards

### 14. UI/UX POLISH
- [ ] Consistent color scheme (accent color from design)
- [ ] Readable typography (font weights, sizes)
- [ ] Adequate spacing and padding
- [ ] Loading states on buttons and async operations
- [ ] Error messages clear and actionable
- [ ] Empty states helpful (e.g., "No picks yet")
- [ ] Transitions/animations smooth (no jank)
- [ ] Dark mode considerations (if design specifies)

### 15. ERROR HANDLING & EDGE CASES
- [ ] Network errors caught and displayed
- [ ] Invalid input validation clear
- [ ] Missing data fallbacks present
- [ ] Race conditions avoided (e.g., double-submit protection)
- [ ] Session expiry handled gracefully
- [ ] 404 pages for missing leagues/users

### 16. PERFORMANCE
- [ ] Initial page load <3s on 4G (Lighthouse audit)
- [ ] No N+1 queries in API endpoints
- [ ] Images optimized (Next.js Image component)
- [ ] Lazy loading for non-critical components
- [ ] Bundle size reasonable (<500kb JS)

### 17. TESTING
- [ ] Unit tests for scoring logic
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical flows (auth, pick, bracket, league)
- [ ] Test coverage ≥70% for critical paths

### 18. DEPLOYMENT & DEVOPS
- [ ] `.env.local` has correct Supabase credentials
- [ ] Cloudflare Workers deployment documented and tested
- [ ] `wrangler.toml` configured with correct project ID
- [ ] Database migrations applied to production
- [ ] Cron jobs scheduled (sync-scores, notifications)
- [ ] CI/CD pipeline configured (GitHub Actions or similar)

### 19. SECURITY
- [ ] RLS policies on all Supabase tables
- [ ] API routes require authentication where applicable
- [ ] No sensitive data in client code
- [ ] CORS configured correctly
- [ ] Rate limiting on scoring/pick endpoints

### 20. DOCUMENTATION
- [ ] GDD accurate and up-to-date
- [ ] CHANGELOG reflects all changes
- [ ] Deployment guide complete
- [ ] API endpoints documented
- [ ] Database schema documented

---

## Deliverable: Gap Analysis Report

Run the audit and generate a detailed report listing:

1. **Completed Features** — what's fully implemented
2. **Partial Features** — what's partially done (% complete)
3. **Critical Gaps** — must be done before launch (blockers)
4. **Nice-to-Have Gaps** — post-launch improvements
5. **UI/UX Issues** — design inconsistencies or missing polish
6. **Technical Debt** — code quality, testing, performance
7. **Recommendations** — prioritized action items

Format as a markdown table with columns:
| Feature | Status | % | Issue | Severity | Impact | Owner |

---

## Success Criteria

Audit is **complete** when:
- ✓ All 20 dimensions above have been checked
- ✓ Gap analysis report generated (see Deliverable above)
- ✓ Each gap has a severity (Critical / High / Medium / Low)
- ✓ Dependencies between gaps identified (e.g., "must fix auth before testing picks")
- ✓ Estimated effort per gap noted (e.g., 2h, 1d, 3d)
- ✓ Ready for individual deployment plan prompts (next step)
```

---

## Next Steps

1. **Run the Master Verification Prompt** — execute the prompt above against the codebase
2. **Generate Gap Analysis Report** — consolidate findings
3. **Develop Deployment Prompts** — for each Critical/High gap (see DEPLOYMENT-PLANS.md)


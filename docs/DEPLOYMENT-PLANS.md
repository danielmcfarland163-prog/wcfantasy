# Soccer Fantasy Game — Deployment Plans by Feature

**Purpose:** Individual implementation prompts for each feature gap  
**Prerequisite:** Run `VERIFICATION-AUDIT.md` to generate gap analysis first  
**Format:** Copy each prompt into a separate Claude session for focused implementation

---

## Priority Matrix

```
CRITICAL (Must-have for launch)          HIGH (Should-have)                LOW (Nice-to-have)
├─ Auth & Onboarding                     ├─ Admin Panel                     ├─ Stats & Analytics
├─ Match Picks Core (My Picks)           ├─ League Chat                     ├─ Notifications/Email
├─ Bracket Picker & Submission           ├─ Tournament Bonus Picks          ├─ Mobile Animations
├─ League Leaderboards (dual-mode)       ├─ Live Score Sync                 └─ Dark Mode
├─ Global Leaderboard                    └─ Push Notifications
├─ Scoring Engine (both modes)
└─ Deployment to Cloudflare
```

---

# CRITICAL FEATURES

## 1. Authentication & Onboarding

**File:** `src/app/auth/`  
**Scope:** Complete auth flow, session management, username setup  
**Effort:** 1–2 days  

```
DEPLOYMENT PROMPT: Auth & Onboarding

Build a complete authentication and onboarding flow for Soccer Fantasy Game.

**Scope:**
1. Supabase Auth integration (magic link or OAuth)
2. Login page (`/auth/login`) with branded hero
3. Sign-up flow with email verification
4. Post-signup username/profile setup
5. Session persistence (no manual login on each page load)
6. Logout button in main nav
7. Auth state reflected in navigation (logged-in vs. guest)

**Requirements:**
- Use Supabase Auth via @supabase/ssr for server-side rendering
- Maintain user session across page reloads
- Redirect authenticated users to `/today` automatically
- Redirect unauthenticated users away from protected routes to `/auth/login`
- Style login/signup pages to match hero page (`src/app/page.tsx`)
- Light backgrounds, readable typography, mobile-first (max 480px)

**Implementation checklist:**
- [ ] Create `src/lib/supabase-server.ts` (if not exists) with session management
- [ ] Create `src/lib/supabase.ts` (client-side)
- [ ] Build login page at `/auth/login` with email input + submit
- [ ] Build signup page at `/auth/signup` (or single form)
- [ ] Add username input/setup after signup redirect
- [ ] Add logout to `src/components/BottomNav.tsx` or header
- [ ] Test session persistence across navigation
- [ ] Add loading states and error messages
- [ ] Verify RLS on `profiles` table matches auth schema

**Test cases:**
1. Guest visits landing page → sees "Play for free" button
2. Click login → redirected to `/auth/login`
3. Enter email → receive magic link
4. Click link → email verified, create password
5. Enter username → redirected to `/today`
6. Refresh page → still logged in
7. Click logout → redirected to landing page
8. Try to visit `/picks` while logged out → redirected to `/auth/login`

**Deliverable:** 
- Full auth flow working end-to-end
- Username stored in Supabase `profiles` table
- Session persists across reloads
- Navigation updates based on auth state
- Error messages clear (invalid email, mismatched password, etc.)
```

---

## 2. Match Picks Core Feature (My Picks)

**File:** `src/app/picks/`, `src/components/MatchCard.tsx`  
**Scope:** Pick prediction, submission, locking, live updates  
**Effort:** 2–3 days  

```
DEPLOYMENT PROMPT: Match Picks Core (My Picks Mode)

Build the core match prediction feature where users pick scorelines for every match.

**Scope:**
1. Matches page (`/picks`) with all 80+ tournament matches
2. Organize matches by group (A–L) and knockout stage (R32, R16, QF, SF, Final)
3. Filter: Upcoming / Live / All
4. Match card component showing: teams, kickoff time, score input
5. Confidence multiplier selector (1×, 2×, 3×)
6. Save pick to database (editable until kickoff)
7. Lock mechanism: prevent picks after kickoff
8. Display results with badge (EXACT / CORRECT / WRONG) and points earned
9. Real-time updates for live matches

**Requirements:**
- Matches table must be seeded with all 80+ tournament matches
- Kickoff times in UTC (convert to user's timezone for display)
- Match data: home_team, away_team, kickoff_time, group_letter, stage, status
- Picks table schema: user_id, match_id, home_score, away_score, confidence_multiplier, points_earned, pick_result
- Scoring: 0 (wrong), 3 (correct outcome), 5 (exact score) × multiplier
- Lock time: match kickoff_time in UTC (isMatchLocked() utility)
- Real-time: subscribe to matches table for live score updates

**UI Components:**
- Match card template at `src/components/MatchCard.tsx`:
  * Team names and flags
  * Kickoff time (user's timezone)
  * Score input: two number fields (home, away)
  * Confidence selector: three buttons (1×, 2×, 3×)
  * Save/Update button
  * Locked state: show lock icon, disable inputs
- Section headers by group and stage
- Filter tabs: Upcoming / Live / All
- Progress indicator: "X/Y picked" per section
- Post-match badge: result + points

**Implementation checklist:**
- [ ] Seed tournament matches (all 80+ matches) to database
- [ ] Create `MatchWithPick` type in `src/lib/types.ts`
- [ ] Build `/picks` page to fetch matches grouped by stage/group
- [ ] Implement `MatchCard` component with score input
- [ ] Add confidence multiplier selector
- [ ] Implement `isMatchLocked()` utility (compare kickoff vs. current time)
- [ ] Handle pick save: POST to `/api/save-pick` (or direct upsert)
- [ ] Add real-time subscription to matches via Supabase
- [ ] Display pick result badge after match finishes
- [ ] Add error handling and loading states
- [ ] Test on mobile (375px viewport)

**Test cases:**
1. User opens `/picks` → sees all matches grouped by stage
2. Clicks "Upcoming" filter → shows only non-locked matches
3. Enters home score (2) and away score (1) → saves pick
4. Confidence selector shown; user picks 2×
5. Kickoff time passes → match locked, inputs disabled, lock icon shown
6. Match finishes (status = FT, actual score 2-1) → badge shows "EXACT +10 pts" (5×2)
7. Live match shows real-time score update within 5 seconds
8. User returns to page → previous picks are preserved
9. Invalid input (text in score field) → validation error

**Deliverable:**
- `/picks` page fully functional
- All matches seeded and visible
- Picks save, lock, and score correctly
- Real-time updates working
- Mobile-responsive
- Error handling for network/validation issues
```

---

## 3. Bracket Picker & Submission

**File:** `src/app/bracket/`, `src/components/BracketReviewer.tsx`  
**Scope:** Bracket form, group/knockout selection, lock mechanism, scoring  
**Effort:** 3–4 days  

```
DEPLOYMENT PROMPT: Bracket Picker & Submission

Build the tournament bracket predictor where users fill out a complete 64-match bracket.

**Scope:**
1. Bracket page (`/bracket`) with sequential picker
2. Stage 1: Groups — pick 1st and 2nd place for all 12 groups (A–L)
3. Stage 2: Third-place — pick 8 qualifying third-place teams (out of 12)
4. Stage 3–7: Knockout rounds (R32, R16, QF, SF, Final)
5. Bracket locks June 11, 2026 15:00 UTC
6. After lock: read-only view with scoring
7. Display results (green ✓ / red ✗) as tournament progresses
8. Calculate bracket score and persist to league_scores.bracket_points

**Requirements:**
- Bracket structure matches GDD Section 2.2
- Lock time: June 11, 2026 15:00 UTC (configurable via env var)
- Lock warning: show 24 hours before lock
- Scoring per GDD: 2 (group), 2 (3rd-place), 3 (R32), 5 (R16), 8 (QF), 13 (SF), 21 (Final)
- Schema: bracket_entries table (user_id, tournament_year, bracket_state JSON, locked_at, scored_at)
- Post-lock: bracket immutable but visible
- Realtime: update results as admin posts tournament outcomes

**UI Components:**
- Sequential picker (wizard-like progression)
  * Groups picker: 12 groups, 2 picks each (1st/2nd place)
  * Third-place picker: visual indicator of which teams qualify from groups
  * Knockout rounds: tree/bracket view showing matchups
- Submit button (only visible if all picks complete and before lock)
- Lock warning: countdown timer 24h before lock
- Post-lock display: read-only bracket with result badges
- Scoring breakdown: "20 pts from groups, 8 pts from R16, ..." etc.

**Implementation checklist:**
- [ ] Create `bracket_entries` table schema in Supabase
- [ ] Create `tournament_results` table (admin-populated actuals)
- [ ] Build `/bracket` page with multi-stage picker
- [ ] Implement group picker UI (12 groups, 2 dropdowns each)
- [ ] Implement third-place picker (visual feedback on group results)
- [ ] Implement knockout tree picker (match selectors)
- [ ] Add bracket state management (local state + db)
- [ ] Implement lock mechanism: disable form at June 11 15:00 UTC
- [ ] Add lock warning component (24h countdown)
- [ ] Build bracket reviewer (read-only view with results)
- [ ] Implement `api/score-bracket` endpoint
- [ ] Trigger scoring when admin updates tournament results
- [ ] Calculate bracket_points and update league_scores
- [ ] Add error handling and validation
- [ ] Test mobile layout (sequential picker on small screens)

**Test cases:**
1. User opens `/bracket` before lock → sees group picker
2. Selects 1st/2nd place for all 12 groups
3. Clicks "Next" → third-place picker shown
4. Selects 8 third-place qualifiers based on group picks
5. Clicks "Next" → knockout tree shown (R32 matchups)
6. Completes all knockout rounds
7. Clicks "Submit" → bracket locked and stored
8. Lock time passes → form disabled, read-only view shown
9. Admin updates a tournament result (e.g., Final winner = France)
10. User's bracket reviewer shows "CORRECT ✓" for matching pick, points added

**Deliverable:**
- Bracket picker fully functional with all 7 stages
- Lock mechanism working (June 11 15:00 UTC)
- Scoring engine triggered on tournament updates
- Bracket reviewer showing results
- Mobile-responsive (tree may scroll horizontally)
- Error handling and validation
```

---

## 4. League Leaderboards (Dual-Mode)

**File:** `src/app/leagues/[id]/`, `src/components/LeagueLeaderboard.tsx`  
**Scope:** Dual tabs (Picks/Bracket), real-time standings, rankings  
**Effort:** 2–3 days  

```
DEPLOYMENT PROMPT: League Leaderboards with Dual-Mode Standings

Build league leaderboard pages showing independent "My Picks" and "Bracket" rankings.

**Scope:**
1. League page (`/leagues/[id]`) accessible to league members
2. Dual tabs: "My Picks" | "Bracket"
3. Each tab shows independent leaderboard with rankings
4. Columns: Rank, Player, Points, Exact Scores (or other KPI)
5. Rank change indicator (↑ ↓ —) from last update
6. Real-time updates: scores refresh without page reload
7. Sort/filter options (by name, points, etc.)

**Requirements:**
- Schema: league_scores (league_id, user_id, picks_points, bracket_points, picks_rank, bracket_rank, picks_rank_change, bracket_rank_change)
- Real-time subscription to league_scores table
- Rank change tracked per mode (picks vs. bracket)
- Accurate points aggregation from picks and bracket_entries
- Mobile-responsive table (may scroll horizontally)
- Empty state for new leagues (no scores yet)

**UI Components:**
- Tab switcher: "My Picks" | "Bracket"
- Leaderboard table:
  * Rank (with change indicator: ↑ 2 / ↓ 1 / — )
  * Player name
  * Points (or separate "Picks Pts" + "Bracket Pts")
  * Exact scores (or matches picked correctly)
  * Optional: trend chart (line graph of score over time)
- League header: name, commissioner, member count
- Member list (optional, separate section or modal)
- Settings (if user is commissioner): invite code, member management, etc.

**Implementation checklist:**
- [ ] Create league_scores schema (dual-mode columns)
- [ ] Build `/leagues/[id]` page with tab switcher
- [ ] Implement leaderboard table component
- [ ] Add real-time subscription to league_scores
- [ ] Implement rank calculation and change tracking
- [ ] Add sort/filter controls
- [ ] Build league header and member list
- [ ] Add empty state message
- [ ] Implement commissioner settings (if time)
- [ ] Add error handling (league not found, user not member)
- [ ] Test mobile layout (table scrolls horizontally)

**Test cases:**
1. Commissioner creates league "The Lads"
2. Adds 3 members (Dan, Alex, Charlie)
3. After first match scores: leaderboard shows "Picks" tab
4. Dan: 142 pts (Rank 1), Alex: 138 pts (Rank 2), Charlie: 130 pts (Rank 3)
5. Another match scores, Dan's picks correct but not others
6. Leaderboard updates in real-time (within 2 seconds)
7. Rank change shows: Dan ↑ 1 (was rank 2), etc.
8. Click "Bracket" tab → independent rankings shown
9. Scroll on mobile → table scrolls horizontally (not page)

**Deliverable:**
- Dual-tab leaderboard fully functional
- Real-time updates working (no manual refresh)
- Rank calculations accurate
- Mobile-responsive
- Error handling and empty states
```

---

## 5. Global Leaderboard

**File:** `src/app/leaderboard/`  
**Scope:** Global standings across all users, dual tabs  
**Effort:** 1–2 days  

```
DEPLOYMENT PROMPT: Global Leaderboard

Build a global leaderboard showing top players across all users, split by game mode.

**Scope:**
1. Leaderboard page (`/leaderboard`) public to all users
2. Dual tabs: "My Picks" | "Bracket"
3. Display top N players (configurable, e.g., 100)
4. Columns: Rank, Player, League, Points, Location (if public)
5. Pagination or infinite scroll for large lists
6. Real-time updates as scores change

**Requirements:**
- Global standings aggregated from league_scores and global_scores tables
- Top 100 players ranked by points (picks or bracket, separately)
- Real-time subscription to global_scores
- Optional: filter by country or league
- Fast query (indexed on points, created_at)

**UI Components:**
- Tab switcher: "My Picks" | "Bracket"
- Leaderboard table: Rank, Player, Points, Leagues, Change
- Pagination: "Load More" button or infinite scroll
- Optional filters/search

**Implementation checklist:**
- [ ] Create global_scores table schema
- [ ] Build `/leaderboard` page
- [ ] Implement global ranking query (top 100)
- [ ] Add real-time subscription to global_scores
- [ ] Implement pagination/infinite scroll
- [ ] Add tab switcher for dual modes
- [ ] Test with large datasets (simulate 1000+ users)

**Test cases:**
1. Visit `/leaderboard` → top 100 players displayed
2. Click "Bracket" tab → independent bracket rankings shown
3. Scroll to bottom → "Load More" loads next 100 players
4. A player scores → leaderboard updates in real-time
5. Rank changes reflected without page reload

**Deliverable:**
- Global leaderboard fully functional
- Dual-mode splits working
- Pagination/infinite scroll
- Real-time updates
- Performance tested (no N+1, fast queries)
```

---

## 6. Scoring Engine (Both Modes)

**File:** `src/app/api/score-picks/`, `src/app/api/score-bracket/`  
**Scope:** Automated scoring for picks and bracket, standings recalculation  
**Effort:** 2–3 days  

```
DEPLOYMENT PROMPT: Automated Scoring Engine

Build the backend scoring engine that calculates points for both game modes and updates leaderboards.

**Scope:**
1. Score-Picks endpoint: triggered when a match finishes
   - Input: match_id, actual_home_score, actual_away_score
   - Logic: compare vs. all user picks, calculate points (0/3/5 × multiplier)
   - Output: update picks.points_earned, picks.pick_result
   - Recalculate league standings for affected users
2. Score-Bracket endpoint: triggered when tournament result updated
   - Input: round, match_id, winner_team_id
   - Logic: compare vs. all user bracket picks, award points (2/3/5/8/13/21)
   - Output: update league_scores.bracket_points
3. Ranking recalculation: after each score update
   - Recalculate league_scores.rank and rank_change for affected league
   - Recalculate global_scores.rank

**Requirements:**
- Endpoints must be authenticated (admin-only or cron-token verified)
- Idempotent: running twice produces same result (no double-counting)
- Fast: process all picks for a match in <2 seconds
- Accurate: implement exact scoring logic from GDD Section 2
- Trigger real-time updates via Supabase broadcast

**Scoring Logic:**
My Picks mode:
  - 0 pts: wrong outcome (W/D/L)
  - 3 pts: correct outcome
  - 5 pts: exact score (correct outcome + correct goal diff)
  - Multiplied by confidence (1×, 2×, 3×)
  
Bracket mode:
  - 2 pts: group stage (1st/2nd correct)
  - 2 pts: correct 3rd-place qualifier
  - 3 pts: R32 correct winner
  - 5 pts: R16 correct winner
  - 8 pts: QF correct winner
  - 13 pts: SF correct winner
  - 21 pts: Final correct winner

**Implementation checklist:**
- [ ] Implement score-picks logic (match finish → award points)
- [ ] Implement score-bracket logic (tournament result → award points)
- [ ] Create recalculate_league_standings() function
- [ ] Create recalculate_global_standings() function
- [ ] Add admin-only authentication to both endpoints
- [ ] Test idempotency (score same match twice → no double-count)
- [ ] Add logging for audit trail
- [ ] Optimize queries (batch updates, indexed lookups)
- [ ] Broadcast via Supabase realtime to trigger UI updates
- [ ] Handle edge cases (late updates, correction of previous scores)

**Test cases:**
1. Match finishes: USA 2-1 Mexico (actual)
2. User A picked 2-1 (confidence 2×) → 10 pts
3. User B picked 2-0 → 3 pts (correct outcome)
4. User C picked 1-1 → 0 pts
5. POST /api/score-picks with match_id and scores
6. league_scores updated in real-time for all three users
7. Leaderboard tabs updated without page refresh
8. POST again (same data) → no double-count, same points

**Deliverable:**
- Both scoring endpoints fully functional
- Ranking recalculation working
- Real-time updates via Supabase
- Idempotent and fast
- Comprehensive logging
- Production-ready with error handling
```

---

## 7. Deployment to Cloudflare Workers

**File:** `wrangler.toml`, `src/`, Next.js config  
**Scope:** Build, test, and deploy to Cloudflare Workers via OpenNext  
**Effort:** 1–2 days  

```
DEPLOYMENT PROMPT: Cloudflare Workers Deployment

Deploy the Soccer Fantasy Game app to Cloudflare Workers with database and environment config.

**Scope:**
1. Configure OpenNext adapter for Cloudflare
2. Build app for Cloudflare Workers runtime
3. Set up wrangler.toml with correct bindings
4. Configure environment variables (.env.production)
5. Deploy and test on Cloudflare domain
6. Set up custom domain and SSL
7. Configure cron jobs for sync-scores and scoring

**Requirements:**
- OpenNext builder: @opennextjs/cloudflare
- Runtime: Cloudflare Workers (ES modules)
- Database: Supabase (remote, via HTTPS)
- Environment: Supabase URL, API key, JWT secret
- Cron: Scheduled Worker for sync-scores
- No serverless functions; all via Workers

**Implementation checklist:**
- [ ] Install @opennextjs/cloudflare adapter
- [ ] Configure next.config.js for Cloudflare
- [ ] Update wrangler.toml with correct project ID
- [ ] Set production environment variables
- [ ] Build locally: npm run pages:build
- [ ] Preview locally: npm run preview
- [ ] Test all routes (auth, picks, bracket, leagues, etc.)
- [ ] Deploy: npm run pages:deploy
- [ ] Set up custom domain (soccer-fantasy-game.example.com)
- [ ] Configure SSL/TLS
- [ ] Set up cron jobs (see Cron Jobs section)
- [ ] Monitor logs and errors

**Cron Jobs:**
- Sync scores: every 5 mins during matches (15:00–23:00 UTC match times)
- Score picks: after each match (triggered by sync-scores)
- Notifications: 24h before pick locks, league updates

**Test cases:**
1. Build locally: npm run pages:build (no errors)
2. Preview: npm run preview (app loads at localhost)
3. Navigate all pages (should work offline-first)
4. Deploy: npm run pages:deploy
5. Test live: www.example.com/picks, /bracket, /leaderboard
6. Verify auth (login/logout works)
7. Make a pick, submit bracket, check leaderboard
8. Check Cloudflare logs for errors
9. Verify cron jobs run (check logs at 15:00 UTC)

**Deliverable:**
- App successfully deployed to Cloudflare Workers
- Custom domain working with SSL
- All pages functional
- Cron jobs scheduled and running
- Logs and monitoring configured
- README updated with deployment instructions
```

---

# HIGH-PRIORITY FEATURES

## 8. Admin Panel

**File:** `src/app/admin/`  
**Scope:** Admin controls for seeding, results, and testing  
**Effort:** 1–2 days  

```
DEPLOYMENT PROMPT: Admin Panel

Build an admin-only dashboard for managing tournament data and testing features.

**Admin Functions:**
1. Seed tournament data (matches, teams)
2. Update tournament results (group standings, knockout winners)
3. Manually trigger scoring (for testing)
4. Reset picks for a user or league (testing)
5. View user and league stats
6. Simulate match results (for pre-tournament testing)

**Implementation:**
- `/admin` page (auth check: user.role == 'admin')
- Database functions: seed_matches(), update_tournament_result(), etc.
- Forms to input data and trigger operations
- Confirmation dialogs for destructive actions
- Logging of all admin actions (audit trail)

**Test cases:**
1. Admin logs in → sees `/admin` panel
2. Seeds tournament matches → all 80+ matches in database
3. Updates Final result → bracket scores recalculated for all users
4. Views league stats → sees all leagues and member counts
5. Simulates a group stage match result → scoring triggered

**Deliverable:**
- Admin panel fully functional
- All seeding and update functions working
- Audit trail of admin actions
```

---

## 9. Live Score Sync

**File:** `src/app/api/sync-scores/`, cron config  
**Scope:** Periodic score fetch and real-time updates  
**Effort:** 1–2 days  

```
DEPLOYMENT PROMPT: Live Score Sync Worker

Build automated score syncing from football-data.org API.

**Scope:**
1. Cron job runs every 5 minutes during match times
2. Fetch latest scores from football-data.org
3. Update matches table (home_score, away_score, status)
4. Trigger score-picks when match status = FT
5. Broadcast updates via Supabase realtime

**Implementation:**
- `api/sync-scores` endpoint (POST, cron-token secured)
- Fetch from football-data.org/competitions/WC/matches
- Compare vs. database and update deltas
- Trigger `/api/score-picks` for finished matches
- Log errors and retries

**Test cases:**
1. During match, scores update every 5 minutes
2. Match ends, status = FT → score-picks triggered
3. Real-time subscription receives update
4. Live page shows updated score within 5 seconds

**Deliverable:**
- Cron job syncing live scores
- Real-time broadcasts working
- Triggering scoring engine
```

---

## 10. Tournament Bonus Picks

**File:** `src/app/picks/`, database schema  
**Scope:** Champion, runner-up, golden boot predictions  
**Effort:** 1 day  

```
DEPLOYMENT PROMPT: Tournament Bonus Picks

Add bonus prediction picks for champion, runner-up, and golden boot winner.

**Scope:**
1. After group stage ends, show bonus picks section
2. Pick: Champion (10 pts), Runner-up (5 pts), Golden Boot (5 pts)
3. Lock at group stage end date
4. Score when tournament ends
5. Add points to user's picks_points

**Implementation:**
- Table: tournament_bonus_picks (user_id, tournament_year, champion_team_id, runner_up_team_id, golden_boot_player_id)
- Lock logic: unlock after group stage, lock at group stage end
- Scoring: compare vs. actual tournament results
- Display on /picks page in collapsible "Bonus Picks" section

**Deliverable:**
- Bonus picks functional
- Lock timing correct
- Scoring integrated
```

---

# LOWER PRIORITY (Post-Launch)

## 11. League Chat

**File:** `src/components/LeagueChat.tsx`  
**Scope:** Real-time chat for league members  
**Effort:** 2 days  

```
DEPLOYMENT PROMPT: League Chat

Build real-time chat for league members to trash talk and coordinate.

**Scope:**
1. Chat box in league page (`/leagues/[id]`)
2. Real-time message send/receive via Supabase realtime
3. Message history (last 100 messages)
4. User names and timestamps
5. Optional: message reactions (👍 etc.)

**Implementation:**
- Table: league_chat_messages (id, league_id, user_id, message, created_at)
- Subscribe to messages for league in real-time
- Send message form at bottom of chat
- Scroll to latest message on new message
- Mobile: may be collapsible to not crowd page

**Deliverable:**
- League chat fully functional
- Real-time message updates
- Mobile-friendly
```

---

## 12. Notifications & Email

**File:** `src/app/api/notify-*.ts`, email config  
**Scope:** Reminders and alerts via email  
**Effort:** 1–2 days  

```
DEPLOYMENT PROMPT: Notifications & Reminders

Send email reminders for picks deadlines and league invites.

**Types:**
1. Picks reminder: 24h before group stage ends
2. League invite: when user invited to new league
3. League updates: optional digest (weekly? match-by-match?)

**Implementation:**
- Resend API for email (already in package.json)
- Cron job for scheduled reminders
- Email templates (HTML)
- Opt-in/opt-out user preferences

**Deliverable:**
- Email reminders sending correctly
- User preferences respected
- Clear unsubscribe links
```

---

## 13. Stats & Analytics Page

**File:** `src/app/stats/`  
**Scope:** User performance insights  
**Effort:** 1–2 days  

```
DEPLOYMENT PROMPT: Stats & Analytics

Build stats page showing user performance and predictions.

**Stats:**
1. Picks accuracy: % correct outcomes, % exact scores
2. Bracket progress: correct picks so far
3. Current rank in leagues and global
4. Trends: accuracy chart over time
5. Comparison: vs. league average, vs. global average

**Implementation:**
- `/stats` page
- Calculate stats from picks, bracket_entries, league_scores
- Simple charts (recharts already available)
- Mobile-responsive

**Deliverable:**
- Stats page fully functional
- Accurate calculations
- Clear visualizations
```

---

## Usage Instructions

1. **Run Master Audit First:** Execute the prompt in `VERIFICATION-AUDIT.md` to identify exact gaps.

2. **Prioritize by Impact:**
   - CRITICAL: Features marked "critical" must be done before launch
   - HIGH: Important features, but can launch without
   - LOW: Nice-to-have, post-launch

3. **Deploy in Order:**
   - Auth must be first (blocks all other features)
   - Picks and Bracket independent, but both needed for launch
   - Leagues depends on both Picks and Bracket
   - Scoring Engine depends on both Picks and Bracket
   - Deployment last (after all features coded)

4. **Copy Individual Prompts:**
   - Select one feature at a time
   - Copy the deployment prompt into a new Claude session
   - Focus on single feature until complete
   - Test thoroughly before moving to next

5. **Track Progress:**
   - Update GDD milestone status as features complete
   - Update CHANGELOG with each completed feature
   - Document any blockers or design decisions

---

## Effort Estimates (Total)

| Category | Est. Effort | Days |
|----------|------------|------|
| CRITICAL | ~10 days | 2 weeks |
| HIGH | ~5 days | 1 week |
| LOW | ~4 days | 1 week |
| **TOTAL** | **~19 days** | **4 weeks** |

**Fast-track:** Focus on CRITICAL only (~10 days) for MVP launch.


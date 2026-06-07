# Soccer Fantasy Game — Design Prompt

## Overview

Design a mobile-first soccer tournament companion app that serves as the ultimate fan experience during a major international soccer tournament. The app should cover the full tournament lifecycle — from group stage through the final — delivering real-time updates, rich statistics, and social engagement in a fast, visually compelling interface.

---

## Core Functionality

### 1. Live Match Center
- Real-time score updates for all matches currently in progress
- Live match timeline: goals, yellow/red cards, substitutions, and key events displayed chronologically
- Minute-by-minute commentary feed
- Live stats panel: possession, shots on target, passes, fouls, corners
- Push notifications for goals, red cards, and final whistles (user-configurable per team)

### 2. Full Tournament Bracket & Schedule
- Interactive bracket view covering all 8 groups, Round of 32/16, Quarters, Semis, and Final
- Match cards showing: teams, kickoff time (localized to user's timezone), venue, and current/final score
- Filter by group, date, or country
- Countdown timers for upcoming matches
- Add-to-calendar integration for any match

### 3. Team Profiles
- Full squad roster with player photos, positions, ages, caps, and club affiliations
- Tournament stats: goals scored/conceded, possession averages, disciplinary record
- Historical tournament performance summary
- Upcoming and past match results for the tournament

### 4. Player Stats & Leaderboards
- Golden Boot tracker: top scorers ranked with goals, assists, and shots on target
- Golden Glove tracker: goalkeeper rankings by saves, clean sheets, save percentage
- Best XI based on current tournament performance
- Search and filter players by position, nationality, or club

### 5. Group Stage Standings
- Live standings table for all 8 groups: W/D/L, GF, GA, GD, points
- Tiebreaker logic explained inline when teams are level on points
- Qualification scenarios: highlight which results would advance or eliminate each team
- Visual indicator for teams that have advanced, are eliminated, or are on the bubble

### 6. Predictions & Fan Picks
- Before each match: pick the winner or score (exact result for bonus points)
- Season-long leaderboard tracking prediction accuracy across all users
- Tournament bracket challenge: pick the full bracket before the group stage, earn points as predictions land
- Weekly digest of how the user's picks fared

### 7. News & Highlights
- Curated match highlights (video clips) for completed games
- Tournament news feed: injuries, press conferences, tactical analysis
- Photo galleries for each match

### 8. Venue & Host City Guide
- Interactive map of all stadiums with capacity, surface type, and city info
- Local weather for match day at each venue
- Time zone reference for international fans

---

## Design Direction

**Aesthetic:** Bold, high-energy, and international. Use the official tournament color palette as a base, with high contrast for scores and live indicators. Clean typographic hierarchy — scores should be immediately legible at a glance.

**Layout philosophy:** Thumb-friendly bottom navigation. The Live tab is always one tap away. Cards-based design for match listings with clear visual state: upcoming (muted), live (pulsing accent), completed (neutral).

**Key screens to design:**
1. Home / Today's Matches dashboard
2. Live match detail view
3. Bracket / Tournament tree
4. Team profile page
5. Player leaderboard
6. Group standings table
7. My Predictions hub

**Accessibility:** High contrast mode, scalable text, screen reader support for scores and standings.

---

## Technical Constraints & Notes

- Data source: an official or licensed sports data provider (Opta, StatsBomb, football-data.org)
- Offline mode: cache last-known standings and schedule for users without connectivity
- Notifications: opt-in per team, per match type (goals only vs. all events)
- Localization: support at minimum English, Spanish, French, Portuguese, and Arabic (RTL)
- Performance: live match views must refresh without full page reload; use WebSocket or SSE for score updates

---

## Tone & Voice

Energetic but informative. The app speaks like a knowledgeable fan, not a dry stats feed. Use tournament-appropriate language ("The group of death," "knockout stage," "clean sheet") and celebrate goals and upsets with enthusiastic but concise copy.

---

## Success Criteria

A user should be able to:
- Open the app and immediately see which matches are live and what the scores are
- Tap into any match and understand exactly what's happening without needing another app
- Find any player, team, or stat within 2 taps from the home screen
- Make a prediction before every match and track their standing in under 30 seconds

// =============================================
// FEATURE FLAGS — UI visibility toggles
// =============================================
// Flip a flag back to `true` to re-expose a feature. These gate the UI only; the
// backend (scoring, routes, DB columns) is left intact, so re-enabling is a
// one-line change.
//
// NOTE: the Bracket Reset toggle lives in `lib/bracket.ts` (BRACKET_RESET_ENABLED)
// because it's coupled to the bracket mode list. This file holds app-wide flags.

// Match Picks — the scoreline-prediction game (/picks). Hidden for now so the app
// surfaces only the Up-Front Pick'em bracket. Re-enable to bring back the Picks
// nav entries, route, standings column, player-summary tab, and How-to-Play game.
export const MATCH_PICKS_ENABLED = false

-- =============================================
-- SOCCER FANTASY GAME — SUPABASE SCHEMA
-- Run this in the Supabase SQL editor
-- =============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- PROFILES (extends auth.users)
-- =============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles readable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
-- NOTE: search_path must be pinned to public so the trigger can resolve
-- public.profiles when firing in the context of auth.users (different schema).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- TEAMS
-- =============================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_code CHAR(3) NOT NULL UNIQUE,
  group_letter CHAR(1),   -- A–L (2026 has 12 groups)
  flag_emoji TEXT,
  api_id INTEGER,          -- football-data.org team ID
  eliminated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams readable by all" ON teams FOR SELECT USING (true);
CREATE POLICY "Only service role can write teams" ON teams FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- MATCHES
-- =============================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_match_id INTEGER UNIQUE,
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  kickoff_time TIMESTAMPTZ NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('GROUP','R32','R16','QF','SF','THIRD','FINAL')),
  group_letter CHAR(1),
  home_score INTEGER,
  away_score INTEGER,
  home_score_ht INTEGER,   -- half time
  away_score_ht INTEGER,
  status TEXT DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','LIVE','FINISHED','POSTPONED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches readable by all" ON matches FOR SELECT USING (true);
CREATE POLICY "Only service role can write matches" ON matches FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- PICKS
-- =============================================
CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  home_score_pick INTEGER NOT NULL CHECK (home_score_pick >= 0),
  away_score_pick INTEGER NOT NULL CHECK (away_score_pick >= 0),
  confidence_multiplier INTEGER DEFAULT 1 CHECK (confidence_multiplier IN (1,2,3)),
  points_earned INTEGER,
  pick_result TEXT CHECK (pick_result IN ('EXACT','CORRECT','WRONG')),
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see all picks after match kickoff" ON picks FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND m.kickoff_time < NOW()
    )
  );
CREATE POLICY "Users insert own picks before kickoff" ON picks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND m.kickoff_time > NOW()
    )
  );
CREATE POLICY "Users update own picks before kickoff" ON picks FOR UPDATE
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND m.kickoff_time > NOW()
    )
  );

-- =============================================
-- TOURNAMENT PICKS (champion + golden boot)
-- =============================================
CREATE TABLE tournament_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  champion_team_id UUID REFERENCES teams(id),
  runner_up_team_id UUID REFERENCES teams(id),
  golden_boot_player TEXT,
  champion_points INTEGER DEFAULT 0,
  runner_up_points INTEGER DEFAULT 0,
  golden_boot_points INTEGER DEFAULT 0,
  locked BOOLEAN DEFAULT false,  -- locks after group stage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournament_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournament picks readable by all after lock" ON tournament_picks FOR SELECT
  USING (auth.uid() = user_id OR locked = true);
CREATE POLICY "Users manage own tournament picks" ON tournament_picks FOR ALL
  USING (auth.uid() = user_id AND NOT locked);

-- =============================================
-- LEAGUES
-- =============================================
CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  commissioner_id UUID REFERENCES profiles(id),
  max_members INTEGER DEFAULT 50,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS enabled but policies that reference league_members are added AFTER that table exists (see bottom of file)
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users create leagues" ON leagues FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Commissioner updates league" ON leagues FOR UPDATE USING (auth.uid() = commissioner_id);
-- Allows the commissioner to see the league immediately after INSERT...select(),
-- before they've been added to league_members.
CREATE POLICY "Commissioner can view own league" ON leagues FOR SELECT USING (auth.uid() = commissioner_id);

-- =============================================
-- LEAGUE MEMBERS
-- =============================================
CREATE TABLE league_members (
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (league_id, user_id)
);

-- Helper: check league membership without triggering RLS on league_members.
-- SECURITY DEFINER runs as postgres (bypasses RLS), preventing infinite recursion
-- in any policy that needs to verify membership.
CREATE OR REPLACE FUNCTION public.is_league_member(p_league_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = p_league_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League members visible to members" ON league_members FOR SELECT
  USING (public.is_league_member(league_id));
CREATE POLICY "Users join leagues" ON league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave leagues" ON league_members FOR DELETE USING (auth.uid() = user_id);

-- leagues SELECT policy deferred until here so league_members exists
CREATE POLICY "Public leagues readable" ON leagues FOR SELECT USING (
  is_public = true OR public.is_league_member(id)
);

-- =============================================
-- CHAT MESSAGES
-- =============================================
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  reaction_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League members read chat" ON chat_messages FOR SELECT
  USING (public.is_league_member(league_id));
CREATE POLICY "League members post chat" ON chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND public.is_league_member(league_id)
  );
CREATE POLICY "Users delete own messages" ON chat_messages FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- LEAGUE SCORES (materialized standings)
-- =============================================
CREATE TABLE league_scores (
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  correct_results INTEGER DEFAULT 0,
  exact_scores INTEGER DEFAULT 0,
  picks_made INTEGER DEFAULT 0,
  rank INTEGER,
  rank_change INTEGER DEFAULT 0,  -- positive = moved up
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (league_id, user_id)
);

ALTER TABLE league_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League scores visible to members" ON league_scores FOR SELECT
  USING (public.is_league_member(league_id));

-- =============================================
-- GLOBAL SCORES (one row per user)
-- =============================================
CREATE TABLE global_scores (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  total_points INTEGER DEFAULT 0,
  correct_results INTEGER DEFAULT 0,
  exact_scores INTEGER DEFAULT 0,
  picks_made INTEGER DEFAULT 0,
  global_rank INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE global_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Global scores public" ON global_scores FOR SELECT USING (true);

-- =============================================
-- SCORING CONFIGURATION
-- =============================================
CREATE TABLE scoring_config (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  description TEXT
);

INSERT INTO scoring_config (key, value, description) VALUES
  ('correct_result_pts', 3, 'Points for predicting correct W/D/L result'),
  ('exact_score_bonus', 2, 'Bonus points on top of correct result for exact score'),
  ('champion_pts', 10, 'Points for correct tournament champion'),
  ('runner_up_pts', 5, 'Points for correct runner-up'),
  ('golden_boot_pts', 5, 'Points for correct golden boot winner');

ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scoring config readable by all" ON scoring_config FOR SELECT USING (true);
CREATE POLICY "Only service role updates scoring" ON scoring_config FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- FUNCTIONS: recalculate league rankings
-- =============================================
CREATE OR REPLACE FUNCTION recalculate_league_rankings(p_league_id UUID)
RETURNS VOID AS $$
DECLARE
  r RECORD;
  prev_rank INTEGER;
  curr_rank INTEGER := 0;
  prev_points INTEGER := -1;
  same_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT ls.user_id, ls.total_points,
           ls.rank AS old_rank
    FROM league_scores ls
    WHERE ls.league_id = p_league_id
    ORDER BY ls.total_points DESC
  LOOP
    curr_rank := curr_rank + 1;
    UPDATE league_scores
    SET rank = curr_rank,
        rank_change = COALESCE(r.old_rank, curr_rank) - curr_rank
    WHERE league_id = p_league_id AND user_id = r.user_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REALTIME
-- =============================================
-- Enable realtime for chat and scores
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE league_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE global_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- =============================================
-- SEED: TOURNAMENT GROUPS A-L
-- (48 teams, 12 groups of 4)
-- Add your actual team data here
-- =============================================
-- Example:
-- INSERT INTO teams (name, short_code, group_letter, flag_emoji) VALUES
--   ('United States', 'USA', 'A', '🇺🇸'),
--   ('Mexico', 'MEX', 'A', '🇲🇽'),
--   ('Canada', 'CAN', 'A', '🇨🇦'),
--   ('Honduras', 'HON', 'A', '🇭🇳'),
--   ... etc

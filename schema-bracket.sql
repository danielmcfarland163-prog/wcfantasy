-- =============================================
-- WORLD CUP FANTASY 2026 — BRACKET SCHEMA
-- Run this in the Supabase SQL editor
-- AFTER running the original schema.sql
-- =============================================

-- =============================================
-- BRACKET ENTRIES (one row per user)
-- Stores the full pick state as JSON blobs
-- =============================================
CREATE TABLE IF NOT EXISTS bracket_entries (
  user_id        UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  group_picks    JSONB DEFAULT '{}',         -- {A:{first:'Mexico',second:'...'}, B:{...}}
  third_picks    JSONB DEFAULT '{}',         -- {A:'Mexico', B:'...'} (which team from each group is picked 3rd)
  third_quals    JSONB DEFAULT '[]',         -- ['Mexico','Brazil',...] (8 qualifiers in order)
  r32_picks      JSONB DEFAULT '[]',         -- [teamName|null, ...] length 16
  r16_picks      JSONB DEFAULT '[]',         -- length 8
  qf_picks       JSONB DEFAULT '[]',         -- length 4
  sf_picks       JSONB DEFAULT '[]',         -- length 2
  final_pick     TEXT,
  locked         BOOLEAN DEFAULT false,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bracket_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own entry or after lock" ON bracket_entries FOR SELECT
  USING (auth.uid() = user_id OR locked = true);
CREATE POLICY "Users manage own entry before lock" ON bracket_entries FOR ALL
  USING (auth.uid() = user_id AND NOT locked);

-- =============================================
-- TOURNAMENT RESULTS (admin-maintained, 1 row)
-- Updated by admin/cron as tournament progresses
-- =============================================
CREATE TABLE IF NOT EXISTS tournament_results (
  id             SERIAL PRIMARY KEY,
  group_results  JSONB DEFAULT '{}',   -- {A:{first:'Mexico',second:'...',third:'...'}}
  third_quals    JSONB DEFAULT '[]',   -- actual 8 third-place qualifiers
  r32_results    JSONB DEFAULT '[]',   -- actual winners per slot
  r16_results    JSONB DEFAULT '[]',
  qf_results     JSONB DEFAULT '[]',
  sf_results     JSONB DEFAULT '[]',
  final_result   TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO tournament_results (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Results readable by all" ON tournament_results FOR SELECT USING (true);
CREATE POLICY "Only service role updates results" ON tournament_results FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- UPDATE global_scores description
-- (reusing existing columns with new meaning)
-- total_points    = bracket points
-- correct_results = total correct bracket picks
-- exact_scores    = 1 if champion correct
-- picks_made      = completeness (0–61 max picks)
-- =============================================

-- =============================================
-- SEED: 48 TEAMS (all 2026 World Cup teams)
-- short_code used as unique key
-- =============================================
INSERT INTO teams (name, short_code, group_letter, flag_emoji) VALUES
  ('Mexico',         'MEX', 'A', '🇲🇽'),
  ('South Korea',    'KOR', 'A', '🇰🇷'),
  ('South Africa',   'RSA', 'A', '🇿🇦'),
  ('Czechia',        'CZE', 'A', '🇨🇿'),
  ('Canada',         'CAN', 'B', '🇨🇦'),
  ('Switzerland',    'SUI', 'B', '🇨🇭'),
  ('Qatar',          'QAT', 'B', '🇶🇦'),
  ('Bosnia & Herz.', 'BIH', 'B', '🇧🇦'),
  ('Brazil',         'BRA', 'C', '🇧🇷'),
  ('Morocco',        'MAR', 'C', '🇲🇦'),
  ('Haiti',          'HAI', 'C', '🇭🇹'),
  ('Scotland',       'SCO', 'C', '🏴󠁧󠁢󠁳󠁣󠁴󠁿'),
  ('USA',            'USA', 'D', '🇺🇸'),
  ('Paraguay',       'PAR', 'D', '🇵🇾'),
  ('Australia',      'AUS', 'D', '🇦🇺'),
  ('Türkiye',        'TUR', 'D', '🇹🇷'),
  ('Germany',        'GER', 'E', '🇩🇪'),
  ('Curaçao',        'CUW', 'E', '🇨🇼'),
  ('Ivory Coast',    'CIV', 'E', '🇨🇮'),
  ('Ecuador',        'ECU', 'E', '🇪🇨'),
  ('Netherlands',    'NED', 'F', '🇳🇱'),
  ('Japan',          'JPN', 'F', '🇯🇵'),
  ('Sweden',         'SWE', 'F', '🇸🇪'),
  ('Tunisia',        'TUN', 'F', '🇹🇳'),
  ('Belgium',        'BEL', 'G', '🇧🇪'),
  ('Egypt',          'EGY', 'G', '🇪🇬'),
  ('Iran',           'IRN', 'G', '🇮🇷'),
  ('New Zealand',    'NZL', 'G', '🇳🇿'),
  ('Spain',          'ESP', 'H', '🇪🇸'),
  ('Cape Verde',     'CPV', 'H', '🇨🇻'),
  ('Saudi Arabia',   'KSA', 'H', '🇸🇦'),
  ('Uruguay',        'URU', 'H', '🇺🇾'),
  ('France',         'FRA', 'I', '🇫🇷'),
  ('Senegal',        'SEN', 'I', '🇸🇳'),
  ('Iraq',           'IRQ', 'I', '🇮🇶'),
  ('Norway',         'NOR', 'I', '🇳🇴'),
  ('Argentina',      'ARG', 'J', '🇦🇷'),
  ('Algeria',        'ALG', 'J', '🇩🇿'),
  ('Austria',        'AUT', 'J', '🇦🇹'),
  ('Jordan',         'JOR', 'J', '🇯🇴'),
  ('Portugal',       'POR', 'K', '🇵🇹'),
  ('DR Congo',       'COD', 'K', '🇨🇩'),
  ('Uzbekistan',     'UZB', 'K', '🇺🇿'),
  ('Colombia',       'COL', 'K', '🇨🇴'),
  ('England',        'ENG', 'L', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
  ('Croatia',        'CRO', 'L', '🇭🇷'),
  ('Ghana',          'GHA', 'L', '🇬🇭'),
  ('Panama',         'PAN', 'L', '🇵🇦')
ON CONFLICT (short_code) DO UPDATE
  SET name = EXCLUDED.name,
      group_letter = EXCLUDED.group_letter,
      flag_emoji = EXCLUDED.flag_emoji;

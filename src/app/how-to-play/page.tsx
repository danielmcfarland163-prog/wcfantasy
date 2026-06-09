import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import AppShell from '@/components/AppShell'
import { MATCH_PICKS_ENABLED } from '@/lib/features'
import { BRACKET_RESET_ENABLED } from '@/lib/bracket'

export const metadata = {
  title: 'How to Play · Soccer Fantasy',
  description: 'How the bracket scores, plus leagues and standings.',
}

/* ── Small presentational helpers (server-only, no hooks) ─────────── */

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} style={{ padding: '0 20px', marginTop: 30 }}>
      <div className="wc-section-head" style={{ color: 'var(--accent)', marginBottom: 4 }}>{eyebrow}</div>
      <h2 style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 23, color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.1 }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', ...style }}>
      {children}
    </div>
  )
}

function Lead({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontFamily: 'var(--f-body)', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 14px' }}>
      {children}
    </p>
  )
}

// A single scoring line: label + short note on the left, a points badge on the right.
function ScoreRow({
  label,
  note,
  pts,
  tone = 'accent',
  first,
}: {
  label: string
  note?: string
  pts: number | string
  tone?: 'accent' | 'win' | 'gold' | 'muted'
  first?: boolean
}) {
  const toneColor =
    tone === 'win' ? 'var(--win)' : tone === 'gold' ? 'var(--gold)' : tone === 'muted' ? 'var(--ink-3)' : 'var(--accent)'
  const badgeBg =
    tone === 'muted' ? 'var(--surface-2)' : `color-mix(in srgb, ${toneColor} 12%, transparent)`
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
      borderTop: first ? 'none' : '1px solid var(--line)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--f-body)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{label}</div>
        {note && <div style={{ fontFamily: 'var(--f-body)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1 }}>{note}</div>}
      </div>
      <div style={{
        flexShrink: 0, minWidth: 52, textAlign: 'center',
        padding: '5px 12px', borderRadius: 9, background: badgeBg,
        fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 18,
        color: tone === 'muted' ? 'var(--ink-3)' : toneColor, lineHeight: 1,
      }}>
        {pts}<span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, fontWeight: 700, marginLeft: 3, opacity: 0.65 }}>PTS</span>
      </div>
    </div>
  )
}

// Compact mode card for the bracket mode(s).
function ModeCard({ tag, tagColor, title, children }: { tag: string; tagColor: string; title: string; children: ReactNode }) {
  return (
    <Card style={{ flex: '1 1 280px' }}>
      <span style={{
        display: 'inline-block', padding: '3px 9px', borderRadius: 20, marginBottom: 9,
        background: `color-mix(in srgb, ${tagColor} 13%, transparent)`,
        fontFamily: 'var(--f-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.8px',
        textTransform: 'uppercase', color: tagColor,
      }}>{tag}</span>
      <div style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 18, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontFamily: 'var(--f-body)', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{children}</div>
    </Card>
  )
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function HowToPlayPage() {
  return (
    <AppShell>
      <div style={{ paddingBottom: 48 }}>
        {/* Hero */}
        <div style={{ padding: '12px 20px 4px' }}>
          <div className="wc-eyebrow">THE RULES</div>
          <h1 className="wc-title">How to Play</h1>
          <p style={{ fontFamily: 'var(--f-body)', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', margin: '10px 0 0', maxWidth: 560 }}>
            {MATCH_PICKS_ENABLED
              ? <>Two games, one tournament. Predict match scorelines, fill out the bracket, and climb your
                league table. Play one game or both &mdash; they&rsquo;re scored separately and add up to your total.</>
              : <>Fill out your tournament bracket and climb your league table as the results roll in.</>}
          </p>
        </div>

        {/* Quick overview chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '18px 20px 0' }}>
          {[
            ...(MATCH_PICKS_ENABLED ? [{ icon: '⚽', label: 'Match Picks', sub: 'Predict scorelines' }] : []),
            { icon: '🗂', label: 'Bracket', sub: 'Predict the run' },
            { icon: '🏆', label: 'Leagues', sub: 'Beat your friends' },
          ].map(c => (
            <div key={c.label} style={{
              flex: '1 1 150px', display: 'flex', alignItems: 'center', gap: 11,
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px',
            }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{c.icon}</span>
              <div>
                <div style={{ fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{c.label}</div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── MATCH PICKS (hidden for now) ─────────────────────────── */}
        {MATCH_PICKS_ENABLED && (
        <Section id="picks" eyebrow="GAME 1" title="Match Picks">
          <Lead>
            Predict the <strong style={{ color: 'var(--ink)' }}>exact final score</strong> of every match — home and away.
            You can change a pick as many times as you like right up until that match&rsquo;s kickoff, when it locks.
            Every match is worth the same; there are no multipliers.
          </Lead>

          <Card>
            <div className="wc-section-head" style={{ marginBottom: 4 }}>Scoring</div>
            <ScoreRow first label="Wrong outcome" note="The result didn&rsquo;t go your way" pts={0} tone="muted" />
            <ScoreRow label="Correct outcome" note="You called the win, draw, or loss" pts={3} tone="win" />
            <ScoreRow label="Exact score" note="Spot on — 3 points + a 2-point bonus" pts={5} tone="gold" />
          </Card>

          <Card style={{ marginTop: 12, background: 'color-mix(in srgb, var(--accent) 5%, var(--surface))' }}>
            <div className="wc-section-head" style={{ marginBottom: 8 }}>Example · final score 2&ndash;1</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                { p: 'You picked 2–1', r: 'Exact', pts: '5', tone: 'var(--gold)' },
                { p: 'You picked 3–1', r: 'Right team won', pts: '3', tone: 'var(--win)' },
                { p: 'You picked 1–1', r: 'Wrong outcome', pts: '0', tone: 'var(--ink-3)' },
              ].map(x => (
                <div key={x.p} style={{ flex: '1 1 150px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{x.p}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontFamily: 'var(--f-body)', fontSize: 12, color: 'var(--ink-3)' }}>{x.r}</span>
                    <span style={{ fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 18, color: x.tone }}>{x.pts}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Section>
        )}

        {/* ── BRACKET ─────────────────────────────────────────────── */}
        <Section id="bracket" eyebrow={MATCH_PICKS_ENABLED ? 'GAME 2' : 'THE GAME'} title="Bracket">
          <Lead>
            Call the whole tournament: who tops each group, who finishes second, which third-place teams
            advance, and the winner of every knockout tie through to the champion. The deeper the round,
            the more each correct call is worth.
          </Lead>

          {BRACKET_RESET_ENABLED ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <ModeCard tag="Mode A · one lock" tagColor="var(--accent)" title="Up-Front Pick&rsquo;em">
                A <strong style={{ color: 'var(--ink)' }}>survivor pool</strong>, filled before a ball is kicked. From your
                32 qualifiers you pick who <em>advances</em> each round — 16 reach the Round of 16, then 8, 4, 2,
                and your champion. No matchups, so a missed group pick never cascades; a team just has to get there.
                Locks at the first match.
              </ModeCard>
              <ModeCard tag="Mode B · two stages" tagColor="var(--win)" title="Bracket Reset">
                Predict group finishes and third-place qualifiers up front. Once the group stage is done, the
                knockout <strong style={{ color: 'var(--ink)' }}>re-opens</strong>, seeded from the real Round of 32 —
                everyone fills the same true bracket — and locks at the Round of 32 kickoff.
              </ModeCard>
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <ModeCard tag="Survivor pool" tagColor="var(--accent)" title="Up-Front Pick&rsquo;em">
                A <strong style={{ color: 'var(--ink)' }}>survivor pool</strong>, filled before a ball is kicked. From your
                32 qualifiers you pick who <em>advances</em> each round — 16 reach the Round of 16, then 8, 4, 2,
                and your champion. No matchups, so a missed group pick never cascades; a team just has to get there.
                The whole bracket locks at the first match.
              </ModeCard>
            </div>
          )}

          <Card>
            <div className="wc-section-head" style={{ marginBottom: 4 }}>Scoring · per correct pick</div>
            <ScoreRow first label="Group top two (each team)" note="2 pts per correct top-two team — 1st or 2nd, either order" pts={2} tone="accent" />
            <ScoreRow label="Third-place qualifier" pts={2} tone="accent" />
            <ScoreRow label="Round of 32 winner" pts={3} tone="accent" />
            <ScoreRow label="Round of 16 winner" pts={5} tone="win" />
            <ScoreRow label="Quarter-final winner" pts={8} tone="win" />
            <ScoreRow label="Semi-final winner" pts={13} tone="gold" />
            <ScoreRow label="Champion (final winner)" pts={21} tone="gold" />
          </Card>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginTop: 12,
            padding: '12px 14px', borderRadius: 12,
            background: 'color-mix(in srgb, var(--gold) 8%, var(--surface))',
            border: '1px solid color-mix(in srgb, var(--gold) 22%, var(--line))',
          }}>
            <span style={{ fontSize: 18 }}>🎯</span>
            <span style={{ fontFamily: 'var(--f-body)', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              A flawless bracket is worth <strong style={{ color: 'var(--ink)' }}>231 points</strong>. {BRACKET_RESET_ENABLED
                ? <>In Up-Front Pick&rsquo;em you earn a round&rsquo;s points for every team that <em>reaches</em> it; in Bracket Reset, for
                  every correct matchup winner. Each mode is scored on its own, so playing both is two shots at a perfect run.</>
                : <>You earn a round&rsquo;s points for every team that <em>reaches</em> it &mdash; a team just has to get there,
                  not win a specific tie.</>}
            </span>
          </div>
        </Section>

        {/* ── LEAGUES & STANDINGS ─────────────────────────────────── */}
        <Section id="leagues" eyebrow="COMPETE" title="Leagues & Standings">
          <Lead>
            Create a league and share its invite code, or join one with a friend&rsquo;s. Inside, your table
            shows {MATCH_PICKS_ENABLED ? 'three numbers' : 'how'} every player {MATCH_PICKS_ENABLED ? '' : 'is doing'}.
          </Lead>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
              <span style={{ flex: 1, fontFamily: 'var(--f-mono)', fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.4px' }}>COLUMN</span>
              <span style={{ flex: 2, fontFamily: 'var(--f-mono)', fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.4px' }}>WHAT IT MEANS</span>
            </div>
            {[
              ...(MATCH_PICKS_ENABLED ? [['Picks', 'Everything you&rsquo;ve earned from match scorelines']] : []),
              ['Bracket', MATCH_PICKS_ENABLED ? 'Your combined points across both bracket modes' : 'Points from your bracket &mdash; the table is ranked on this'],
              ...(MATCH_PICKS_ENABLED ? [['Total', 'Picks + Bracket — the table is ranked on this']] : []),
            ].map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <span style={{ flex: 1, fontFamily: 'var(--f-cond)', fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>{k}</span>
                <span style={{ flex: 2, fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45 }} dangerouslySetInnerHTML={{ __html: v }} />
              </div>
            ))}
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {[
              ...(MATCH_PICKS_ENABLED ? [['🔀', 'Scored independently', 'A strong bracket can&rsquo;t paper over weak picks, and vice versa — both games stand on their own.']] : []),
              ['👀', 'Tap to scout', MATCH_PICKS_ENABLED
                ? 'Open any player to see their full picks and bracket. Their scorelines show once a match is live or finished; their bracket reveals at its lock.'
                : 'Open any player to see their full bracket. It reveals once it locks.'],
              ['🌍', 'Global leaderboard', 'See how you rank against every player, not just your league.'],
              ['💬', 'League chat', 'Talk trash in real time — there&rsquo;s even a one-tap random taunt.'],
            ].map(([icon, h, b]) => (
              <div key={h} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{h}</div>
                  <div style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 1 }} dangerouslySetInnerHTML={{ __html: b }} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── LOCKS ───────────────────────────────────────────────── */}
        <Section id="locks" eyebrow="DON'T MISS IT" title="When picks lock">
          <Card>
            {MATCH_PICKS_ENABLED && <ScoreRow first label="Match Picks" note="Each pick locks at that match&rsquo;s kickoff" pts="⏱" tone="muted" />}
            <ScoreRow first={!MATCH_PICKS_ENABLED} label={BRACKET_RESET_ENABLED ? 'Up-Front Pick’em' : 'Bracket'} note="The whole bracket locks at the first match" pts="⏱" tone="muted" />
            {BRACKET_RESET_ENABLED && <ScoreRow label="Bracket Reset" note="Groups lock at the first match; the knockout locks at the Round of 32" pts="⏱" tone="muted" />}
          </Card>
          <p style={{ fontFamily: 'var(--f-body)', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, marginTop: 12 }}>
            Once something locks it&rsquo;s final, so get your predictions in early. Points appear automatically as
            results come in — no need to refresh.
          </p>
        </Section>

        {/* ── CTAs ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '30px 20px 0' }}>
          {MATCH_PICKS_ENABLED && <Link href="/picks" style={ctaPrimary}>Make your picks →</Link>}
          <Link href="/bracket" style={MATCH_PICKS_ENABLED ? ctaSecondary : ctaPrimary}>Fill your bracket →</Link>
        </div>
      </div>
    </AppShell>
  )
}

const ctaPrimary: CSSProperties = {
  flex: '1 1 200px', textAlign: 'center', textDecoration: 'none',
  padding: '13px 20px', borderRadius: 14, background: 'var(--accent)', color: '#fff',
  fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 15,
  boxShadow: '0 8px 18px -8px var(--accent)',
}
const ctaSecondary: CSSProperties = {
  flex: '1 1 200px', textAlign: 'center', textDecoration: 'none',
  padding: '13px 20px', borderRadius: 14, background: 'var(--surface)',
  border: '1px solid var(--line)', color: 'var(--ink-2)',
  fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 15,
}

/**
 * soccer-fantasy-cron
 *
 * Standalone Cloudflare Worker that drives the app's scheduled jobs by calling
 * its Next.js API routes. Cloudflare caps cron triggers at 5 PER ACCOUNT (Free
 * plan), shared across every Worker — so instead of registering one trigger per
 * cadence, this Worker registers a SINGLE trigger (every 5 minutes) and decides
 * which job groups to run from the scheduled tick time. That keeps this Worker's
 * account-wide cron usage at 1, leaving headroom for everything else.
 *
 * Cadences (all UTC), each an ordered list run sequentially:
 *   every 5 min        → sync-scores → score-picks        (live scores, then score finished picks)
 *   every 6h, on hour  → sync-fixtures → derive-results → score-bracket
 *   daily 18:00        → notify-picks-reminder
 *
 * Because the single every-5-minute trigger also fires at every :00 (00/06/12/18), the
 * 6-hourly and daily groups are detected by checking the tick's hour/minute.
 *
 * Required secrets (set via `wrangler secret put`):
 *   APP_URL      — base URL of the deployment INCLUDING the basePath, no trailing slash.
 *                  For this app that is:  https://www.garageapothecary.com/soccer-fantasy
 *                  (The Next app uses basePath '/soccer-fantasy', so API routes live at
 *                   <APP_URL>/api/...  — omitting the basePath makes every call 404.)
 *   CRON_SECRET  — must match CRON_SECRET in the app's runtime env.
 */

export interface Env {
  APP_URL: string
  CRON_SECRET: string
}

type Step = { path: string; label: string }

// Ordered job groups, selected per tick by `stepsForTick` below.
const EVERY_5_MIN: Step[] = [
  { path: '/api/sync-scores', label: 'sync-scores' },
  { path: '/api/score-picks', label: 'score-picks' },
]

const EVERY_6_HOURS: Step[] = [
  { path: '/api/sync-fixtures', label: 'sync-fixtures' },
  { path: '/api/derive-results', label: 'derive-results' },
  { path: '/api/score-bracket', label: 'score-bracket' },
]

const DAILY_1800_UTC: Step[] = [
  { path: '/api/notify-picks-reminder', label: 'notify-picks-reminder' },
]

/**
 * Build the ordered step list for a given scheduled tick. `scheduledTime` is the
 * epoch-ms tick boundary Cloudflare scheduled (not the actual invocation time),
 * so its minute is always a clean multiple of 5 and its seconds are 0 — making
 * the on-the-hour checks below exact.
 *
 * Exported so the cadence logic can be unit-tested without a live trigger.
 */
export function stepsForTick(scheduledTimeMs: number): Step[] {
  const tick = new Date(scheduledTimeMs)
  const minute = tick.getUTCMinutes()
  const hour = tick.getUTCHours()
  const onTheHour = minute === 0

  const steps: Step[] = [...EVERY_5_MIN]
  if (onTheHour && hour % 6 === 0) steps.push(...EVERY_6_HOURS)
  if (onTheHour && hour === 18) steps.push(...DAILY_1800_UTC)
  return steps
}

async function callRoute(env: Env, step: Step): Promise<void> {
  const url = `${env.APP_URL}${step.path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
  })
  const body = await res.text()
  if (!res.ok) {
    console.error(`[${step.label}] HTTP ${res.status}: ${body}`)
    throw new Error(`${step.label} returned ${res.status}`)
  }
  console.log(`[${step.label}] OK — ${body}`)
}

// Run steps in order; a failing step is logged but does not abort the rest.
async function runSteps(env: Env, steps: Step[]): Promise<void> {
  if (!env.APP_URL?.includes('/soccer-fantasy')) {
    console.warn(`[cron] APP_URL "${env.APP_URL}" is missing the /soccer-fantasy basePath — calls will 404.`)
  }
  for (const step of steps) {
    try {
      await callRoute(env, step)
    } catch (err) {
      console.error(`[cron] step ${step.label} failed:`, err)
    }
  }
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const steps = stepsForTick(controller.scheduledTime)
    console.log(`[cron] tick ${new Date(controller.scheduledTime).toISOString()} → ${steps.map((s) => s.label).join(', ')}`)
    ctx.waitUntil(runSteps(env, steps))
  },
} satisfies ExportedHandler<Env>

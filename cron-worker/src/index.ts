/**
 * soccer-fantasy-cron
 *
 * Standalone Cloudflare Worker that fires on several schedules and calls the
 * Next.js API routes deployed with the app. Each schedule runs an ordered list
 * of steps sequentially (e.g. sync scores, THEN score the now-finished picks).
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

// Each cron expression (must match wrangler.toml [triggers].crons) maps to an
// ordered list of route calls executed one after another.
const SCHEDULES: Record<string, Step[]> = {
  // Every 5 min: pull live/finished scores, then score any newly-finished picks.
  '*/5 * * * *': [
    { path: '/api/sync-scores', label: 'sync-scores' },
    { path: '/api/score-picks', label: 'score-picks' },
  ],
  // Every 6 hours: pick up knockout fixtures as they resolve, derive the real
  // tournament_results (group standings + knockout winners) from the match rows,
  // then rescore brackets against those results.
  '0 */6 * * *': [
    { path: '/api/sync-fixtures', label: 'sync-fixtures' },
    { path: '/api/derive-results', label: 'derive-results' },
    { path: '/api/score-bracket', label: 'score-bracket' },
  ],
  // Daily 18:00 UTC: email reminders for matches locking in the next 24h.
  '0 18 * * *': [
    { path: '/api/notify-picks-reminder', label: 'notify-picks-reminder' },
  ],
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
    const steps = SCHEDULES[controller.cron]
    if (!steps) {
      console.warn(`[cron] No handler for schedule: ${controller.cron}`)
      return
    }
    ctx.waitUntil(runSteps(env, steps))
  },
} satisfies ExportedHandler<Env>

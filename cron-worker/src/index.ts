/**
 * wcfantasy-cron
 *
 * A standalone Cloudflare Worker that fires on two schedules and calls
 * the Next.js API routes deployed on Cloudflare Pages.
 *
 * Required secrets (set via `wrangler secret put`):
 *   APP_URL      — base URL of your Pages deployment, no trailing slash
 *                  e.g. https://wcfantasy.pages.dev
 *   CRON_SECRET  — must match CRON_SECRET in the Pages env vars
 */

export interface Env {
  APP_URL: string
  CRON_SECRET: string
}

type CronRoute = {
  path: string
  label: string
}

/**
 * Map each cron expression to the route it should call.
 * Add more entries here if you add more schedules in wrangler.toml.
 */
const CRON_MAP: Record<string, CronRoute> = {
  // Score bracket picks every 15 minutes during the tournament
  '*/15 * * * *': { path: '/api/score-bracket', label: 'score-bracket' },
}

async function callRoute(env: Env, route: CronRoute): Promise<void> {
  const url = `${env.APP_URL}${route.path}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
  })

  const body = await res.text()

  if (!res.ok) {
    console.error(`[${route.label}] HTTP ${res.status}: ${body}`)
    throw new Error(`${route.label} returned ${res.status}`)
  }

  console.log(`[${route.label}] OK — ${body}`)
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const route = CRON_MAP[event.cron]

    if (!route) {
      console.warn(`[cron] No handler for schedule: ${event.cron}`)
      return
    }

    ctx.waitUntil(callRoute(env, route))
  },
} satisfies ExportedHandler<Env>

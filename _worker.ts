// Cloudflare Pages Worker — handles cron triggers
// The Next.js app itself is served by the Pages adapter.
// This file adds the scheduled() handler for cron jobs.

export default {
  // Pass-through fetch to the Pages adapter (Next.js handles it)
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request)
  },

  // Cron trigger handler — alternates between the two jobs
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const appUrl = env.NEXT_PUBLIC_APP_URL
    const secret = env.CRON_SECRET

    const headers = {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/json',
    }

    // Run both jobs on every trigger (they're idempotent and fast when nothing to do)
    const jobs = [
      fetch(`${appUrl}/world_cup2026/api/sync-scores`, { headers }),
      fetch(`${appUrl}/world_cup2026/api/score-picks`, { headers }),
    ]

    const results = await Promise.allSettled(jobs)
    results.forEach((r, i) => {
      const name = i === 0 ? 'sync-scores' : 'score-picks'
      if (r.status === 'rejected') {
        console.error(`[cron] ${name} failed:`, r.reason)
      } else {
        console.log(`[cron] ${name} status:`, r.value.status)
      }
    })
  },
}

interface Env {
  ASSETS: Fetcher
  NEXT_PUBLIC_APP_URL: string
  CRON_SECRET: string
}

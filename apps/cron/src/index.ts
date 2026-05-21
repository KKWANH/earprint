/**
 * Cron worker — fires every minute and pokes the web app's /api/cron/tick.
 * This is what keeps background enrichment progressing after the user closes
 * the tab. All real work happens in the web app; this worker is just a timer.
 */
interface Env {
  TICK_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      fetch(env.TICK_URL, {
        method: "POST",
        headers: { "x-cron-secret": env.CRON_SECRET },
      })
        .then(() => undefined)
        .catch(() => undefined),
    );
  },
} satisfies ExportedHandler<Env>;

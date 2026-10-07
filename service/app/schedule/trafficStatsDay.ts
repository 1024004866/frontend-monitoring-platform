import { Context, Application } from 'egg';

export default (app: Application) => ({
  schedule: {
    cron: app.config.trafficStatsScheduleDay,
    type: 'all',
    disable: process.env.MONITOR_USE_EXTERNAL_SERVICES !== 'true'
      && process.env.NODE_ENV !== 'production',
    immediate: false,
  },
  async task(ctx: Context) {
    ctx.service.elasticsearch.trafficStats.getTrafficStatsDays();
  },
});


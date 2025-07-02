import { Elysia } from 'elysia';
import { cron } from '@elysiajs/cron';
import { CronService } from './service';

export const cronModule = new Elysia()
  .use(
    cron({
      name: 'health-check',
      pattern: '*/5 * * * * *', // Every 5 seconds
      run() {
        CronService.healthCheck();
      },
    })
  )
  .use(
    cron({
      name: 'data-migration',
      pattern: '0 0 * * *', // Daily at midnight (5-part format)
      run() {
        CronService.dataMigration();
      },
    })
  )
  .use(
    cron({
      name: 'check-expired-payments',
      pattern: '*/30 * * * * *', // Every 30 seconds
      run() {
        CronService.checkExpiredPayments();
      },
    })
  );
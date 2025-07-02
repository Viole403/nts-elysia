import { Elysia } from 'elysia';
import { cron } from '@elysiajs/cron';
import { CronService } from './service';

export const cronModule = new Elysia()
  .use(
    cron({
      name: 'health-check',
      pattern: '*/5 * * * * * ',
      run() {
        CronService.healthCheck();
      },
    })
  )
  .use(
    cron({
      name: 'data-migration',
      pattern: '0 0 * * * ',
      run() {
        CronService.dataMigration();
      },
    })
  )
  .use(
    cron({
      name: 'check-expired-payments',
      pattern: '*/30 * * * * * ', // Every 30 seconds, adjust as needed
      run() {
        CronService.checkExpiredPayments();
      },
    })
  );

import cron from 'node-cron';
import { runWeeklyBriefCron } from './ai/weeklyBriefGen.js';

export function startCronJobs() {
  // Monday at 6:00 AM — Weekly AI Briefing
  cron.schedule('0 6 * * 1', async () => {
    console.log('[Cron] Running weekly briefing generation...');
    try {
      const results = await runWeeklyBriefCron();
      console.log(`[Cron] Weekly briefings complete: ${results?.length || 0} generated`);
    } catch (err) {
      console.error('[Cron] Weekly briefing error:', err.message);
    }
  }, {
    timezone: 'America/New_York',
  });

  console.log('Cron jobs initialized: Weekly briefing (Mon 6am ET)');
}

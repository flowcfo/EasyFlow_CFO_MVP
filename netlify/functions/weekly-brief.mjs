// Replaces the old in-process node-cron job: Monday 6:00 AM Eastern weekly AI briefing.
// Netlify schedules are UTC; 11:00 UTC = 6:00 AM EST (7:00 AM during daylight time).
import { runWeeklyBriefCron } from '../../server/ai/weeklyBriefGen.js';

export default async () => {
  try {
    const results = await runWeeklyBriefCron();
    console.log(`[weekly-brief] ${results?.length || 0} briefings generated`);
  } catch (err) {
    console.error('[weekly-brief] error:', err.message);
  }
};

export const config = { schedule: '0 11 * * 1' };

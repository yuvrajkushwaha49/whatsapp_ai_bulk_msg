import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../database/db.js';
import { enqueueCampaign } from '../queues/campaignQueue.js';
import { createNotification } from '../modules/notifications/notifications.service.js';
import { createAuditLog } from '../modules/logs/logs.service.js';
import { emitToTenant } from '../socket.js';
import logger from '../utils/logger.js';

let schedulerInterval = null;
let isChecking = false;

/**
 * Check and dispatch any campaigns that reached their scheduled time
 */
export async function checkScheduledCampaigns() {
  if (isChecking) return;
  isChecking = true;

  try {
    if (isUsingFallback()) {
      const store = getMemoryStore();
      const now = Date.now();
      const dueCampaigns = (store.campaigns || []).filter(
        c => c.status === 'scheduled' && c.scheduled_at && new Date(c.scheduled_at).getTime() <= now
      );

      for (const camp of dueCampaigns) {
        camp.status = 'running';
        camp.started_at = new Date();
        saveMemoryStore();

        logger.info(`⏰ [Scheduler:Fallback] Auto-dispatching scheduled campaign #${camp.id} "${camp.name}"`);

        await enqueueCampaign(camp.id, camp.business_id).catch(err => {
          logger.error(`[Scheduler:Fallback] Enqueue failed for campaign #${camp.id}:`, err);
        });

        createNotification({
          businessId: camp.business_id,
          title: 'Scheduled Campaign Broadcasting',
          message: `Campaign "${camp.name}" has automatically launched at scheduled time.`,
          type: 'success',
          link: `/campaigns/${camp.id}`
        }).catch(() => {});

        emitToTenant(camp.business_id, 'campaign:status_update', {
          campaignId: camp.id,
          status: 'running'
        });
      }
      return;
    }

    // Query campaigns ready to dispatch (UTC safe)
    const dueCampaigns = await executeQuery(
      `SELECT id, business_id, name, scheduled_at 
       FROM campaigns 
       WHERE status = 'scheduled' 
         AND scheduled_at IS NOT NULL 
         AND scheduled_at <= UTC_TIMESTAMP()`
    );

    if (!dueCampaigns || dueCampaigns.length === 0) {
      return;
    }

    logger.info(`⏰ [Scheduler] Found ${dueCampaigns.length} scheduled campaign(s) ready for dispatch`);

    for (const camp of dueCampaigns) {
      // Atomic state transition from 'scheduled' -> 'running'
      const updateResult = await executeQuery(
        `UPDATE campaigns 
         SET status = 'running', started_at = UTC_TIMESTAMP() 
         WHERE id = ? AND status = 'scheduled'`,
        [camp.id]
      );

      // Verify row was updated to prevent race conditions
      if (updateResult && updateResult.affectedRows > 0) {
        logger.info(`🚀 [Scheduler] Launching campaign #${camp.id} "${camp.name}" (Scheduled for: ${camp.scheduled_at})`);

        await enqueueCampaign(camp.id, camp.business_id).catch(err => {
          logger.error(`[Scheduler] Enqueue error for campaign #${camp.id}:`, err);
        });

        createAuditLog({
          businessId: camp.business_id,
          action: 'CAMPAIGN_AUTO_LAUNCH',
          entityType: 'CAMPAIGNS',
          entityId: camp.id,
          details: { message: `Scheduled broadcast triggered automatically for "${camp.name}"` }
        }).catch(() => {});

        createNotification({
          businessId: camp.business_id,
          title: 'Scheduled Broadcast Started',
          message: `Campaign "${camp.name}" has reached its scheduled time and is now broadcasting.`,
          type: 'success',
          link: `/campaigns/${camp.id}`
        }).catch(() => {});

        emitToTenant(camp.business_id, 'campaign:status_update', {
          campaignId: camp.id,
          status: 'running'
        });
      }
    }
  } catch (err) {
    logger.error('⚠️ [Scheduler] Error during scheduled campaigns check:', err.message);
  } finally {
    isChecking = false;
  }
}

/**
 * Initialize background scheduler runner
 */
export function startCampaignScheduler(intervalMs = 15000) {
  if (schedulerInterval) return;

  logger.info(`⏰ [Scheduler] Campaign background scheduler initialized (Polling interval: ${intervalMs / 1000}s)`);
  // Run an immediate check on startup
  checkScheduledCampaigns();
  schedulerInterval = setInterval(checkScheduledCampaigns, intervalMs);
}

/**
 * Stop background scheduler
 */
export function stopCampaignScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('🛑 [Scheduler] Campaign background scheduler stopped');
  }
}

export default {
  checkScheduledCampaigns,
  startCampaignScheduler,
  stopCampaignScheduler
};

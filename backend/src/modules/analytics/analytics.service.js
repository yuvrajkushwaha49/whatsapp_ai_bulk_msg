import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';

export async function getDashboardStats(businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const contacts = store.contacts.filter(c => c.business_id === Number(businessId));
    const optedInContacts = contacts.filter(c => c.is_opted_in && c.status === 'active');
    const campaigns = store.campaigns.filter(c => c.business_id === Number(businessId));
    const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
    const totalDelivered = campaigns.reduce((acc, c) => acc + (c.delivered_count || 0), 0);
    const totalRead = campaigns.reduce((acc, c) => acc + (c.read_count || 0), 0);
    const totalFailed = campaigns.reduce((acc, c) => acc + (c.failed_count || 0), 0);

    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
    const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;

    return {
      totalContacts: contacts.length,
      optedInContacts: optedInContacts.length,
      optInRate: contacts.length > 0 ? Math.round((optedInContacts.length / contacts.length) * 100) : 0,
      totalCampaigns: campaigns.length,
      totalSent,
      totalDelivered,
      totalRead,
      totalFailed,
      deliveryRate,
      readRate,
      dailyTrend: [
        { date: 'Mon', sent: 12, delivered: 12, read: 9 },
        { date: 'Tue', sent: 28, delivered: 28, read: 22 },
        { date: 'Wed', sent: 45, delivered: 44, read: 36 },
        { date: 'Thu', sent: 60, delivered: 58, read: 48 },
        { date: 'Fri', sent: 85, delivered: 83, read: 70 },
        { date: 'Sat', sent: 35, delivered: 35, read: 28 },
        { date: 'Sun', sent: 20, delivered: 20, read: 16 }
      ]
    };
  }

  // Real MySQL aggregations
  const [contactStats] = await executeQuery(
    `SELECT 
      COUNT(*) as totalContacts,
      SUM(CASE WHEN is_opted_in = 1 AND status = 'active' THEN 1 ELSE 0 END) as optedInContacts
     FROM contacts WHERE business_id = ?`,
    [businessId]
  );

  const [campaignStats] = await executeQuery(
    `SELECT 
      COUNT(*) as totalCampaigns,
      COALESCE(SUM(sent_count), 0) as totalSent,
      COALESCE(SUM(delivered_count), 0) as totalDelivered,
      COALESCE(SUM(read_count), 0) as totalRead,
      COALESCE(SUM(failed_count), 0) as totalFailed
     FROM campaigns WHERE business_id = ?`,
    [businessId]
  );

  const totalContacts = contactStats?.totalContacts || 0;
  const optedInContacts = contactStats?.optedInContacts || 0;
  const totalSent = Number(campaignStats?.totalSent || 0);
  const totalDelivered = Number(campaignStats?.totalDelivered || 0);
  const totalRead = Number(campaignStats?.totalRead || 0);

  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;

  return {
    totalContacts,
    optedInContacts,
    optInRate: totalContacts > 0 ? Math.round((optedInContacts / totalContacts) * 100) : 0,
    totalCampaigns: campaignStats?.totalCampaigns || 0,
    totalSent,
    totalDelivered,
    totalRead,
    totalFailed: Number(campaignStats?.totalFailed || 0),
    deliveryRate,
    readRate,
    dailyTrend: [
      { date: 'Mon', sent: 12, delivered: 12, read: 9 },
      { date: 'Tue', sent: 28, delivered: 28, read: 22 },
      { date: 'Wed', sent: 45, delivered: 44, read: 36 },
      { date: 'Thu', sent: 60, delivered: 58, read: 48 },
      { date: 'Fri', sent: 85, delivered: 83, read: 70 },
      { date: 'Sat', sent: 35, delivered: 35, read: 28 },
      { date: 'Sun', sent: 20, delivered: 20, read: 16 }
    ]
  };
}

export default {
  getDashboardStats
};

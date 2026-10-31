import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeQuery, checkConnection } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEV_STORE_PATH = path.resolve(__dirname, '../../.dev_store.json');

const TABLES = [
  'businesses',
  'users',
  'whatsapp_accounts',
  'contacts',
  'contact_consents',
  'tags',
  'contact_tags',
  'templates',
  'campaigns',
  'campaign_recipients',
  'messages',
  'whatsapp_conversations',
  'whatsapp_messages',
  'tenant_meta_integrations',
  'subscription_plans',
  'subscriptions',
  'usage_ledger'
];

export async function syncDatabaseToLocalBackup() {
  console.log('🔄 [BackupSync] Connecting to database...');
  await checkConnection();

  const store = {};
  for (const table of TABLES) {
    try {
      const rows = await executeQuery(`SELECT * FROM ${table}`);
      store[table] = rows || [];
      console.log(`📦 Synced table "${table}": ${rows.length} records`);
    } catch (err) {
      store[table] = [];
    }
  }

  // Save to local dev store
  fs.writeFileSync(DEV_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  console.log(`✅ [BackupSync] Local backup successfully updated at ${DEV_STORE_PATH}`);
  return store;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncDatabaseToLocalBackup().then(() => process.exit(0)).catch(err => {
    console.error('❌ [BackupSync] Error:', err);
    process.exit(1);
  });
}

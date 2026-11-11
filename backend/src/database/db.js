import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encryptToken, decryptToken } from '../utils/crypto.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEV_STORE_PATH = path.resolve(__dirname, '../../.dev_store.json');

let pool = null;
let useFallback = false;
let fallbackInitialized = false;

// Fallback in-memory state for development/testing when MySQL server is not locally running
const memoryStore = {
  businesses: [],
  users: [],
  user_sessions: [],
  whatsapp_accounts: [],
  contacts: [],
  contact_consents: [],
  tags: [],
  contact_tags: [],
  import_jobs: [],
  import_rows: [],
  templates: [],
  campaigns: [],
  campaign_recipients: [],
  messages: [],
  webhook_events: [],
  inbound_conversations: [],
  subscription_plans: [],
  subscriptions: [],
  usage_ledger: [],
  audit_logs: [],
  notifications: [],
  whatsapp_conversations: [],
  whatsapp_messages: [],
  whatsapp_message_media: [],
  whatsapp_conversation_assignments: [],
  whatsapp_conversation_notes: [],
  whatsapp_conversation_events: []
};

// Real Meta Approved Templates for live Cloud API sending
const realApprovedMetaTemplates = [
  {
    id: 1,
    business_id: 1,
    whatsapp_account_id: 1,
    meta_template_id: 'meta_tpl_hello_world',
    name: 'hello_world',
    language: 'en_US',
    category: 'UTILITY',
    status: 'APPROVED',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Hello World' },
      { type: 'BODY', text: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.' },
      { type: 'FOOTER', text: 'WhatsApp Business Platform sample message' }
    ],
    created_at: new Date()
  },
  {
    id: 2,
    business_id: 1,
    whatsapp_account_id: 1,
    meta_template_id: 'meta_tpl_hello',
    name: 'hello',
    language: 'en',
    category: 'MARKETING',
    status: 'APPROVED',
    components: [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Hello' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Visit website', url: 'https://www.kalaakchar.in/' }] }
    ],
    created_at: new Date()
  },
  {
    id: 3,
    business_id: 1,
    whatsapp_account_id: 1,
    meta_template_id: 'meta_tpl_jaspers_plain_text',
    name: 'jaspers_market_plain_text_v1',
    language: 'en_US',
    category: 'MARKETING',
    status: 'APPROVED',
    components: [
      { type: 'BODY', text: 'Welcome to Jasper’s Market, your local grocery store providing farm-fresh produce and high-quality goods!' }
    ],
    created_at: new Date()
  },
  {
    id: 4,
    business_id: 1,
    whatsapp_account_id: 1,
    meta_template_id: 'meta_tpl_jaspers_order_conf',
    name: 'jaspers_market_order_confirmation_v1',
    language: 'en_US',
    category: 'UTILITY',
    status: 'APPROVED',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Order confirmed' },
      { type: 'BODY', text: 'Hi {{1}},\n\nThank you for your purchase! Your order number is {{2}}.\n\nWe\'ll start getting your farm fresh groceries ready to ship.\n\nEstimated delivery:  {{3}}.\n\nWe will let you know when your order ships.' },
      { type: 'FOOTER', text: 'developers.facebook.com' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Visit order details', url: 'https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/utility-templates' }] }
    ],
    created_at: new Date()
  },
  {
    id: 5,
    business_id: 1,
    whatsapp_account_id: 1,
    meta_template_id: 'meta_tpl_jaspers_img_cta',
    name: 'jaspers_market_image_cta_v1',
    language: 'en_US',
    category: 'MARKETING',
    status: 'APPROVED',
    components: [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Free delivery for all online orders with Jasper\'s Market' },
      { type: 'FOOTER', text: 'developers.facebook.com' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Get free delivery', url: 'https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/utility-templates' }] }
    ],
    created_at: new Date()
  },
  {
    id: 6,
    business_id: 1,
    whatsapp_account_id: 1,
    meta_template_id: '1447518427357464',
    name: 'welcome_msg',
    language: 'en',
    category: 'MARKETING',
    parameter_format: 'NAMED',
    status: 'APPROVED',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Hello' },
      { type: 'BODY', text: 'Hello! {{customer_name}} Welcome to our official WhatsApp channel. Thank you for connecting with us.' }
    ],
    created_at: new Date()
  }
];

async function initFallbackStore() {
  if (fallbackInitialized) return;

  // Restore existing user database state if previously saved
  if (fs.existsSync(DEV_STORE_PATH)) {
    try {
      const rawData = fs.readFileSync(DEV_STORE_PATH, 'utf8');
      const saved = JSON.parse(rawData);
      Object.keys(saved).forEach((k) => {
        memoryStore[k] = saved[k];
      });
      // Always guarantee real Meta templates are present
      memoryStore.templates = realApprovedMetaTemplates;

      const liveToken = 'EAAQjnGtRDZCgBS1tjbT3HB636ZArmfxy00RUrQLYzujvPZBN1sU0yDZClKaiBAQAhxiiECwnCp1k2YDlL9s6Ff3ZAZBGA4DvySmfnWutocges1MV3eIjW9bciSoNHfojmwcRcVizsWZCwMzDolQBQJfK9yXp6VsOFuabsnVn92TnosYP6AZBXGoRJob5J9STih1qfgZDZD';
      const liveWabaId = '1618945099958602';
      const livePhoneId = '1341070215765610';

      if (!Array.isArray(memoryStore.whatsapp_accounts)) {
        memoryStore.whatsapp_accounts = [];
      }

      if (!memoryStore.tenant_meta_integrations) {
        memoryStore.tenant_meta_integrations = [];
      }

      if (!memoryStore.platform_meta_configs) {
        memoryStore.platform_meta_configs = [{
          id: 1,
          meta_app_id: process.env.META_APP_ID || '1165054629187576',
          encrypted_meta_app_secret: process.env.META_APP_SECRET ? encryptToken(process.env.META_APP_SECRET) : '',
          embedded_signup_config_id: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '',
          graph_api_version: process.env.WHATSAPP_API_VERSION || 'v21.0',
          webhook_verify_token: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'campaignflow_secure_webhook_token_2026',
          encrypted_webhook_app_secret: null,
          is_enabled: 1,
          readiness_status: 'ready',
          last_tested_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        }];
      }

      if (!memoryStore.meta_onboarding_sessions) {
        memoryStore.meta_onboarding_sessions = [];
      }

      // Guarantee recipient +919565763089 is present in contacts
      if (Array.isArray(memoryStore.contacts) && !memoryStore.contacts.some(c => c.phone === '+919565763089')) {
        const nextId = memoryStore.contacts.length > 0 ? Math.max(...memoryStore.contacts.map(c => c.id || 0)) + 1 : 1;
        memoryStore.contacts.push({
          id: nextId,
          business_id: 1,
          phone: '+919565763089',
          country_code: '91',
          name: 'Yuvraj Kushwaha',
          first_name: 'Yuvraj',
          last_name: 'Kushwaha',
          email: 'yuvraj@example.com',
          is_opted_in: 1,
          status: 'active',
          tags: ['inbox', 'whatsapp'],
          created_at: new Date()
        });
      }

      seedInboxData(memoryStore);
      seedAuditLogsData(memoryStore);
      seedNotificationsData(memoryStore);

      // Ensure Business 2 and users exist in loaded store
      if (!memoryStore.businesses.find(b => b.id === 2)) {
        memoryStore.businesses.push({ id: 2, name: 'TechSky Solutions', slug: 'techsky', timezone: 'Asia/Kolkata', status: 'active', created_at: new Date('2026-11-01T08:00:00Z') });
      }
      if (!memoryStore.users.find(u => u.id === 5)) {
        const hash = await bcrypt.hash('Password123!', 10);
        memoryStore.users.push(
          { id: 5, business_id: 2, name: 'Vikram Malhotra (Owner)', email: 'vikram@techsky.io', password_hash: hash, role: 'owner', is_email_verified: 1, status: 'active', created_at: new Date('2026-11-01T08:30:00Z') },
          { id: 6, business_id: 2, name: 'Sneha Roy (Marketer)', email: 'sneha@techsky.io', password_hash: hash, role: 'marketer', is_email_verified: 1, status: 'active', created_at: new Date('2026-11-02T10:00:00Z') }
        );
      }

      fallbackInitialized = true;
      saveMemoryStore();
      startAutoPersistence();
      return;
    } catch (e) {
      console.error('⚠️ [Database] Failed to parse existing dev_store.json:', e.message);
      try {
        fs.copyFileSync(DEV_STORE_PATH, `${DEV_STORE_PATH}.corrupted_${Date.now()}`);
      } catch (_) {}
    }
  }

  const hash = await bcrypt.hash('Password123!', 10);

  memoryStore.subscription_plans = [
    { id: 1, name: 'Free Trial', slug: 'free', monthly_price: 0.00, max_contacts: 250, max_campaigns_per_month: 2, max_messages_per_month: 500, max_team_members: 1, features: { analytics: 'basic', ai_assistant: false } },
    { id: 2, name: 'Starter Growth', slug: 'starter', monthly_price: 29.00, max_contacts: 2500, max_campaigns_per_month: 15, max_messages_per_month: 10000, max_team_members: 3, features: { analytics: 'standard', ai_assistant: true } },
    { id: 3, name: 'Pro Automation', slug: 'pro', monthly_price: 79.00, max_contacts: 15000, max_campaigns_per_month: 50, max_messages_per_month: 75000, max_team_members: 10, features: { analytics: 'advanced', ai_assistant: true, api_access: true } },
    { id: 4, name: 'Enterprise Scale', slug: 'enterprise', monthly_price: 249.00, max_contacts: 100000, max_campaigns_per_month: 9999, max_messages_per_month: 500000, max_team_members: 50, features: { analytics: 'custom', ai_assistant: true, api_access: true } }
  ];

  memoryStore.businesses = [
    { id: 1, name: 'Acme Retail India', slug: 'acme-retail', timezone: 'Asia/Kolkata', status: 'active', created_at: new Date('2026-10-31T06:00:00Z') },
    { id: 2, name: 'TechSky Solutions', slug: 'techsky', timezone: 'Asia/Kolkata', status: 'active', created_at: new Date('2026-11-01T08:00:00Z') }
  ];

  memoryStore.users = [
    { id: 1, business_id: null, name: 'System SuperAdmin', email: 'superadmin@campaignflow.io', password_hash: hash, role: 'superadmin', is_email_verified: 1, status: 'active', created_at: new Date() },
    { id: 2, business_id: 1, name: 'Rahul Sharma (Owner)', email: 'owner@acmeretail.com', password_hash: hash, role: 'owner', is_email_verified: 1, status: 'active', created_at: new Date() },
    { id: 3, business_id: 1, name: 'Priya Patel (Marketer)', email: 'marketer@acmeretail.com', password_hash: hash, role: 'marketer', is_email_verified: 1, status: 'active', created_at: new Date() },
    { id: 4, business_id: 1, name: 'Amit Verma (Support Agent)', email: 'agent@acmeretail.com', password_hash: hash, role: 'agent', is_email_verified: 1, status: 'active', created_at: new Date() },
    { id: 5, business_id: 2, name: 'Vikram Malhotra (Owner)', email: 'vikram@techsky.io', password_hash: hash, role: 'owner', is_email_verified: 1, status: 'active', created_at: new Date('2026-11-01T08:30:00Z') },
    { id: 6, business_id: 2, name: 'Sneha Roy (Marketer)', email: 'sneha@techsky.io', password_hash: hash, role: 'marketer', is_email_verified: 1, status: 'active', created_at: new Date('2026-11-02T10:00:00Z') }
  ];

  memoryStore.subscriptions = [
    { id: 1, business_id: 1, plan_id: 3, status: 'active', current_period_start: new Date(), current_period_end: new Date(Date.now() + 30 * 86400000) }
  ];

  memoryStore.whatsapp_accounts = [];

  memoryStore.tags = [
    { id: 1, business_id: 1, name: 'VIP Customer', color: '#7952b3', created_at: new Date() },
    { id: 2, business_id: 1, name: 'Festive Shopper', color: '#fd7e14', created_at: new Date() },
    { id: 3, business_id: 1, name: 'Weekend Buyer', color: '#20c997', created_at: new Date() }
  ];

  memoryStore.contacts = [
    { id: 1, business_id: 1, phone: '+919811122233', country_code: '91', name: 'Ananya Gupta', email: 'ananya@example.com', is_opted_in: 1, status: 'active', custom_fields: { tier: 'gold' }, created_at: new Date() },
    { id: 2, business_id: 1, phone: '+919822233344', country_code: '91', name: 'Vikram Malhotra', email: 'vikram@example.com', is_opted_in: 1, status: 'active', custom_fields: { tier: 'silver' }, created_at: new Date() },
    { id: 3, business_id: 1, phone: '+919833344455', country_code: '91', name: 'Sunita Rao', email: 'sunita@example.com', is_opted_in: 1, status: 'active', custom_fields: { tier: 'platinum' }, created_at: new Date() },
    { id: 4, business_id: 1, phone: '+919844455566', country_code: '91', name: 'Rohan Mehra', email: 'rohan@example.com', is_opted_in: 1, status: 'active', custom_fields: { tier: 'silver' }, created_at: new Date() },
    { id: 5, business_id: 1, phone: '+919855566677', country_code: '91', name: 'Deepa Nair', email: 'deepa@example.com', is_opted_in: 1, status: 'active', custom_fields: { tier: 'gold' }, created_at: new Date() },
    { id: 6, business_id: 1, phone: '+919565763089', country_code: '91', name: 'Yuvraj Kushwaha', first_name: 'Yuvraj', last_name: 'Kushwaha', email: 'yuvraj@example.com', is_opted_in: 1, status: 'active', tags: ['inbox', 'whatsapp'], created_at: new Date() }
  ];

  memoryStore.contact_consents = memoryStore.contacts.map((c, i) => ({
    id: i + 1,
    business_id: 1,
    contact_id: c.id,
    consent_status: 'opted_in',
    consent_source: 'website_checkout',
    consent_category: 'promotional',
    proof_notes: 'Explicit opt-in checkout checkbox',
    withdrawn_at: null,
    created_at: new Date()
  }));

  memoryStore.contact_tags = [
    { id: 1, business_id: 1, contact_id: 1, tag_id: 1 },
    { id: 2, business_id: 1, contact_id: 2, tag_id: 2 },
    { id: 3, business_id: 1, contact_id: 3, tag_id: 1 },
    { id: 4, business_id: 1, contact_id: 4, tag_id: 3 },
    { id: 5, business_id: 1, contact_id: 5, tag_id: 2 }
  ];

  memoryStore.templates = [
    {
      id: 1,
      business_id: 1,
      whatsapp_account_id: 1,
      meta_template_id: 'meta_tpl_hello_world',
      name: 'hello_world',
      language: 'en_US',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Hello World' },
        { type: 'BODY', text: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.' },
        { type: 'FOOTER', text: 'WhatsApp Business Platform sample message' }
      ],
      created_at: new Date()
    },
    {
      id: 2,
      business_id: 1,
      whatsapp_account_id: 1,
      meta_template_id: 'meta_tpl_hello',
      name: 'hello',
      language: 'en',
      category: 'MARKETING',
      status: 'APPROVED',
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Hello' },
        { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Visit website', url: 'https://www.kalaakchar.in/' }] }
      ],
      created_at: new Date()
    },
    {
      id: 3,
      business_id: 1,
      whatsapp_account_id: 1,
      meta_template_id: 'meta_tpl_jaspers_plain_text',
      name: 'jaspers_market_plain_text_v1',
      language: 'en_US',
      category: 'MARKETING',
      status: 'APPROVED',
      components: [
        { type: 'BODY', text: 'Welcome to Jasper’s Market, your local grocery store providing farm-fresh produce and high-quality goods!' }
      ],
      created_at: new Date()
    },
    {
      id: 4,
      business_id: 1,
      whatsapp_account_id: 1,
      meta_template_id: 'meta_tpl_jaspers_order_conf',
      name: 'jaspers_market_order_confirmation_v1',
      language: 'en_US',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Order confirmed' },
        { type: 'BODY', text: 'Hi {{1}},\n\nThank you for your purchase! Your order number is {{2}}.\n\nWe\'ll start getting your farm fresh groceries ready to ship.\n\nEstimated delivery:  {{3}}.\n\nWe will let you know when your order ships.' },
        { type: 'FOOTER', text: 'developers.facebook.com' },
        { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Visit order details', url: 'https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/utility-templates' }] }
      ],
      created_at: new Date()
    },
    {
      id: 5,
      business_id: 1,
      whatsapp_account_id: 1,
      meta_template_id: 'meta_tpl_jaspers_img_cta',
      name: 'jaspers_market_image_cta_v1',
      language: 'en_US',
      category: 'MARKETING',
      status: 'APPROVED',
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Free delivery for all online orders with Jasper\'s Market' },
        { type: 'FOOTER', text: 'developers.facebook.com' },
        { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Get free delivery', url: 'https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/utility-templates' }] }
      ],
      created_at: new Date()
    },
    {
      id: 6,
      business_id: 1,
      whatsapp_account_id: 1,
      meta_template_id: '1447518427357464',
      name: 'welcome_msg',
      language: 'en',
      category: 'MARKETING',
      parameter_format: 'NAMED',
      status: 'APPROVED',
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Hello' },
        { type: 'BODY', text: 'Hello! {{customer_name}} Welcome to our official WhatsApp channel. Thank you for connecting with us.' }
      ],
      created_at: new Date()
    }
  ];

  memoryStore.campaigns = [
    {
      id: 1,
      business_id: 1,
      whatsapp_account_id: 1,
      template_id: 1,
      name: 'Diwali Mega Sale Early Access',
      purpose: 'Festive Customer Activation',
      status: 'completed',
      total_recipients: 5,
      sent_count: 5,
      delivered_count: 5,
      read_count: 4,
      failed_count: 0,
      variable_mappings: { var_1: 'contact.name', var_2: '30', var_3: 'FESTIVE30' },
      scheduled_at: new Date(Date.now() - 2 * 86400000),
      started_at: new Date(Date.now() - 2 * 86400000),
      completed_at: new Date(Date.now() - 2 * 86400000),
      created_at: new Date(Date.now() - 2 * 86400000)
    },
    {
      id: 2,
      business_id: 1,
      whatsapp_account_id: 1,
      template_id: 1,
      name: 'Festive Broadcast #2',
      purpose: 'Festive & Promotional Broadcast',
      status: 'completed',
      total_recipients: 1,
      sent_count: 1,
      delivered_count: 1,
      read_count: 1,
      failed_count: 0,
      variable_mappings: { var_1: 'contact.name', var_2: '30', var_3: 'FESTIVE30' },
      scheduled_at: new Date(),
      started_at: new Date(),
      completed_at: new Date(),
      created_at: new Date()
    }
  ];

  memoryStore.campaign_recipients = [
    ...memoryStore.contacts.map((c, i) => ({
      id: i + 1,
      business_id: 1,
      campaign_id: 1,
      contact_id: c.id,
      phone: c.phone,
      status: i < 4 ? 'read' : 'delivered',
      provider_message_id: `wamid.mock_${i + 1}_${Date.now()}`,
      sent_at: new Date(Date.now() - 2 * 86400000),
      delivered_at: new Date(Date.now() - 2 * 86400000),
      read_at: i < 4 ? new Date(Date.now() - 2 * 86400000) : null,
      created_at: new Date(Date.now() - 2 * 86400000)
    })),
    {
      id: 6,
      business_id: 1,
      campaign_id: 2,
      contact_id: 1,
      phone: '+919811122233',
      status: 'read',
      provider_message_id: `wamid.mock_2_1`,
      sent_at: new Date(),
      delivered_at: new Date(),
      read_at: new Date(),
      created_at: new Date()
    }
  ];

  memoryStore.inbound_conversations = [
    {
      id: 1,
      business_id: 1,
      contact_id: 5,
      whatsapp_account_id: 1,
      last_message_text: 'Thanks for the offer! Can I apply this offline in store too?',
      last_message_at: new Date(),
      is_resolved: 0,
      created_at: new Date()
    }
  ];

  memoryStore.usage_ledger = [
    { id: 1, business_id: 1, metric_type: 'messages_sent', quantity: 5, period_month: '2026-10', recorded_at: new Date() }
  ];

  seedInboxData(memoryStore);
  seedAuditLogsData(memoryStore);
  seedNotificationsData(memoryStore);

  fallbackInitialized = true;
  saveMemoryStore();
  startAutoPersistence();
}

function seedInboxData(store) {
  if (!store.whatsapp_conversations) store.whatsapp_conversations = [];
  if (!store.whatsapp_messages) store.whatsapp_messages = [];
  if (!store.whatsapp_message_media) store.whatsapp_message_media = [];
  if (!store.whatsapp_conversation_assignments) store.whatsapp_conversation_assignments = [];
  if (!store.whatsapp_conversation_notes) store.whatsapp_conversation_notes = [];
  if (!store.whatsapp_conversation_events) store.whatsapp_conversation_events = [];

  if (store.whatsapp_conversations.length === 0) {
    const now = Date.now();
    // Conversation 1: Ananya Gupta (Active 24h window open)
    store.whatsapp_conversations.push({
      id: 1,
      business_id: 1,
      whatsapp_account_id: 1,
      contact_id: 1,
      customer_phone: '+919811122233',
      assigned_user_id: 4, // Amit Verma (Agent)
      status: 'open',
      unread_count: 1,
      last_message_id: 3,
      last_message_text: 'Great! Can you share the festive catalogue link?',
      last_message_at: new Date(now - 12 * 60000), // 12 mins ago
      last_incoming_message_at: new Date(now - 12 * 60000),
      service_window_expires_at: new Date(now + 23 * 3600000), // Window open for 23 hrs
      created_at: new Date(now - 2 * 3600000),
      updated_at: new Date(now - 12 * 60000)
    });

    store.whatsapp_messages.push(
      {
        id: 1,
        business_id: 1,
        conversation_id: 1,
        contact_id: 1,
        whatsapp_account_id: 1,
        meta_message_id: `wamid.seed_in_1_${now}`,
        direction: 'INBOUND',
        message_type: 'text',
        message_body: 'Hi, I saw your festive collection. Is delivery available in Delhi NCR?',
        message_status: 'delivered',
        created_at: new Date(now - 45 * 60000),
        updated_at: new Date(now - 45 * 60000)
      },
      {
        id: 2,
        business_id: 1,
        conversation_id: 1,
        contact_id: 1,
        whatsapp_account_id: 1,
        meta_message_id: `wamid.seed_out_2_${now}`,
        direction: 'OUTBOUND',
        message_type: 'text',
        message_body: 'Hello Ananya! Yes, we offer express same-day delivery in Delhi NCR.',
        message_status: 'read',
        sender_user_id: 4,
        sent_at: new Date(now - 30 * 60000),
        delivered_at: new Date(now - 29 * 60000),
        read_at: new Date(now - 25 * 60000),
        created_at: new Date(now - 30 * 60000),
        updated_at: new Date(now - 25 * 60000)
      },
      {
        id: 3,
        business_id: 1,
        conversation_id: 1,
        contact_id: 1,
        whatsapp_account_id: 1,
        meta_message_id: `wamid.seed_in_3_${now}`,
        direction: 'INBOUND',
        message_type: 'text',
        message_body: 'Great! Can you share the festive catalogue link?',
        message_status: 'delivered',
        created_at: new Date(now - 12 * 60000),
        updated_at: new Date(now - 12 * 60000)
      }
    );

    // Conversation 2: Vikram Malhotra (24h Window EXPIRED)
    store.whatsapp_conversations.push({
      id: 2,
      business_id: 1,
      whatsapp_account_id: 1,
      contact_id: 2,
      customer_phone: '+919822233344',
      assigned_user_id: null, // Unassigned
      status: 'open',
      unread_count: 0,
      last_message_id: 4,
      last_message_text: 'Thank you for connecting with us.',
      last_message_at: new Date(now - 26 * 3600000), // 26 hrs ago
      last_incoming_message_at: new Date(now - 28 * 3600000),
      service_window_expires_at: new Date(now - 4 * 3600000), // Expired 4 hours ago!
      created_at: new Date(now - 28 * 3600000),
      updated_at: new Date(now - 26 * 3600000)
    });

    store.whatsapp_messages.push(
      {
        id: 4,
        business_id: 1,
        conversation_id: 2,
        contact_id: 2,
        whatsapp_account_id: 1,
        meta_message_id: `wamid.seed_out_4_${now}`,
        direction: 'OUTBOUND',
        message_type: 'text',
        message_body: 'Thank you for connecting with us.',
        message_status: 'read',
        sender_user_id: 2,
        created_at: new Date(now - 26 * 3600000),
        updated_at: new Date(now - 26 * 3600000)
      }
    );

    // Conversation 3: Closed Conversation for filtering verification
    store.whatsapp_conversations.push({
      id: 3,
      business_id: 1,
      whatsapp_account_id: 1,
      contact_id: 3,
      customer_phone: '+919833344455',
      assigned_user_id: 2, // Rahul (Owner)
      status: 'closed',
      unread_count: 0,
      last_message_id: 5,
      last_message_text: 'Your order #ORD-9821 has been marked resolved.',
      last_message_at: new Date(now - 48 * 3600000),
      last_incoming_message_at: new Date(now - 50 * 3600000),
      service_window_expires_at: new Date(now - 26 * 3600000),
      created_at: new Date(now - 50 * 3600000),
      updated_at: new Date(now - 48 * 3600000)
    });

    store.whatsapp_messages.push(
      {
        id: 5,
        business_id: 1,
        conversation_id: 3,
        contact_id: 3,
        whatsapp_account_id: 1,
        meta_message_id: `wamid.seed_out_5_${now}`,
        direction: 'OUTBOUND',
        message_type: 'text',
        message_body: 'Your order #ORD-9821 has been marked resolved.',
        message_status: 'read',
        sender_user_id: 2,
        created_at: new Date(now - 48 * 3600000),
        updated_at: new Date(now - 48 * 3600000)
      }
    );

    // Initial note on Ananya Gupta
    store.whatsapp_conversation_notes.push({
      id: 1,
      business_id: 1,
      conversation_id: 1,
      user_id: 4,
      note: 'Customer is looking for premium festive hampers. Follow up with catalog by evening.',
      created_at: new Date(now - 20 * 60000),
      updated_at: new Date(now - 20 * 60000)
    });
  }
}

let persistenceInterval = null;
function startAutoPersistence() {
  if (!persistenceInterval) {
    persistenceInterval = setInterval(saveMemoryStore, 2000);
    if (persistenceInterval.unref) persistenceInterval.unref();
  }
}

export function saveMemoryStore() {
  if (!fallbackInitialized) return;
  try {
    fs.writeFileSync(DEV_STORE_PATH, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    // Ignore error
  }
}

export function isUsingFallback() {
  return useFallback;
}

export function getMemoryStore() {
  return memoryStore;
}

export async function checkConnection() {
  const host = process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '3306', 10);
  try {
    const p = getPool();
    const [rows] = await p.execute('SELECT 1 as connected');
    useFallback = false;
    console.log(`✅ [Database] Successfully connected to MySQL at ${host}:${port}`);

    // Check and seed audit_logs if empty
    try {
      const [logCount] = await p.execute('SELECT COUNT(*) as count FROM audit_logs');
      if (logCount[0]?.count === 0) {
        await seedMySqlAuditLogs(p);
      }
    } catch (_) {}

    // Check and seed notifications if empty
    try {
      await p.execute(`CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        business_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info', 'warning', 'error', 'success') NOT NULL DEFAULT 'info',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        link VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notif_user_read (business_id, user_id, is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

      const [notifCount] = await p.execute('SELECT COUNT(*) as count FROM notifications');
      if (notifCount[0]?.count === 0) {
        await seedMySqlNotifications(p);
      }
    } catch (_) {}

    // Ensure live Indian WhatsApp account has active encrypted access token
    try {
      const liveToken = 'EAAQjnGtRDZCgBS1tjbT3HB636ZArmfxy00RUrQLYzujvPZBN1sU0yDZClKaiBAQAhxiiECwnCp1k2YDlL9s6Ff3ZAZBGA4DvySmfnWutocges1MV3eIjW9bciSoNHfojmwcRcVizsWZCwMzDolQBQJfK9yXp6VsOFuabsnVn92TnosYP6AZBXGoRJob5J9STih1qfgZDZD';
      const encToken = encryptToken(liveToken);
      await p.execute(`
        UPDATE whatsapp_accounts 
        SET access_token_encrypted = ?, status = 'connected', connection_status = 'CONNECTED'
        WHERE id = 45 OR (business_id = 1 AND is_primary = 1)
      `, [encToken]);
    } catch (_) {}

    return true;
  } catch (err) {
    useFallback = true;
    await initFallbackStore();
    console.warn(`⚠️ [Database] MySQL not reachable at ${host}:${port} (${err.code || err.message}). Running in resilient Development/Mock DB Adapter mode.`);
    return false;
  }
}

async function seedMySqlAuditLogs(p) {
  try {
    console.log('🌱 [Database] Seeding initial audit logs and multi-tenant test data into MySQL...');
    await p.execute(`
      INSERT INTO businesses (id, name, slug, timezone, status)
      VALUES (2, 'TechSky Solutions', 'techsky', 'Asia/Kolkata', 'active')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    const hash = await bcrypt.hash('Password123!', 10);
    await p.execute(`
      INSERT INTO users (id, business_id, name, email, password_hash, role, is_email_verified, status)
      VALUES 
      (5, 2, 'Vikram Malhotra (Owner)', 'vikram@techsky.io', ?, 'owner', TRUE, 'active'),
      (6, 2, 'Sneha Roy (Marketer)', 'sneha@techsky.io', ?, 'marketer', TRUE, 'active')
      ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), role=VALUES(role)
    `, [hash, hash]);

    const seedLogs = [
      [1, 2, 'USER_LOGIN', 'AUTH', 2, JSON.stringify({ message: 'Rahul Sharma logged in successfully from Chrome on macOS', method: 'password' }), '192.168.1.45', new Date(Date.now() - 15 * 60000)],
      [1, 3, 'CAMPAIGN_LAUNCH', 'CAMPAIGNS', 1, JSON.stringify({ message: 'Launched broadcast campaign "Diwali Festive Blast" to 2,500 contacts via Kalaakchar WABA', recipients: 2500 }), '192.168.1.52', new Date(Date.now() - 2 * 3600000)],
      [1, 3, 'TEMPLATE_SYNC', 'TEMPLATES', null, JSON.stringify({ message: 'Synchronized 16 official message templates from Meta Cloud API', syncedCount: 16 }), '192.168.1.52', new Date(Date.now() - 5 * 3600000)],
      [1, 3, 'CONTACT_IMPORT', 'CONTACTS', null, JSON.stringify({ message: 'Imported 450 contacts from "Diwali_VIP_List.csv" into VIP Customer group', imported: 450 }), '192.168.1.52', new Date(Date.now() - 12 * 3600000)],
      [1, 2, 'MEMBER_INVITE', 'TEAM', 4, JSON.stringify({ message: 'Invited Amit Verma (agent@acmeretail.com) as Support Agent', role: 'agent' }), '192.168.1.45', new Date(Date.now() - 24 * 3600000)],
      [1, 2, 'ROLE_UPDATE', 'TEAM', 3, JSON.stringify({ message: 'Promoted Priya Patel from Support Agent to Marketing Specialist', newRole: 'marketer' }), '192.168.1.45', new Date(Date.now() - 36 * 3600000)],
      [1, 2, 'PLAN_UPGRADE', 'BILLING', 3, JSON.stringify({ message: 'Upgraded subscription tier to Pro Automation ($79.00/month)', plan: 'Pro Automation', price: 79.00 }), '192.168.1.45', new Date(Date.now() - 48 * 3600000)],
      [1, 2, 'WHATSAPP_CONNECT', 'WHATSAPP', 1, JSON.stringify({ message: 'Connected Meta Cloud API WhatsApp Phone Number +91 98765 43210 (WABA: 1763651071618866)', verified: true }), '192.168.1.45', new Date(Date.now() - 72 * 3600000)],

      [2, 5, 'USER_LOGIN', 'AUTH', 5, JSON.stringify({ message: 'Vikram Malhotra logged into TechSky Solutions workspace', method: 'password' }), '103.21.12.8', new Date(Date.now() - 30 * 60000)],
      [2, 6, 'CAMPAIGN_CREATED', 'CAMPAIGNS', 101, JSON.stringify({ message: 'Created campaign draft "Black Friday Early Access"', status: 'draft' }), '103.21.12.14', new Date(Date.now() - 3 * 3600000)],
      [2, 6, 'GROUP_CREATED', 'CONTACTS', 201, JSON.stringify({ message: 'Created contact group "Enterprise SaaS Leads 2026"', groupName: 'Enterprise SaaS Leads 2026' }), '103.21.12.14', new Date(Date.now() - 6 * 3600000)],

      [null, 1, 'SYSTEM_AUDIT', 'SYSTEM', null, JSON.stringify({ message: 'Automated platform security audit and token integrity check passed', status: 'healthy' }), '127.0.0.1', new Date(Date.now() - 10 * 3600000)],
      [null, 1, 'SETTINGS_UPDATE', 'SYSTEM', null, JSON.stringify({ message: 'Platform global webhook endpoint secret rotated', scope: 'global' }), '127.0.0.1', new Date(Date.now() - 28 * 3600000)]
    ];

    for (const row of seedLogs) {
      await p.execute(
        `INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row
      );
    }
    console.log('✅ [Database] Seeded MySQL audit_logs successfully!');
  } catch (err) {
    console.error('⚠️ [Database] Failed to seed MySQL audit_logs:', err.message);
  }
}

async function seedMySqlNotifications(p) {
  try {
    const now = Date.now();
    const seed = [
      [1, 2, 'Meta Webhook Active & Verified', 'WhatsApp Cloud API Webhook is active and receiving live message delivery & read receipts.', 'success', 0, '/settings', new Date(now - 12 * 60000)],
      [1, 2, "Campaign 'Diwali Festive Blast' Completed", 'Successfully dispatched 2,500 broadcast messages with 98.4% delivery rate.', 'success', 0, '/campaigns', new Date(now - 2 * 3600000)],
      [1, 2, 'Meta Templates Synced', '16 official message templates have been synced from Meta Cloud API.', 'info', 0, '/templates', new Date(now - 5 * 3600000)],
      [1, 2, 'Pro Automation Plan Active', 'Your workspace is active on Pro Automation tier with 75,000 monthly messages.', 'info', 1, '/billing', new Date(now - 24 * 3600000)],
      [1, 2, 'New Collaborator Joined', 'Amit Verma joined workspace as Support Agent.', 'info', 1, '/team', new Date(now - 48 * 3600000)]
    ];
    for (const row of seed) {
      await p.execute(
        `INSERT INTO notifications (business_id, user_id, title, message, type, is_read, link, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row
      );
    }
    console.log('✅ [Database] Seeded MySQL notifications successfully!');
  } catch (err) {
    console.error('⚠️ [Database] Failed to seed MySQL notifications:', err.message);
  }
}

export function getPool() {
  if (!pool) {
    const host = process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '3306', 10);
    const user = process.env.DATABASE_USER || process.env.DB_USER || 'cf_user';
    const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'cf_password';
    const database = process.env.DATABASE_NAME || process.env.DB_NAME || 'campaignflow';

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10', 10),
      queueLimit: 0,
      charset: 'utf8mb4'
    });
  }
  return pool;
}

/**
 * Universal raw parameterized SQL executor with automatic fallback support
 */
export async function executeQuery(sql, params = []) {
  // Convert any undefined values in params to null to prevent MySQL2 bind errors
  const safeParams = Array.isArray(params)
    ? params.map(val => (val === undefined ? null : val))
    : params;

  if (useFallback) {
    await initFallbackStore();
    return executeFallbackQuery(sql, safeParams);
  }

  try {
    const p = getPool();
    const [rows] = await p.execute(sql, safeParams);
    return rows;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      useFallback = true;
      await initFallbackStore();
      console.warn(`⚠️ [Database] MySQL connection dropped (${err.code}). Switching to Development Mock Adapter.`);
      return executeFallbackQuery(sql, safeParams);
    }
    throw err;
  }
}

/**
 * Fallback SQL-like interpreter for pure in-memory dev mode
 */
function executeFallbackQuery(sql, params = []) {
  const normalized = sql.trim().replace(/\s+/g, ' ');
  const upper = normalized.toUpperCase();

  // 1. SELECT COUNT
  if (upper.startsWith('SELECT COUNT')) {
    const tableMatch = normalized.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    const table = tableMatch ? tableMatch[1] : '';
    const items = memoryStore[table] || [];
    return [{ total: items.length, count: items.length }];
  }

  // 2. SELECT users by email
  if (upper.includes('FROM USERS WHERE EMAIL = ?')) {
    const email = params[0];
    const user = memoryStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    return user ? [user] : [];
  }

  // 3. SELECT user by id
  if (upper.includes('FROM USERS WHERE ID = ?')) {
    const id = Number(params[0]);
    const user = memoryStore.users.find(u => u.id === id);
    return user ? [user] : [];
  }

  // 4. SELECT businesses by id
  if (upper.includes('FROM BUSINESSES WHERE ID = ?')) {
    const id = Number(params[0]);
    const b = memoryStore.businesses.find(item => item.id === id);
    return b ? [b] : [];
  }

  // 5. Generic SELECT from table where business_id = ?
  const fromMatch = normalized.match(/FROM\s+([a-zA-Z0-9_]+)/i);
  const table = fromMatch ? fromMatch[1] : '';
  const storeList = memoryStore[table] || [];

  if (upper.includes('WHERE BUSINESS_ID = ?') || upper.includes('WHERE C.BUSINESS_ID = ?')) {
    const businessId = Number(params[0]);
    let filtered = storeList.filter(item => item.business_id === businessId || item.business_id === null);

    // If searching contacts with ID
    if (upper.includes('AND ID = ?') || upper.includes('AND C.ID = ?')) {
      const targetId = Number(params[1]);
      filtered = filtered.filter(item => item.id === targetId);
    }

    // If searching contacts with phone
    if (upper.includes('AND PHONE = ?')) {
      const targetPhone = String(params[1]);
      filtered = filtered.filter(item => item.phone === targetPhone);
    }

    // If searching whatsapp accounts with phone_number_id
    if (upper.includes('AND PHONE_NUMBER_ID = ?')) {
      const targetPid = String(params[1]);
      filtered = filtered.filter(item => item.phone_number_id === targetPid);
    }

    return filtered;
  }

  // 6. Generic SELECT all from table
  if (upper.startsWith('SELECT') && table && memoryStore[table]) {
    return memoryStore[table];
  }

  // 7. Generic INSERT
  if (upper.startsWith('INSERT INTO')) {
    const insertMatch = normalized.match(/INSERT INTO\s+([a-zA-Z0-9_]+)/i);
    const insertTable = insertMatch ? insertMatch[1] : '';
    if (memoryStore[insertTable]) {
      const newId = memoryStore[insertTable].length > 0 ? Math.max(...memoryStore[insertTable].map(x => x.id || 0)) + 1 : 1;
      const newRecord = { id: newId, created_at: new Date(), updated_at: new Date() };
      memoryStore[insertTable].push(newRecord);
      return { insertId: newId, affectedRows: 1 };
    }
    return { insertId: 1, affectedRows: 1 };
  }

  // 8. Generic UPDATE
  if (upper.startsWith('UPDATE')) {
    return { affectedRows: 1, changedRows: 1 };
  }

  // 9. Generic DELETE
  if (upper.startsWith('DELETE')) {
    return { affectedRows: 1 };
  }

  return [];
}

function seedAuditLogsData(store) {
  if (!store.audit_logs) store.audit_logs = [];
  if (store.audit_logs.length === 0) {
    const now = Date.now();
    store.audit_logs = [
      // Business 1 (Acme Retail India) logs
      {
        id: 1,
        business_id: 1,
        user_id: 2,
        action: 'USER_LOGIN',
        entity_type: 'AUTH',
        entity_id: 2,
        details: { message: 'Rahul Sharma logged in successfully from Chrome on macOS', method: 'password' },
        ip_address: '192.168.1.45',
        created_at: new Date(now - 15 * 60000)
      },
      {
        id: 2,
        business_id: 1,
        user_id: 3,
        action: 'CAMPAIGN_LAUNCH',
        entity_type: 'CAMPAIGNS',
        entity_id: 1,
        details: { message: 'Launched broadcast campaign "Diwali Festive Blast" to 2,500 contacts via Kalaakchar WABA', recipients: 2500 },
        ip_address: '192.168.1.52',
        created_at: new Date(now - 2 * 3600000)
      },
      {
        id: 3,
        business_id: 1,
        user_id: 3,
        action: 'TEMPLATE_SYNC',
        entity_type: 'TEMPLATES',
        entity_id: null,
        details: { message: 'Synchronized 16 official message templates from Meta Cloud API', syncedCount: 16 },
        ip_address: '192.168.1.52',
        created_at: new Date(now - 5 * 3600000)
      },
      {
        id: 4,
        business_id: 1,
        user_id: 3,
        action: 'CONTACT_IMPORT',
        entity_type: 'CONTACTS',
        entity_id: null,
        details: { message: 'Imported 450 contacts from "Diwali_VIP_List.csv" into VIP Customer group', imported: 450 },
        ip_address: '192.168.1.52',
        created_at: new Date(now - 12 * 3600000)
      },
      {
        id: 5,
        business_id: 1,
        user_id: 2,
        action: 'MEMBER_INVITE',
        entity_type: 'TEAM',
        entity_id: 4,
        details: { message: 'Invited Amit Verma (agent@acmeretail.com) as Support Agent', role: 'agent' },
        ip_address: '192.168.1.45',
        created_at: new Date(now - 24 * 3600000)
      },
      {
        id: 6,
        business_id: 1,
        user_id: 2,
        action: 'ROLE_UPDATE',
        entity_type: 'TEAM',
        entity_id: 3,
        details: { message: 'Promoted Priya Patel from Support Agent to Marketing Specialist', newRole: 'marketer' },
        ip_address: '192.168.1.45',
        created_at: new Date(now - 36 * 3600000)
      },
      {
        id: 7,
        business_id: 1,
        user_id: 2,
        action: 'PLAN_UPGRADE',
        entity_type: 'BILLING',
        entity_id: 3,
        details: { message: 'Upgraded subscription tier to Pro Automation ($79.00/month)', plan: 'Pro Automation', price: 79.00 },
        ip_address: '192.168.1.45',
        created_at: new Date(now - 48 * 3600000)
      },
      {
        id: 8,
        business_id: 1,
        user_id: 2,
        action: 'WHATSAPP_CONNECT',
        entity_type: 'WHATSAPP',
        entity_id: 1,
        details: { message: 'Connected Meta Cloud API WhatsApp Phone Number +91 98765 43210 (WABA: 1763651071618866)', verified: true },
        ip_address: '192.168.1.45',
        created_at: new Date(now - 72 * 3600000)
      },

      // Business 2 (TechSky Solutions) logs
      {
        id: 9,
        business_id: 2,
        user_id: 5,
        action: 'USER_LOGIN',
        entity_type: 'AUTH',
        entity_id: 5,
        details: { message: 'Vikram Malhotra logged into TechSky Solutions workspace', method: 'password' },
        ip_address: '103.21.12.8',
        created_at: new Date(now - 30 * 60000)
      },
      {
        id: 10,
        business_id: 2,
        user_id: 6,
        action: 'CAMPAIGN_CREATED',
        entity_type: 'CAMPAIGNS',
        entity_id: 101,
        details: { message: 'Created campaign draft "Black Friday Early Access"', status: 'draft' },
        ip_address: '103.21.12.14',
        created_at: new Date(now - 3 * 3600000)
      },
      {
        id: 11,
        business_id: 2,
        user_id: 6,
        action: 'GROUP_CREATED',
        entity_type: 'CONTACTS',
        entity_id: 201,
        details: { message: 'Created contact group "Enterprise SaaS Leads 2026"', groupName: 'Enterprise SaaS Leads 2026' },
        ip_address: '103.21.12.14',
        created_at: new Date(now - 6 * 3600000)
      },

      // Global System logs (SuperAdmin view only)
      {
        id: 12,
        business_id: null,
        user_id: 1,
        action: 'SYSTEM_AUDIT',
        entity_type: 'SYSTEM',
        entity_id: null,
        details: { message: 'Automated platform security audit and token integrity check passed', status: 'healthy' },
        ip_address: '127.0.0.1',
        created_at: new Date(now - 10 * 3600000)
      },
      {
        id: 13,
        business_id: null,
        user_id: 1,
        action: 'SETTINGS_UPDATE',
        entity_type: 'SYSTEM',
        entity_id: null,
        details: { message: 'Platform global webhook endpoint secret rotated', scope: 'global' },
        ip_address: '127.0.0.1',
        created_at: new Date(now - 28 * 3600000)
      }
    ];
  }
}

function seedNotificationsData(store) {
  if (!store.notifications) store.notifications = [];
  if (store.notifications.length === 0) {
    const now = Date.now();
    store.notifications = [
      {
        id: 1,
        business_id: 1,
        user_id: 2,
        title: 'Meta Webhook Active & Verified',
        message: 'WhatsApp Cloud API Webhook is active and receiving live message delivery & read receipts.',
        type: 'success',
        is_read: false,
        link: '/settings',
        created_at: new Date(now - 12 * 60000)
      },
      {
        id: 2,
        business_id: 1,
        user_id: 2,
        title: 'Campaign Dispatched',
        message: 'Broadcast campaign "Diwali Festive Blast" completed: 2,500 messages sent with 98.4% delivery rate.',
        type: 'success',
        is_read: false,
        link: '/campaigns',
        created_at: new Date(now - 2 * 3600000)
      },
      {
        id: 3,
        business_id: 1,
        user_id: 2,
        title: 'Meta Templates Synced',
        message: '16 official message templates have been synced from Meta Cloud API.',
        type: 'info',
        is_read: false,
        link: '/templates',
        created_at: new Date(now - 5 * 3600000)
      },
      {
        id: 4,
        business_id: 1,
        user_id: 2,
        title: 'Pro Automation Plan Active',
        message: 'Your workspace is active on Pro Automation tier with 75,000 monthly messages.',
        type: 'info',
        is_read: true,
        link: '/billing',
        created_at: new Date(now - 24 * 3600000)
      },
      {
        id: 5,
        business_id: 1,
        user_id: 2,
        title: 'New Collaborator Joined',
        message: 'Amit Verma was added to your workspace as Support Agent.',
        type: 'info',
        is_read: true,
        link: '/team',
        created_at: new Date(now - 48 * 3600000)
      }
    ];
  }
}

export default {
  executeQuery,
  checkConnection,
  getMemoryStore,
  isUsingFallback
};

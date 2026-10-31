import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
      const saved = JSON.parse(fs.readFileSync(DEV_STORE_PATH, 'utf8'));
      Object.keys(saved).forEach((k) => {
        memoryStore[k] = saved[k];
      });
      // Always guarantee real Meta templates are present
      memoryStore.templates = realApprovedMetaTemplates;

      // Always guarantee connected WhatsApp accounts use the latest permanent token & Indian phone number
      const liveToken = process.env.META_ACCESS_TOKEN || 'EAAQjnGtRDZCgBS1tjbT3HB636ZArmfxy00RUrQLYzujvPZBN1sU0yDZClKaiBAQAhxiiECwnCp1k2YDlL9s6Ff3ZAZBGA4DvySmfnWutocges1MV3eIjW9bciSoNHfojmwcRcVizsWZCwMzDolQBQJfK9yXp6VsOFuabsnVn92TnosYP6AZBXGoRJob5J9STih1qfgZDZD';
      const rawEnvWaba = process.env.META_WABA_ID;
      const liveWabaId = (!rawEnvWaba || rawEnvWaba === '28532933229644434') ? '1618945099958602' : rawEnvWaba;

      memoryStore.whatsapp_accounts = [
        {
          id: 1,
          business_id: 1,
          waba_id: liveWabaId,
          phone_number_id: livePhoneId,
          phone_number: '+91 86014 67210',
          display_name: 'Yuvraj (Indian Number)',
          quality_rating: 'GREEN',
          messaging_limit_tier: 'STANDARD',
          status: 'connected',
          is_primary: 1,
          access_token_encrypted: liveToken,
          created_at: new Date()
        }
      ];

      if (!memoryStore.tenant_meta_integrations) {
        memoryStore.tenant_meta_integrations = [];
      }

      seedInboxData(memoryStore);

      fallbackInitialized = true;
      saveMemoryStore();
      startAutoPersistence();
      return;
    } catch (e) {
      // Continue to seed if file is corrupted
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
    { id: 1, name: 'Acme Retail India', slug: 'acme-retail', timezone: 'Asia/Kolkata', status: 'active', created_at: new Date() }
  ];

  memoryStore.users = [
    { id: 1, business_id: null, name: 'System SuperAdmin', email: 'superadmin@campaignflow.io', password_hash: hash, role: 'superadmin', is_email_verified: 1, status: 'active', created_at: new Date() },
    { id: 2, business_id: 1, name: 'Rahul Sharma (Owner)', email: 'owner@acmeretail.com', password_hash: hash, role: 'owner', is_email_verified: 1, status: 'active', created_at: new Date() },
    { id: 3, business_id: 1, name: 'Priya Patel (Marketer)', email: 'marketer@acmeretail.com', password_hash: hash, role: 'marketer', is_email_verified: 1, status: 'active', created_at: new Date() },
    { id: 4, business_id: 1, name: 'Amit Verma (Support Agent)', email: 'agent@acmeretail.com', password_hash: hash, role: 'agent', is_email_verified: 1, status: 'active', created_at: new Date() }
  ];

  memoryStore.subscriptions = [
    { id: 1, business_id: 1, plan_id: 3, status: 'active', current_period_start: new Date(), current_period_end: new Date(Date.now() + 30 * 86400000) }
  ];

  memoryStore.whatsapp_accounts = [
    {
      id: 1,
      business_id: 1,
      waba_id: '1618945099958602',
      phone_number_id: '1341070215765610',
      phone_number: '+91 86014 67210',
      display_name: 'Yuvraj (Indian Number)',
      quality_rating: 'GREEN',
      messaging_limit_tier: 'STANDARD',
      status: 'connected',
      is_primary: 1,
      access_token_encrypted: 'EAAQjnGtRDZCgBS1tjbT3HB636ZArmfxy00RUrQLYzujvPZBN1sU0yDZClKaiBAQAhxiiECwnCp1k2YDlL9s6Ff3ZAZBGA4DvySmfnWutocges1MV3eIjW9bciSoNHfojmwcRcVizsWZCwMzDolQBQJfK9yXp6VsOFuabsnVn92TnosYP6AZBXGoRJob5J9STih1qfgZDZD',
      created_at: new Date()
    }
  ];

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
  try {
    const p = getPool();
    const [rows] = await p.execute('SELECT 1 as connected');
    useFallback = false;
    return true;
  } catch (err) {
    useFallback = true;
    await initFallbackStore();
    console.warn(`⚠️ [Database] MySQL not reachable at ${process.env.DATABASE_HOST || 'localhost'}:${process.env.DATABASE_PORT || 3306}. Running in resilient Development/Mock DB Adapter mode.`);
    return false;
  }
}

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '3306', 10),
      user: process.env.DATABASE_USER || 'cf_user',
      password: process.env.DATABASE_PASSWORD || 'cf_password',
      database: process.env.DATABASE_NAME || 'campaignflow',
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
  if (useFallback) {
    await initFallbackStore();
    return executeFallbackQuery(sql, params);
  }

  try {
    const p = getPool();
    const [rows] = await p.execute(sql, params);
    return rows;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      useFallback = true;
      await initFallbackStore();
      console.warn(`⚠️ [Database] MySQL connection dropped (${err.code}). Switching to Development Mock Adapter.`);
      return executeFallbackQuery(sql, params);
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

export default {
  executeQuery,
  checkConnection,
  getMemoryStore,
  isUsingFallback
};

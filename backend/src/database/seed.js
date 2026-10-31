import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function runSeed() {
  console.log('🌱 [Seeder] Starting development data seeding...');

  const host = process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '3306', 10);
  const user = process.env.DATABASE_USER || process.env.DB_USER || 'cf_user';
  const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'cf_password';
  const database = process.env.DATABASE_NAME || process.env.DB_NAME || 'campaignflow';

  let connection;
  try {
    connection = await mysql.createConnection({ host, port, user, password, database });

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 1. Seed Subscription Plans
    console.log('🌱 Seeding Subscription Plans...');
    await connection.query(`
      INSERT INTO subscription_plans (id, name, slug, monthly_price, max_contacts, max_campaigns_per_month, max_messages_per_month, max_team_members, features)
      VALUES 
      (1, 'Free Trial', 'free', 0.00, 250, 2, 500, 1, '{"analytics": "basic", "ai_assistant": false, "api_access": false}'),
      (2, 'Starter Growth', 'starter', 29.00, 2500, 15, 10000, 3, '{"analytics": "standard", "ai_assistant": true, "api_access": false}'),
      (3, 'Pro Automation', 'pro', 79.00, 15000, 50, 75000, 10, '{"analytics": "advanced", "ai_assistant": true, "api_access": true}'),
      (4, 'Enterprise Scale', 'enterprise', 249.00, 100000, 9999, 500000, 50, '{"analytics": "custom", "ai_assistant": true, "api_access": true, "dedicated_ip": true}')
      ON DUPLICATE KEY UPDATE name=VALUES(name), monthly_price=VALUES(monthly_price), max_contacts=VALUES(max_contacts);
    `);

    // 2. Seed Super Admin
    console.log('🌱 Seeding Super Admin...');
    await connection.query(`
      INSERT INTO users (id, business_id, name, email, password_hash, role, is_email_verified, status)
      VALUES (1, NULL, 'System SuperAdmin', 'superadmin@campaignflow.io', ?, 'superadmin', TRUE, 'active')
      ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), role='superadmin';
    `, [passwordHash]);

    // 3. Seed Demo Business
    console.log('🌱 Seeding Demo Business...');
    await connection.query(`
      INSERT INTO businesses (id, name, slug, timezone, status)
      VALUES (1, 'Acme Retail India', 'acme-retail', 'Asia/Kolkata', 'active')
      ON DUPLICATE KEY UPDATE name=VALUES(name), timezone=VALUES(timezone);
    `);

    // 4. Seed Business Team Members
    console.log('🌱 Seeding Team Members...');
    await connection.query(`
      INSERT INTO users (id, business_id, name, email, password_hash, role, is_email_verified, status)
      VALUES 
      (2, 1, 'Rahul Sharma (Owner)', 'owner@acmeretail.com', ?, 'owner', TRUE, 'active'),
      (3, 1, 'Priya Patel (Marketer)', 'marketer@acmeretail.com', ?, 'marketer', TRUE, 'active'),
      (4, 1, 'Amit Verma (Support Agent)', 'agent@acmeretail.com', ?, 'agent', TRUE, 'active')
      ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), role=VALUES(role);
    `, [passwordHash, passwordHash, passwordHash]);

    // 5. Seed Subscription for Business
    console.log('🌱 Seeding Business Subscription...');
    await connection.query(`
      INSERT INTO subscriptions (business_id, plan_id, status, current_period_start, current_period_end)
      VALUES (1, 3, 'active', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
      ON DUPLICATE KEY UPDATE plan_id=VALUES(plan_id), status=VALUES(status);
    `);

    // 6. Seed Connected WhatsApp Account
    console.log('🌱 Seeding WhatsApp Account...');
    const liveToken = process.env.META_ACCESS_TOKEN || 'EAAQjnGtRDZCgBS1tjbT3HB636ZArmfxy00RUrQLYzujvPZBN1sU0yDZClKaiBAQAhxiiECwnCp1k2YDlL9s6Ff3ZAZBGA4DvySmfnWutocges1MV3eIjW9bciSoNHfojmwcRcVizsWZCwMzDolQBQJfK9yXp6VsOFuabsnVn92TnosYP6AZBXGoRJob5J9STih1qfgZDZD';
    const livePhoneId = process.env.META_PHONE_NUMBER_ID || '1341070215765610';
    const liveWabaId = process.env.META_WABA_ID || '1618945099958602';

    await connection.query(`
      INSERT INTO whatsapp_accounts (id, business_id, waba_id, phone_number_id, phone_number, display_name, quality_rating, messaging_limit_tier, status, is_primary, access_token_encrypted)
      VALUES (1, 1, ?, ?, '+91 86014 67210', 'Yuvraj (Indian Number)', 'GREEN', 'STANDARD', 'connected', 1, ?)
      ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), status='connected', phone_number_id=VALUES(phone_number_id), waba_id=VALUES(waba_id), access_token_encrypted=VALUES(access_token_encrypted), is_primary=1;
    `, [liveWabaId, livePhoneId, liveToken]);

    // 7. Seed Tags
    console.log('🌱 Seeding Tags...');
    await connection.query(`
      INSERT INTO tags (id, business_id, name, color)
      VALUES 
      (1, 1, 'VIP Customer', '#7952b3'),
      (2, 1, 'Diwali Festival 2026', '#fd7e14'),
      (3, 1, 'Weekend Shopper', '#20c997'),
      (4, 1, 'New Subscriber', '#0d6efd')
      ON DUPLICATE KEY UPDATE name=VALUES(name);
    `);

    // 8. Seed Sample Templates
    console.log('🌱 Seeding WhatsApp Templates...');
    const festivePromoComponents = JSON.stringify([
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Special Festive Offer for {{1}} 🎉'
      },
      {
        type: 'BODY',
        text: 'Hello {{1}}, enjoy flat {{2}}% off on all festive collections at Acme Retail! Use coupon code {{3}} at checkout. Valid till this Sunday.'
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to unsubscribe'
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'URL', text: 'Shop Now', url: 'https://acmeretail.com/sale' },
          { type: 'QUICK_REPLY', text: 'Talk to Support' }
        ]
      }
    ]);

    const cartRecoveryComponents = JSON.stringify([
      {
        type: 'BODY',
        text: 'Hi {{1}}, you left items in your cart! Complete your order today and get free express shipping with code {{2}}.'
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to opt out'
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'URL', text: 'Complete Order', url: 'https://acmeretail.com/checkout' }
        ]
      }
    ]);

    const welcomeMsgComponents = JSON.stringify([
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Hello'
      },
      {
        type: 'BODY',
        text: 'Hello! {{customer_name}} Welcome to our official WhatsApp channel. Thank you for connecting with us.'
      }
    ]);

    await connection.query(`
      INSERT INTO templates (id, business_id, whatsapp_account_id, meta_template_id, name, language, category, status, parameter_format, components)
      VALUES 
      (1, 1, 1, 'meta_tpl_festive_promo_v1', 'festive_discount_sale_v1', 'en_US', 'MARKETING', 'APPROVED', 'POSITIONAL', ?),
      (2, 1, 1, 'meta_tpl_cart_recovery_v1', 'cart_abandonment_recovery_v1', 'en_US', 'MARKETING', 'APPROVED', 'POSITIONAL', ?),
      (3, 1, 1, '1447518427357464', 'welcome_msg', 'en', 'MARKETING', 'APPROVED', 'NAMED', ?),
      (4, 1, 1, 'meta_tpl_hello_world', 'hello_world', 'en_US', 'UTILITY', 'APPROVED', 'POSITIONAL', '[]')
      ON DUPLICATE KEY UPDATE status='APPROVED', components=VALUES(components);
    `, [festivePromoComponents, cartRecoveryComponents, welcomeMsgComponents]);

    // 9. Seed Sample Contacts with Consent
    console.log('🌱 Seeding Sample Opted-in Contacts...');
    const sampleContacts = [
      ['+919811122233', '91', 'Ananya Gupta', 'ananya@example.com'],
      ['+919822233344', '91', 'Vikram Malhotra', 'vikram@example.com'],
      ['+919833344455', '91', 'Sunita Rao', 'sunita@example.com'],
      ['+919844455566', '91', 'Rohan Mehra', 'rohan@example.com'],
      ['+919855566677', '91', 'Deepa Nair', 'deepa@example.com'],
      ['+919565763089', '91', 'Yuvraj Kushwaha', 'yuvraj@example.com']
    ];

    for (let i = 0; i < sampleContacts.length; i++) {
      const [phone, country_code, name, email] = sampleContacts[i];
      const contactId = i + 1;
      await connection.query(`
        INSERT INTO contacts (id, business_id, phone, country_code, name, email, is_opted_in, status, custom_fields)
        VALUES (?, 1, ?, ?, ?, ?, TRUE, 'active', '{"tier": "gold"}')
        ON DUPLICATE KEY UPDATE name=VALUES(name), is_opted_in=TRUE;
      `, [contactId, phone, country_code, name, email]);

      // Consent record
      await connection.query(`
        INSERT INTO contact_consents (business_id, contact_id, consent_status, consent_source, consent_category, proof_notes)
        VALUES (1, ?, 'opted_in', 'website_checkout', 'promotional', 'User checked explicit opt-in at checkout order #10892')
        ON DUPLICATE KEY UPDATE consent_status='opted_in';
      `, [contactId]);

      // Tag assignment
      await connection.query(`
        INSERT INTO contact_tags (business_id, contact_id, tag_id)
        VALUES (1, ?, ?)
        ON DUPLICATE KEY UPDATE tag_id=VALUES(tag_id);
      `, [contactId, (i % 3) + 1]);
    }

    // 10. Seed Completed Demo Campaign
    console.log('🌱 Seeding Completed Demo Campaign...');
    const mappings = JSON.stringify({
      var_1: 'contact.name',
      var_2: '30',
      var_3: 'FESTIVE30'
    });

    await connection.query(`
      INSERT INTO campaigns (id, business_id, whatsapp_account_id, template_id, name, purpose, status, total_recipients, sent_count, delivered_count, read_count, failed_count, scheduled_at, started_at, completed_at, variable_mappings)
      VALUES (1, 1, 1, 1, 'Diwali Mega Sale Early Access', 'Festive customer activation campaign', 'completed', 5, 5, 5, 4, 0, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), ?)
      ON DUPLICATE KEY UPDATE status='completed';
    `, [mappings]);

    // 11. Seed Campaign Recipients & Messages
    for (let i = 0; i < sampleContacts.length; i++) {
      const contactId = i + 1;
      const phone = sampleContacts[i][0];
      const providerMsgId = `wamid.HBgLMjAyNjEwMjkwM${i}==`;
      const isRead = i < 4; // 4 out of 5 read

      await connection.query(`
        INSERT INTO campaign_recipients (business_id, campaign_id, contact_id, phone, status, sent_at, delivered_at, read_at, provider_message_id)
        VALUES (1, 1, ?, ?, ?, NOW(), NOW(), ?, ?)
        ON DUPLICATE KEY UPDATE status=VALUES(status);
      `, [contactId, phone, isRead ? 'read' : 'delivered', isRead ? new Date() : null, providerMsgId]);

      await connection.query(`
        INSERT INTO messages (business_id, campaign_id, contact_id, whatsapp_account_id, direction, provider_message_id, phone, message_type, status)
        VALUES (1, 1, ?, 1, 'outbound', ?, ?, 'template', ?)
        ON DUPLICATE KEY UPDATE status=VALUES(status);
      `, [contactId, providerMsgId, phone, isRead ? 'read' : 'delivered']);
    }

    // 12. Seed WhatsApp Conversations for Inbox
    console.log('🌱 Seeding WhatsApp Conversations...');
    await connection.query(`
      INSERT INTO whatsapp_conversations 
      (id, business_id, whatsapp_account_id, contact_id, customer_phone, assigned_user_id, status, unread_count, last_message_text, last_message_at, last_incoming_message_at, service_window_expires_at)
      VALUES 
      (1, 1, 1, 1, '+919811122233', 4, 'open', 1, 'Great! Can you share the festive catalogue link?', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 23 HOUR)),
      (2, 1, 1, 2, '+919822233344', NULL, 'open', 0, 'Thank you for connecting with us.', DATE_SUB(NOW(), INTERVAL 26 HOUR), DATE_SUB(NOW(), INTERVAL 28 HOUR), DATE_SUB(NOW(), INTERVAL 4 HOUR))
      ON DUPLICATE KEY UPDATE status=VALUES(status), service_window_expires_at=VALUES(service_window_expires_at);
    `);

    // 13. Seed Inbound Unsubscribe Simulation
    console.log('🌱 Seeding Inbound Conversation...');
    await connection.query(`
      INSERT INTO inbound_conversations (id, business_id, contact_id, whatsapp_account_id, last_message_text, last_message_at, is_resolved)
      VALUES (1, 1, 5, 1, 'Thanks for the offer! Can I apply this offline in store too?', NOW(), FALSE)
      ON DUPLICATE KEY UPDATE last_message_text=VALUES(last_message_text);
    `);

    // 13. Seed Usage Ledger
    await connection.query(`
      INSERT INTO usage_ledger (business_id, metric_type, quantity, period_month)
      VALUES 
      (1, 'messages_sent', 5, DATE_FORMAT(NOW(), '%Y-%m')),
      (1, 'contacts_stored', 5, DATE_FORMAT(NOW(), '%Y-%m')),
      (1, 'campaigns_run', 1, DATE_FORMAT(NOW(), '%Y-%m'))
    `);

    console.log('🎉 [Seeder] Development database seeded successfully!');
    console.log('-----------------------------------------------------------');
    console.log('Super Admin Login : superadmin@campaignflow.io / Password123!');
    console.log('Owner Login       : owner@acmeretail.com / Password123!');
    console.log('Marketer Login    : marketer@acmeretail.com / Password123!');
    console.log('Agent Login       : agent@acmeretail.com / Password123!');
    console.log('-----------------------------------------------------------');
  } catch (error) {
    console.error('❌ [Seeder] Failed to seed database:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

runSeed();

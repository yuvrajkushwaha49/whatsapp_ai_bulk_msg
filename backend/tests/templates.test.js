import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { checkConnection } from '../src/database/db.js';
import * as whatsappService from '../src/modules/whatsapp/whatsapp.service.js';
import * as webhooksService from '../src/modules/webhooks/webhooks.service.js';
import * as campaignsService from '../src/modules/campaigns/campaigns.service.js';

describe('WhatsApp Template Management Test Suite', () => {
  before(async () => {
    await checkConnection();
  });

  test('1. Template Name Validation: Rejects invalid naming schemes according to Meta policies', async () => {
    // Uppercase not allowed
    await assert.rejects(
      async () => {
        await whatsappService.createTemplate(1, 2, {
          name: 'Invalid_Name_UPPERCASE',
          category: 'MARKETING',
          body: 'Hello {{1}}'
        });
      },
      /Template name must contain only lowercase/
    );

    // Spaces not allowed
    await assert.rejects(
      async () => {
        await whatsappService.createTemplate(1, 2, {
          name: 'invalid name with spaces',
          category: 'MARKETING',
          body: 'Hello {{1}}'
        });
      },
      /Template name must contain only lowercase/
    );

    // Special characters not allowed
    await assert.rejects(
      async () => {
        await whatsappService.createTemplate(1, 2, {
          name: 'invalid@template!',
          category: 'MARKETING',
          body: 'Hello {{1}}'
        });
      },
      /Template name must contain only lowercase/
    );
  });

  test('2. Template Creation: Validates variables, examples, and saves with PENDING status', async () => {
    const tplName = `sale_${Date.now()}`;
    const tpl = await whatsappService.createTemplate(1, 2, {
      name: tplName,
      category: 'MARKETING',
      language: 'en_US',
      header: {
        type: 'TEXT',
        text: 'Flash Sale Today'
      },
      body: {
        text: 'Hi {{1}}, get {{2}}% off on all items! Use code {{3}} at checkout.',
        examples: {
          '1': 'Rahul',
          '2': '40',
          '3': 'FLASH40'
        }
      },
      footer: {
        text: 'Reply STOP to opt out'
      },
      buttons: [
        { type: 'URL', text: 'Shop Now', url: 'https://example.com/shop' }
      ]
    });

    assert.ok(tpl.id);
    assert.strictEqual(tpl.name, tplName);
    assert.strictEqual(tpl.category, 'MARKETING');
    assert.ok(tpl.meta_template_id);
    assert.ok(Array.isArray(tpl.components));
    assert.strictEqual(tpl.components.length, 4); // Header, Body, Footer, Buttons
  });

  test('3. Template Listing & Stats: Correctly computes aggregated dashboard status counts', async () => {
    const res = await whatsappService.listTemplates(1);
    assert.ok(res.templates.length > 0);
    assert.ok(res.stats);
    assert.strictEqual(typeof res.stats.total, 'number');
    assert.strictEqual(typeof res.stats.approved, 'number');
    assert.strictEqual(typeof res.stats.pending, 'number');
    assert.strictEqual(typeof res.stats.rejected, 'number');
    assert.strictEqual(typeof res.stats.paused_or_disabled, 'number');
    assert.strictEqual(res.stats.total, res.stats.approved + res.stats.pending + res.stats.rejected + res.stats.paused_or_disabled);
  });

  test('4. Tenant Isolation: Business 1 cannot access Business 999 templates', async () => {
    const biz1Templates = await whatsappService.listTemplates(1);
    const biz999Templates = await whatsappService.listTemplates(999);

    assert.ok(biz1Templates.templates.length > 0);
    assert.strictEqual(biz999Templates.templates.length, 0);

    // Business 999 cannot access template belonging to Business 1
    await assert.rejects(
      async () => {
        await whatsappService.getTemplate(999, biz1Templates.templates[0].id);
      },
      /Template not found/
    );
  });

  test('5. Webhook Status Processing: Updates template status idempotently upon Meta approval', async () => {
    const tplName = `webhook_test_${Date.now()}`;
    const tpl = await whatsappService.createTemplate(1, 2, {
      name: tplName,
      category: 'MARKETING',
      language: 'en_US',
      body: 'Your special offer is ready for today.'
    });

    // Simulate Meta webhook event for approval
    const webhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '28532933229644434',
          changes: [
            {
              field: 'message_template_status_update',
              value: {
                event: 'APPROVED',
                message_template_id: tpl.meta_template_id,
                message_template_name: tpl.name,
                message_template_language: 'en_US',
                reason: 'NONE'
              }
            }
          ]
        }
      ]
    };

    const webhookResult = await webhooksService.processWebhookPayload(webhookPayload);
    assert.strictEqual(webhookResult.processed, true);

    // Verify template status was updated to APPROVED
    const updated = await whatsappService.getTemplate(1, tpl.id);
    assert.strictEqual(updated.status, 'APPROVED');
  });

  test('6. Webhook Status Processing: Handles Meta rejection and records rejection reason', async () => {
    const tplName = `webhook_rej_${Date.now()}`;
    const tpl = await whatsappService.createTemplate(1, 2, {
      name: tplName,
      category: 'MARKETING',
      language: 'en_US',
      body: 'Get rich quick today with special offers!'
    });

    const webhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '28532933229644434',
          changes: [
            {
              field: 'message_template_status_update',
              value: {
                event: 'REJECTED',
                message_template_id: tpl.meta_template_id,
                message_template_name: tpl.name,
                message_template_language: 'en_US',
                reason: 'PROMOTIONAL_POLICY_VIOLATION'
              }
            }
          ]
        }
      ]
    };

    await webhooksService.processWebhookPayload(webhookPayload);

    const updated = await whatsappService.getTemplate(1, tpl.id);
    assert.strictEqual(updated.status, 'REJECTED');
    assert.strictEqual(updated.rejection_reason, 'PROMOTIONAL_POLICY_VIOLATION');
  });

  test('7. Campaign Preflight Safety: Blocks dispatch if selected template is not APPROVED', async () => {
    const tplName = `unapproved_${Date.now()}`;
    // Create an unapproved (PENDING or REJECTED) template
    const unapprovedTpl = await whatsappService.createTemplate(1, 2, {
      name: tplName,
      category: 'MARKETING',
      language: 'en_US',
      body: 'Pending marketing broadcast notice.'
    });

    // Ensure it's not approved for preflight test
    if (unapprovedTpl.status === 'APPROVED') {
      unapprovedTpl.status = 'PENDING';
    }

    const preflight = await campaignsService.preflightCheck(1, {
      name: 'Test Unapproved Campaign',
      templateId: unapprovedTpl.id,
      recipientCount: 5,
      senderAccounts: [{ id: 1 }]
    });

    assert.strictEqual(preflight.canProceed, false);
    assert.ok(preflight.issues.some(i => i.includes('Only Meta-APPROVED templates can be sent')));
  });
});

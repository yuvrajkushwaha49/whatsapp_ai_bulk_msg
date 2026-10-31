process.env.NODE_ENV = 'test';
import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { checkConnection, getMemoryStore } from '../src/database/db.js';
import * as webhooksService from '../src/modules/webhooks/webhooks.service.js';
import * as inboxService from '../src/modules/inbox/inbox.service.js';

describe('WhatsApp Inbox & Two-Way Live Chat Test Suite', () => {
  before(async () => {
    await checkConnection();
  });

  const testUser = { id: 2, name: 'Rahul Sharma', role: 'owner' };
  const agentUser = { id: 4, name: 'Amit Verma', role: 'agent' };

  test('1. Incoming Webhook: Inbound customer message creates contact, conversation, and sets 24h window', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const mockInboundPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '10987654321',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+91 86014 67210',
                  phone_number_id: '1341070215765610'
                },
                contacts: [
                  {
                    profile: { name: 'Priya Sharma' },
                    wa_id: '919876500112'
                  }
                ],
                messages: [
                  {
                    from: '919876500112',
                    id: `wamid.test_in_${Date.now()}`,
                    timestamp: String(timestamp),
                    text: { body: 'Hello! I need assistance with my order.' },
                    type: 'text'
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const result = await webhooksService.processWebhookPayload(mockInboundPayload);
    assert.strictEqual(result.processed, true);

    // Verify conversation was created
    const conversations = await inboxService.listConversations(1, testUser, { search: 'Priya' });
    assert.ok(conversations.items.length > 0, 'Conversation for Priya should exist');
    const conv = conversations.items[0];
    assert.strictEqual(conv.customer_phone, '+919876500112');
    assert.strictEqual(conv.status, 'open');
    assert.strictEqual(conv.is_window_open, true, '24h window must be open for new inbound message');
  });

  test('2. Webhook Idempotency: Duplicate Meta message ID is not stored twice', async () => {
    const duplicateMetaId = `wamid.test_idempotent_${Date.now()}`;
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '1341070215765610' },
                contacts: [{ profile: { name: 'Idempotency Test' }, wa_id: '919876500999' }],
                messages: [
                  {
                    from: '919876500999',
                    id: duplicateMetaId,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    text: { body: 'Unique message payload' },
                    type: 'text'
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    // First delivery
    await webhooksService.processWebhookPayload(payload);
    // Duplicate delivery
    await webhooksService.processWebhookPayload(payload);

    const store = getMemoryStore();
    const matches = store.whatsapp_messages?.filter(m => m.meta_message_id === duplicateMetaId) || [];
    assert.strictEqual(matches.length, 1, 'Duplicate webhook message should not be inserted twice');
  });

  test('3. 24-Hour Messaging Window: Free-form reply allowed when window is active', async () => {
    // Conversation 1 is seeded with active 24h window
    const store = getMemoryStore();
    const c1 = store.whatsapp_conversations?.find(c => c.id === 1);
    if (c1) {
      c1.service_window_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
      c1.last_inbound_message_at = new Date();
    }

    const reply = await inboxService.sendTextMessage(1, testUser, 1, 'Thanks for contacting us! How can we assist you?');
    assert.ok(reply.id);
    assert.strictEqual(reply.direction, 'OUTBOUND');
    assert.strictEqual(reply.message_body, 'Thanks for contacting us! How can we assist you?');
    assert.strictEqual(reply.message_status, 'sent');
  });

  test('4. 24-Hour Messaging Window: Free-form reply strictly rejected when window is expired', async () => {
    // Conversation 2 is seeded with expired 24h window
    await assert.rejects(
      async () => {
        await inboxService.sendTextMessage(1, testUser, 2, 'Are you still interested in this offer?');
      },
      (err) => {
        assert.strictEqual(err.code, 'SERVICE_WINDOW_EXPIRED');
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /24-hour customer service window has expired/);
        return true;
      }
    );
  });

  test('5. Template Messages: Allowed even when 24-hour window has expired', async () => {
    // Ensure an approved template exists
    const store = getMemoryStore();
    if (!store.templates.some(t => t.status === 'APPROVED')) {
      store.templates.push({
        id: 999,
        business_id: 1,
        name: 'customer_reengagement',
        language: 'en',
        status: 'APPROVED',
        category: 'MARKETING'
      });
    }

    const approvedTpl = store.templates.find(t => t.status === 'APPROVED');

    // Send to Conversation 2 (expired window)
    const tplMsg = await inboxService.sendTemplateMessage(1, testUser, 2, {
      templateId: approvedTpl.id,
      templateName: approvedTpl.name,
      variableMappings: { '1': 'Vikram' }
    });

    assert.ok(tplMsg.id);
    assert.strictEqual(tplMsg.message_type, 'template');
    assert.strictEqual(tplMsg.direction, 'OUTBOUND');
  });

  test('6. Conversation Status & Agent Assignment: Supports assign, close, reopen, read, unread', async () => {
    // Assign conversation 1 to agent
    const assigned = await inboxService.assignConversation(1, testUser, 1, agentUser.id);
    assert.strictEqual(assigned.assigned_user_id, agentUser.id);

    // Close conversation
    const closed = await inboxService.updateStatus(1, testUser, 1, 'closed');
    assert.strictEqual(closed.status, 'closed');

    // Reopen conversation
    const reopened = await inboxService.updateStatus(1, testUser, 1, 'open');
    assert.strictEqual(reopened.status, 'open');

    // Mark as read then unread
    await inboxService.markAsRead(1, 1);
    let conv = await inboxService.getConversation(1, 1);
    assert.strictEqual(conv.unread_count, 0);

    await inboxService.markAsUnread(1, 1);
    conv = await inboxService.getConversation(1, 1);
    assert.strictEqual(conv.unread_count, 1);
  });

  test('7. Customer CRM: Supports adding notes and updating contact tags', async () => {
    const note = await inboxService.addNote(1, testUser, 1, 'Customer requested special holiday gift wrapping.');
    assert.ok(note.id);
    assert.strictEqual(note.note, 'Customer requested special holiday gift wrapping.');

    const notesList = await inboxService.getNotes(1, 1);
    assert.ok(notesList.some(n => n.id === note.id));

    // Update tags
    const updatedContact = await inboxService.updateContact(1, 1, {
      tags: ['vip', 'festive-buyer']
    });
    assert.deepStrictEqual(updatedContact.tags, ['vip', 'festive-buyer']);
  });

  test('8. Multi-Tenant Isolation: Tenant 2 cannot access or view Tenant 1 conversations', async () => {
    const tenant2User = { id: 99, role: 'owner' };
    const tenant2Convs = await inboxService.listConversations(2, tenant2User, {});
    assert.strictEqual(tenant2Convs.items.length, 0, 'Tenant 2 should have no access to Tenant 1 conversations');

    const conv = await inboxService.getConversation(2, 1);
    assert.strictEqual(conv, null, 'Tenant 2 cannot fetch Tenant 1 conversation by ID');
  });
});

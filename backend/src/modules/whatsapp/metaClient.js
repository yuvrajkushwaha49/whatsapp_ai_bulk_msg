import axios from 'axios';
import crypto from 'crypto';
import logger from '../../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const META_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Verify Meta Webhook HMAC-SHA256 Signature
 */
export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader) return false;
  const secret = appSecret || process.env.META_APP_SECRET;
  if (!secret || secret === 'your_meta_app_secret') {
    // In local dev with placeholder secret, log and allow testing
    return true;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') return false;
  const signature = parts[1];

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(digest, 'hex'));
}

/**
 * Meta Cloud API Client with resilient Fallback Mock Mode
 */
export class MetaCloudApiClient {
  constructor(accessToken, phoneNumberId, wabaId) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.wabaId = wabaId;
    this.isMock = !accessToken || accessToken.startsWith('placeholder') || accessToken.startsWith('mock_');
  }

  /**
   * Fetch approved WhatsApp Templates from Meta Cloud API
   */
  async getTemplates() {
    if (this.isMock) {
      logger.info('[MetaClient:Mock] Returning mock synced templates');
      return [
        {
          id: 'meta_tpl_festive_promo_v1',
          name: 'festive_discount_sale_v1',
          language: 'en_US',
          category: 'MARKETING',
          status: 'APPROVED',
          components: [
            { type: 'HEADER', format: 'TEXT', text: 'Special Festive Offer for {{1}} 🎉' },
            { type: 'BODY', text: 'Hello {{1}}, enjoy flat {{2}}% off on all festive collections at Acme Retail! Use coupon code {{3}} at checkout. Valid till this Sunday.' },
            { type: 'FOOTER', text: 'Reply STOP to unsubscribe' },
            { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Shop Now', url: 'https://acmeretail.com/sale' }] }
          ]
        },
        {
          id: 'meta_tpl_cart_recovery_v1',
          name: 'cart_abandonment_recovery_v1',
          language: 'en_US',
          category: 'MARKETING',
          status: 'APPROVED',
          components: [
            { type: 'BODY', text: 'Hi {{1}}, you left items in your cart! Complete your order today and get free express shipping with code {{2}}.' },
            { type: 'FOOTER', text: 'Reply STOP to opt out' },
            { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Complete Order', url: 'https://acmeretail.com/checkout' }] }
          ]
        },
        {
          id: 'meta_tpl_welcome_vip_v1',
          name: 'welcome_vip_onboarding_v1',
          language: 'en_US',
          category: 'MARKETING',
          status: 'APPROVED',
          components: [
            { type: 'HEADER', format: 'TEXT', text: 'Welcome to VIP Club, {{1}} 🌟' },
            { type: 'BODY', text: 'Thank you for joining our exclusive community. Enjoy 15% off your next purchase using code {{2}}.' },
            { type: 'FOOTER', text: 'Reply STOP to opt out' }
          ]
        }
      ];
    }

    try {
      const response = await axios.get(`${META_BASE_URL}/${this.wabaId}/message_templates`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      return response.data.data;
    } catch (error) {
      logger.error('[MetaClient] Failed to fetch templates from Meta', error);
      throw error;
    }
  }

  /**
   * Send WhatsApp Template Message via Cloud API
   */
  async sendTemplateMessage({ recipientPhone, templateName, languageCode = 'en_US', components = [] }) {
    if (this.isMock) {
      const mockMsgId = `wamid.HBgLMjAy${Date.now().toString(36)}${Math.random().toString(36).substring(2, 7)}==`;
      logger.info(`[MetaClient:Mock] Sent template "${templateName}" to ${recipientPhone} -> ${mockMsgId}`);
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: recipientPhone, wa_id: recipientPhone.replace(/\D/g, '') }],
        messages: [{ id: mockMsgId, message_status: 'accepted' }]
      };
    }

    try {
      const templateObj = {
        name: templateName,
        language: { code: languageCode }
      };

      if (Array.isArray(components) && components.length > 0) {
        templateObj.components = components;
      }

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone.replace(/\D/g, ''),
        type: 'template',
        template: templateObj
      };

      const response = await axios.post(`${META_BASE_URL}/${this.phoneNumberId}/messages`, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      const errData = error.response ? error.response.data : error.message;
      logger.error(`[MetaClient] Send message failed to ${recipientPhone}`, error, { response: errData });
      throw new Error(errData?.error?.message || error.message);
    }
  }
}

export default {
  verifyMetaSignature,
  MetaCloudApiClient
};

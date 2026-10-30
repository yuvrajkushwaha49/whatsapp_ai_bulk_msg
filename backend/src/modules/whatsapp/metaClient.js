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
    this.isMock = !accessToken || accessToken.startsWith('placeholder') || accessToken.startsWith('mock_') || process.env.NODE_ENV === 'test';
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

  /**
   * Send WhatsApp Free-Form Text Message (within 24-hr Customer Service Window)
   */
  async sendTextMessage({ recipientPhone, textBody, previewUrl = false }) {
    if (this.isMock) {
      const mockMsgId = `wamid.mock_text_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
      logger.info(`[MetaClient:Mock] Sent text message to ${recipientPhone} -> ${mockMsgId}`);
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: recipientPhone, wa_id: recipientPhone.replace(/\D/g, '') }],
        messages: [{ id: mockMsgId, message_status: 'accepted' }]
      };
    }

    try {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone.replace(/\D/g, ''),
        type: 'text',
        text: {
          preview_url: Boolean(previewUrl),
          body: textBody
        }
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
      logger.error(`[MetaClient] Send text message failed to ${recipientPhone}`, error, { response: errData });
      throw new Error(errData?.error?.message || error.message);
    }
  }

  /**
   * Send WhatsApp Media Message (image, video, audio, document)
   */
  async sendMediaMessage({ recipientPhone, mediaType, mediaUrl, mediaId, caption, filename }) {
    if (this.isMock) {
      const mockMsgId = `wamid.mock_media_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
      logger.info(`[MetaClient:Mock] Sent ${mediaType} message to ${recipientPhone} -> ${mockMsgId}`);
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: recipientPhone, wa_id: recipientPhone.replace(/\D/g, '') }],
        messages: [{ id: mockMsgId, message_status: 'accepted' }]
      };
    }

    try {
      const mediaObject = {};
      if (mediaId) {
        mediaObject.id = mediaId;
      } else if (mediaUrl) {
        mediaObject.link = mediaUrl;
      }

      if (caption && ['image', 'video', 'document'].includes(mediaType)) {
        mediaObject.caption = caption;
      }
      if (filename && mediaType === 'document') {
        mediaObject.filename = filename;
      }

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone.replace(/\D/g, ''),
        type: mediaType,
        [mediaType]: mediaObject
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
      logger.error(`[MetaClient] Send media message failed to ${recipientPhone}`, error, { response: errData });
      throw new Error(errData?.error?.message || error.message);
    }
  }

  /**
   * Fetch temporary media URL for incoming media ID
   */
  async getMediaUrl(mediaId) {
    if (this.isMock) {
      return `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80`;
    }

    try {
      const response = await axios.get(`${META_BASE_URL}/${mediaId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      return response.data?.url || null;
    } catch (error) {
      logger.error(`[MetaClient] Failed to retrieve media URL for ${mediaId}`, error);
      return null;
    }
  }

  /**
   * Submit a new message template to Meta Cloud API
   * POST /{WABA_ID}/message_templates
   */
  async createTemplate({ name, category, language, components }) {
    if (this.isMock) {
      const mockId = `meta_tpl_${Date.now().toString(36)}`;
      logger.info(`[MetaClient:Mock] Created template "${name}" -> ${mockId}`);
      return {
        id: mockId,
        status: 'PENDING',
        category
      };
    }

    try {
      const payload = {
        name,
        category,
        language,
        components
      };

      const response = await axios.post(`${META_BASE_URL}/${this.wabaId}/message_templates`, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info(`[MetaClient] Template "${name}" submitted to Meta -> ID: ${response.data.id}, Status: ${response.data.status}`);
      return response.data;
    } catch (error) {
      const errData = error.response ? error.response.data : null;
      logger.error(`[MetaClient] Failed to create template "${name}" on Meta`, error, { response: errData });
      const metaErrMsg = errData?.error?.error_user_msg || errData?.error?.message || error.message;
      throw new Error(metaErrMsg);
    }
  }

  /**
   * Get single template status and details from Meta
   * GET /{TEMPLATE_ID}?fields=id,name,status,category,language,components,rejected_reason,quality_score
   * Get single template status and details from Meta (supports numeric ID or name search)
   * GET /{TEMPLATE_ID} or GET /{WABA_ID}/message_templates?name={name}
   */
  async getTemplateStatus(templateId, templateName = null) {
    if (this.isMock) {
      return {
        id: templateId,
        status: 'APPROVED',
        category: 'MARKETING'
      };
    }

    // 1. If ID is numeric, try direct lookup
    const isNumericId = /^\d+$/.test(String(templateId || ''));
    if (isNumericId) {
      try {
        const response = await axios.get(
          `${META_BASE_URL}/${templateId}?fields=id,name,status,category,language,components,rejected_reason,quality_score`,
          {
            headers: { Authorization: `Bearer ${this.accessToken}` }
          }
        );
        return response.data;
      } catch (error) {
        logger.warn(`[MetaClient] Direct lookup by ID "${templateId}" failed, trying WABA lookup by name...`);
      }
    }

    // 2. Fallback: Search WABA templates by name
    const searchName = templateName || (!isNumericId ? templateId : null);
    if (searchName) {
      try {
        const response = await axios.get(
          `${META_BASE_URL}/${this.wabaId}/message_templates?name=${encodeURIComponent(searchName)}`,
          {
            headers: { Authorization: `Bearer ${this.accessToken}` }
          }
        );
        const matched = response.data?.data?.[0];
        if (matched) {
          logger.info(`[MetaClient] Found template "${searchName}" on WABA -> ID: ${matched.id}, Status: ${matched.status}`);
          return matched;
        }
      } catch (err) {
        logger.warn(`[MetaClient] WABA template search by name "${searchName}" failed: ${err.message}`);
      }
    }

    throw new Error(`Template "${templateName || templateId}" was not found on Meta WhatsApp Business Account.`);
  }

  /**
   * Delete template from Meta WABA
   * DELETE /{WABA_ID}/message_templates?name={TEMPLATE_NAME}
   */
  async deleteTemplate(templateName, templateId) {
    if (this.isMock) {
      logger.info(`[MetaClient:Mock] Deleted template "${templateName}"`);
      return { success: true };
    }

    try {
      let url = `${META_BASE_URL}/${this.wabaId}/message_templates?name=${encodeURIComponent(templateName)}`;
      if (templateId) {
        url += `&h=${encodeURIComponent(templateId)}`;
      }
      const response = await axios.delete(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      return response.data;
    } catch (error) {
      const errData = error.response ? error.response.data : null;
      logger.error(`[MetaClient] Failed to delete template "${templateName}" from Meta`, error, { response: errData });
      throw new Error(errData?.error?.message || error.message);
    }
  }
}

export default {
  verifyMetaSignature,
  MetaCloudApiClient
};

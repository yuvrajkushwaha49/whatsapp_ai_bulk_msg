import * as whatsappService from './whatsapp.service.js';

export async function getConnectConfig(req, res, next) {
  try {
    const config = await whatsappService.getConnectConfig(req.businessId);
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
}

export async function completeEmbeddedSignup(req, res, next) {
  try {
    const result = await whatsappService.completeEmbeddedSignup(req.businessId, req.body);
    res.status(201).json({
      success: true,
      message: 'Meta WhatsApp account connected and verified successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function connect(req, res, next) {
  try {
    const result = await whatsappService.connectAccount(req.businessId, req.body);
    res.status(201).json({ success: true, message: 'WhatsApp account connected successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function listAccounts(req, res, next) {
  try {
    const result = await whatsappService.listAccounts(req.businessId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getAccount(req, res, next) {
  try {
    const result = await whatsappService.getAccount(req.businessId, req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'WhatsApp Account not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function verifyAccount(req, res, next) {
  try {
    const result = await whatsappService.verifyAccount(req.businessId, req.params.id);
    res.json({ success: true, message: 'Account status refreshed from Meta', data: result });
  } catch (error) {
    next(error);
  }
}

export async function disconnectAccount(req, res, next) {
  try {
    const result = await whatsappService.disconnectAccount(req.businessId, req.params.id);
    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

export async function setPrimaryAccount(req, res, next) {
  try {
    const result = await whatsappService.setPrimaryAccount(req.businessId, req.params.id);
    res.json({
      success: true,
      message: 'Account set as primary default sender successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function listTemplates(req, res, next) {
  try {
    const result = await whatsappService.listTemplates(req.businessId, req.query);
    res.json({
      success: true,
      data: result.templates,
      stats: result.stats,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

export async function getTemplate(req, res, next) {
  try {
    const result = await whatsappService.getTemplate(req.businessId, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function createTemplate(req, res, next) {
  try {
    const result = await whatsappService.createTemplate(req.businessId, req.user?.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Template submitted to Meta successfully for review',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function syncTemplates(req, res, next) {
  try {
    const accountId = req.params.accountId || req.query.accountId;
    const result = await whatsappService.syncTemplates(req.businessId, accountId);
    res.json({
      success: true,
      message: `Successfully synchronized ${result.syncedCount || 0} templates from Meta`,
      data: result.templates,
      stats: result.stats
    });
  } catch (error) {
    next(error);
  }
}

export async function checkTemplateStatus(req, res, next) {
  try {
    const result = await whatsappService.checkTemplateStatus(req.businessId, req.params.id);
    res.json({
      success: true,
      message: 'Live template status retrieved from Meta',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTemplate(req, res, next) {
  try {
    const result = await whatsappService.deleteTemplate(req.businessId, req.params.id);
    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

export async function sendTestMessage(req, res, next) {
  try {
    const result = await whatsappService.sendTestMessage(req.businessId, req.params.id, req.body);
    res.json({
      success: true,
      message: 'Test WhatsApp message sent successfully via Meta Cloud API!',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function testWebhookPing(req, res, next) {
  try {
    const result = await whatsappService.testWebhookPing(req.businessId);
    res.json({
      success: true,
      message: 'Webhook configuration active and ready to receive messages from Meta',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export default {
  connect,
  listAccounts,
  listTemplates,
  getTemplate,
  createTemplate,
  syncTemplates,
  checkTemplateStatus,
  deleteTemplate,
  sendTestMessage,
  testWebhookPing
};

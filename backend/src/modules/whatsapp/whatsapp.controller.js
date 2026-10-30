import * as whatsappService from './whatsapp.service.js';

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

export default {
  connect,
  listAccounts,
  listTemplates,
  getTemplate,
  createTemplate,
  syncTemplates,
  checkTemplateStatus,
  deleteTemplate
};

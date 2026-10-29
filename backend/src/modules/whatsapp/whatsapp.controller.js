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

export async function syncTemplates(req, res, next) {
  try {
    const result = await whatsappService.syncTemplates(req.businessId, req.params.accountId);
    res.json({ success: true, message: 'Templates synchronized successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function listTemplates(req, res, next) {
  try {
    const result = await whatsappService.listTemplates(req.businessId, req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export default {
  connect,
  listAccounts,
  syncTemplates,
  listTemplates
};

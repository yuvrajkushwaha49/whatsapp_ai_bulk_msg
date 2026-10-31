import * as metaSetupService from './metaSetup.service.js';
import * as whatsappService from './whatsapp.service.js';

export async function getStatus(req, res, next) {
  try {
    const data = await metaSetupService.getSetupStatus(req.businessId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function setMode(req, res, next) {
  try {
    const { mode, step } = req.body;
    const result = await metaSetupService.saveSetupMode(req.businessId, mode, step);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function validateSetup(req, res, next) {
  try {
    const result = await metaSetupService.validateSetup(req.businessId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function saveAdvancedConfig(req, res, next) {
  try {
    const result = await metaSetupService.saveAdvancedConfig(req.businessId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function initiateSignup(req, res, next) {
  try {
    const result = await metaSetupService.initiateSignup(req.businessId, req.body?.redirectOrigin || req.headers.origin);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function handleEmbeddedCallback(req, res, next) {
  try {
    const result = await whatsappService.completeEmbeddedSignup(req.businessId, req.body);
    res.status(201).json({
      success: true,
      message: 'WhatsApp account connected and verified successfully via Embedded Signup',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyAccount(req, res, next) {
  try {
    let accountId = req.body?.accountId || req.query?.accountId;
    if (!accountId) {
      const accounts = await whatsappService.listAccounts(req.businessId);
      const target = accounts.find(a => a.is_primary) || accounts[0];
      if (!target) {
        return res.status(404).json({ success: false, message: 'No WhatsApp account found to verify.' });
      }
      accountId = target.id;
    }
    const result = await whatsappService.verifyAccount(req.businessId, accountId);
    res.json({ success: true, message: 'Account status refreshed from Meta', data: result });
  } catch (error) {
    next(error);
  }
}

export async function listAccounts(req, res, next) {
  try {
    const accounts = await whatsappService.listAccounts(req.businessId);
    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
}

export async function reconnectAccount(req, res, next) {
  try {
    let accountId = req.body?.accountId || req.query?.accountId;
    if (!accountId) {
      const accounts = await whatsappService.listAccounts(req.businessId);
      const target = accounts.find(a => a.is_primary) || accounts[0];
      if (!target) {
        return res.status(404).json({ success: false, message: 'No WhatsApp account found to reconnect.' });
      }
      accountId = target.id;
    }
    const result = await whatsappService.verifyAccount(req.businessId, accountId);
    res.json({ success: true, message: 'Account reconnect requested and verified', data: result });
  } catch (error) {
    next(error);
  }
}

export async function disconnectAccount(req, res, next) {
  try {
    let accountId = req.body?.accountId || req.query?.accountId;
    if (!accountId) {
      const accounts = await whatsappService.listAccounts(req.businessId);
      const target = accounts.find(a => a.is_primary) || accounts[0];
      if (!target) {
        return res.status(404).json({ success: false, message: 'No WhatsApp account found to disconnect.' });
      }
      accountId = target.id;
    }
    const result = await whatsappService.disconnectAccount(req.businessId, accountId);
    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

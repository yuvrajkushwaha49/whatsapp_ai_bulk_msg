import * as campaignsService from './campaigns.service.js';

export async function list(req, res, next) {
  try {
    const result = await campaignsService.listCampaigns(req.businessId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function details(req, res, next) {
  try {
    const result = await campaignsService.getCampaignDetails(req.businessId, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function preview(req, res, next) {
  try {
    const result = await campaignsService.previewAudience(req.businessId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function preflight(req, res, next) {
  try {
    const result = await campaignsService.preflightCheck(req.businessId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const result = await campaignsService.createCampaign(req.businessId, req.body);
    res.status(201).json({ success: true, message: 'Campaign created successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function start(req, res, next) {
  try {
    const result = await campaignsService.startCampaign(req.businessId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function pause(req, res, next) {
  try {
    const result = await campaignsService.pauseCampaign(req.businessId, req.params.id);
    res.json({ success: true, message: 'Campaign paused', data: result });
  } catch (error) {
    next(error);
  }
}

export async function cancel(req, res, next) {
  try {
    const result = await campaignsService.cancelCampaign(req.businessId, req.params.id);
    res.json({ success: true, message: 'Campaign cancelled', data: result });
  } catch (error) {
    next(error);
  }
}

export default {
  list,
  details,
  preview,
  preflight,
  create,
  start,
  pause,
  cancel
};

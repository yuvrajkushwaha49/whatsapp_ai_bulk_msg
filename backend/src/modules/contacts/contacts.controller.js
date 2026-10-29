import * as contactsService from './contacts.service.js';

export async function list(req, res, next) {
  try {
    const result = await contactsService.listContacts(req.businessId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const result = await contactsService.createContact(req.businessId, req.body);
    res.status(201).json({ success: true, message: 'Contact created successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateConsent(req, res, next) {
  try {
    const result = await contactsService.updateConsent(req.businessId, req.params.id, req.body);
    res.json({ success: true, message: 'Consent updated successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await contactsService.deleteContact(req.businessId, req.params.id);
    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function tags(req, res, next) {
  try {
    const result = await contactsService.listTags(req.businessId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export default {
  list,
  create,
  updateConsent,
  remove,
  tags
};

import * as contactGroupsService from './contactGroups.service.js';

export async function list(req, res, next) {
  try {
    const data = await contactGroupsService.listGroups(req.businessId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function details(req, res, next) {
  try {
    const data = await contactGroupsService.getGroup(req.businessId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = await contactGroupsService.createGroup(req.businessId, req.body);
    res.status(201).json({ success: true, message: 'Group created successfully', data });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = await contactGroupsService.updateGroup(req.businessId, req.params.id, req.body);
    res.json({ success: true, message: 'Group updated successfully', data });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await contactGroupsService.deleteGroup(req.businessId, req.params.id);
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function addMembers(req, res, next) {
  try {
    const data = await contactGroupsService.addMembers(req.businessId, req.params.id, req.body);
    res.json({ success: true, message: 'Members added successfully', data });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req, res, next) {
  try {
    const data = await contactGroupsService.removeMember(req.businessId, req.params.id, req.params.contactId);
    res.json({ success: true, message: 'Member removed successfully', data });
  } catch (error) {
    next(error);
  }
}

export default {
  list,
  details,
  create,
  update,
  remove,
  addMembers,
  removeMember
};


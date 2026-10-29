import * as authService from './auth.service.js';

export async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    // In JWT architecture, client discards token; if sessions table used, revoke here
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const result = await authService.getCurrentUser(req.user.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export default {
  register,
  login,
  logout,
  me
};

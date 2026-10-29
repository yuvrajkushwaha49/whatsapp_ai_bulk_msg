import { z } from 'zod';

export const registerSchema = {
  body: z.object({
    businessName: z.string().min(2, 'Business name must be at least 2 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Valid email address required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    timezone: z.string().optional().default('UTC')
  })
};

export const loginSchema = {
  body: z.object({
    email: z.string().email('Valid email address required'),
    password: z.string().min(1, 'Password is required')
  })
};

export const resetPasswordSchema = {
  body: z.object({
    email: z.string().email('Valid email address required')
  })
};

export default {
  registerSchema,
  loginSchema,
  resetPasswordSchema
};

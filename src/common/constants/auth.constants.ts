export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'User not found',
  USER_INACTIVE: 'User account is inactive',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  REFRESH_TOKEN_INVALID: 'Invalid refresh token',
  EMAIL_EXISTS: 'Email already exists',
  FORBIDDEN: 'Access denied',
} as const;

export const TOKEN_TYPE = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;

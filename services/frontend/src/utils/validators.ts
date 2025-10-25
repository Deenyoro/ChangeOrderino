/**
 * Validation utilities
 */

/**
 * Validate email address
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (10 digits)
 */
export const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10;
};

/**
 * Validate positive number
 */
export const isPositiveNumber = (value: number | string): boolean => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num > 0;
};

/**
 * Validate non-negative number
 */
export const isNonNegativeNumber = (value: number | string): boolean => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num >= 0;
};

/**
 * Validate required field
 */
export const isRequired = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return true;
  if (Array.isArray(value)) return value.length > 0;
  return !!value;
};

/**
 * Validate max length
 */
export const isMaxLength = (value: string, max: number): boolean => {
  return value.length <= max;
};

/**
 * Validate min length
 */
export const isMinLength = (value: string, min: number): boolean => {
  return value.length >= min;
};

/**
 * Validate project number format (alphanumeric, dashes, underscores)
 */
export const isValidProjectNumber = (projectNumber: string): boolean => {
  const regex = /^[a-zA-Z0-9_-]+$/;
  return regex.test(projectNumber);
};

/**
 * Validate percentage (0-100)
 */
export const isValidPercentage = (value: number | string): boolean => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num >= 0 && num <= 100;
};

/**
 * Validate date is not in the future
 */
export const isNotFutureDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date <= today;
};

/**
 * Validate date is in the future
 */
export const isFutureDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
};

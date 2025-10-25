/**
 * Formatting utilities for currency, dates, etc.
 */

import { format, parseISO } from 'date-fns';

/**
 * Format a number as currency (USD)
 */
export const formatCurrency = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Format a date string to a readable format
 */
export const formatDate = (dateString: string | Date, formatStr: string = 'MMM dd, yyyy'): string => {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, formatStr);
  } catch (error) {
    return 'Invalid date';
  }
};

/**
 * Format a date for input fields (YYYY-MM-DD)
 */
export const formatDateForInput = (dateString: string | Date): string => {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    return '';
  }
};

/**
 * Format a datetime string to a readable format
 */
export const formatDateTime = (dateString: string | Date): string => {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, 'MMM dd, yyyy h:mm a');
  } catch (error) {
    return 'Invalid date';
  }
};

/**
 * Format a number with thousands separator
 */
export const formatNumber = (num: number | string, decimals: number = 2): string => {
  const value = typeof num === 'string' ? parseFloat(num) : num;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

/**
 * Get initials from a full name
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

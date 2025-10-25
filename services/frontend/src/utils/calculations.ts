/**
 * Calculation utilities for OH&P, totals, etc.
 */

import { LaborItem, MaterialItem, EquipmentItem, SubcontractorItem } from '../types/lineItem';

/**
 * Calculate subtotal for a labor item
 */
export const calculateLaborSubtotal = (hours: number, ratePerHour: number): number => {
  return hours * ratePerHour;
};

/**
 * Calculate subtotal for material/equipment item
 */
export const calculateItemSubtotal = (quantity: number, unitPrice: number): number => {
  return quantity * unitPrice;
};

/**
 * Calculate total with OH&P
 */
export const calculateTotalWithOHP = (subtotal: number, ohpPercent: number): number => {
  return subtotal * (1 + ohpPercent / 100);
};

/**
 * Calculate labor items total
 */
export const calculateLaborTotal = (items: LaborItem[]): number => {
  return items.reduce((sum, item) => {
    const subtotal = item.subtotal || calculateLaborSubtotal(item.hours, item.rate_per_hour);
    return sum + subtotal;
  }, 0);
};

/**
 * Calculate material items total
 */
export const calculateMaterialTotal = (items: MaterialItem[]): number => {
  return items.reduce((sum, item) => {
    const subtotal = item.subtotal || calculateItemSubtotal(item.quantity, item.unit_price);
    return sum + subtotal;
  }, 0);
};

/**
 * Calculate equipment items total
 */
export const calculateEquipmentTotal = (items: EquipmentItem[]): number => {
  return items.reduce((sum, item) => {
    const subtotal = item.subtotal || calculateItemSubtotal(item.quantity, item.unit_price);
    return sum + subtotal;
  }, 0);
};

/**
 * Calculate subcontractor items total
 */
export const calculateSubcontractorTotal = (items: SubcontractorItem[]): number => {
  return items.reduce((sum, item) => sum + item.amount, 0);
};

/**
 * Calculate grand total proposal amount
 */
export const calculateProposalAmount = (
  laborSubtotal: number,
  laborOHP: number,
  materialSubtotal: number,
  materialOHP: number,
  equipmentSubtotal: number,
  equipmentOHP: number,
  subcontractorSubtotal: number,
  subcontractorOHP: number
): number => {
  const laborTotal = calculateTotalWithOHP(laborSubtotal, laborOHP);
  const materialTotal = calculateTotalWithOHP(materialSubtotal, materialOHP);
  const equipmentTotal = calculateTotalWithOHP(equipmentSubtotal, equipmentOHP);
  const subcontractorTotal = calculateTotalWithOHP(subcontractorSubtotal, subcontractorOHP);

  return laborTotal + materialTotal + equipmentTotal + subcontractorTotal;
};

/**
 * Round to 2 decimal places
 */
export const roundToTwoDecimals = (num: number): number => {
  return Math.round(num * 100) / 100;
};

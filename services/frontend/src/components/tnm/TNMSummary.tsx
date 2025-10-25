/**
 * TNM Summary - Shows all totals with OH&P calculations
 */

import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import {
  calculateLaborTotal,
  calculateMaterialTotal,
  calculateEquipmentTotal,
  calculateSubcontractorTotal,
} from '../../utils/calculations';
import { LaborItem, MaterialItem, EquipmentItem, SubcontractorItem } from '../../types/lineItem';

interface TNMSummaryProps {
  laborItems: LaborItem[];
  materialItems: MaterialItem[];
  equipmentItems: EquipmentItem[];
  subcontractorItems: SubcontractorItem[];
  laborOHP: number;
  materialOHP: number;
  equipmentOHP: number;
  subcontractorOHP: number;
  className?: string;
}

export const TNMSummary: React.FC<TNMSummaryProps> = ({
  laborItems,
  materialItems,
  equipmentItems,
  subcontractorItems,
  laborOHP,
  materialOHP,
  equipmentOHP,
  subcontractorOHP,
  className = '',
}) => {
  // Helper function to safely convert to number
  const toNumber = (val: any): number => {
    const num = Number(val);
    return Number.isFinite(num) ? num : 0;
  };

  // Ensure all OHP values are valid numbers
  const safeLaborOHP = toNumber(laborOHP);
  const safeMaterialOHP = toNumber(materialOHP);
  const safeEquipmentOHP = toNumber(equipmentOHP);
  const safeSubcontractorOHP = toNumber(subcontractorOHP);

  // Calculate subtotals - ensure they're valid numbers
  const laborSubtotal = toNumber(calculateLaborTotal(laborItems));
  const materialSubtotal = toNumber(calculateMaterialTotal(materialItems));
  const equipmentSubtotal = toNumber(calculateEquipmentTotal(equipmentItems));
  const subcontractorSubtotal = toNumber(calculateSubcontractorTotal(subcontractorItems));

  // Calculate OH&P amounts safely
  const laborOHPAmount = toNumber(laborSubtotal * (safeLaborOHP / 100));
  const materialOHPAmount = toNumber(materialSubtotal * (safeMaterialOHP / 100));
  const equipmentOHPAmount = toNumber(equipmentSubtotal * (safeEquipmentOHP / 100));
  const subcontractorOHPAmount = toNumber(subcontractorSubtotal * (safeSubcontractorOHP / 100));

  // Calculate totals
  const laborTotal = toNumber(laborSubtotal + laborOHPAmount);
  const materialTotal = toNumber(materialSubtotal + materialOHPAmount);
  const equipmentTotal = toNumber(equipmentSubtotal + equipmentOHPAmount);
  const subcontractorTotal = toNumber(subcontractorSubtotal + subcontractorOHPAmount);

  // Calculate grand total
  const proposalAmount = toNumber(laborTotal + materialTotal + equipmentTotal + subcontractorTotal);

  // Log for debugging
  console.log('TNMSummary Debug:', {
    inputs: { laborOHP, materialOHP, equipmentOHP, subcontractorOHP },
    safe: { safeLaborOHP, safeMaterialOHP, safeEquipmentOHP, safeSubcontractorOHP },
    subtotals: { laborSubtotal, materialSubtotal, equipmentSubtotal, subcontractorSubtotal },
    ohpAmounts: { laborOHPAmount, materialOHPAmount, equipmentOHPAmount, subcontractorOHPAmount },
    totals: { laborTotal, materialTotal, equipmentTotal, subcontractorTotal },
    proposalAmount
  });

  return (
    <div className={`card bg-gradient-to-br from-primary-50 to-blue-50 ${className}`}>
      <h3 className="text-lg font-bold text-gray-900 mb-4">Proposal Summary</h3>

      <div className="space-y-3">
        {/* Labor */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium text-gray-700">Labor</span>
            <span className="text-gray-900">{formatCurrency(laborSubtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600 pl-4">
            <span>OH&P ({safeLaborOHP.toFixed(2)}%)</span>
            <span>{formatCurrency(laborOHPAmount)}</span>
          </div>
          <div className="flex justify-between items-center font-semibold text-gray-900 mt-1 pt-1 border-t border-gray-200">
            <span>Labor Total</span>
            <span>{formatCurrency(laborTotal)}</span>
          </div>
        </div>

        {/* Materials */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium text-gray-700">Materials</span>
            <span className="text-gray-900">{formatCurrency(materialSubtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600 pl-4">
            <span>OH&P ({safeMaterialOHP.toFixed(2)}%)</span>
            <span>{formatCurrency(materialOHPAmount)}</span>
          </div>
          <div className="flex justify-between items-center font-semibold text-gray-900 mt-1 pt-1 border-t border-gray-200">
            <span>Material Total</span>
            <span>{formatCurrency(materialTotal)}</span>
          </div>
        </div>

        {/* Equipment */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium text-gray-700">Equipment</span>
            <span className="text-gray-900">{formatCurrency(equipmentSubtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600 pl-4">
            <span>OH&P ({safeEquipmentOHP.toFixed(2)}%)</span>
            <span>{formatCurrency(equipmentOHPAmount)}</span>
          </div>
          <div className="flex justify-between items-center font-semibold text-gray-900 mt-1 pt-1 border-t border-gray-200">
            <span>Equipment Total</span>
            <span>{formatCurrency(equipmentTotal)}</span>
          </div>
        </div>

        {/* Subcontractor */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium text-gray-700">Subcontractors</span>
            <span className="text-gray-900">{formatCurrency(subcontractorSubtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600 pl-4">
            <span>OH&P ({safeSubcontractorOHP.toFixed(2)}%)</span>
            <span>{formatCurrency(subcontractorOHPAmount)}</span>
          </div>
          <div className="flex justify-between items-center font-semibold text-gray-900 mt-1 pt-1 border-t border-gray-200">
            <span>Subcontractor Total</span>
            <span>{formatCurrency(subcontractorTotal)}</span>
          </div>
        </div>

        {/* Grand Total */}
        <div className="bg-primary-600 text-white rounded-lg p-4 shadow-md">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">Proposal Amount</span>
            <span className="text-2xl font-bold">{formatCurrency(proposalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Breakdown Note */}
      <p className="text-xs text-gray-600 mt-4 text-center">
        All amounts include overhead & profit (OH&P) as specified per cost category
      </p>
    </div>
  );
};

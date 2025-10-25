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
  calculateTotalWithOHP,
  calculateProposalAmount,
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
  // Calculate subtotals
  const laborSubtotal = calculateLaborTotal(laborItems);
  const materialSubtotal = calculateMaterialTotal(materialItems);
  const equipmentSubtotal = calculateEquipmentTotal(equipmentItems);
  const subcontractorSubtotal = calculateSubcontractorTotal(subcontractorItems);

  // Calculate totals with OH&P
  const laborTotal = calculateTotalWithOHP(laborSubtotal, laborOHP);
  const materialTotal = calculateTotalWithOHP(materialSubtotal, materialOHP);
  const equipmentTotal = calculateTotalWithOHP(equipmentSubtotal, equipmentOHP);
  const subcontractorTotal = calculateTotalWithOHP(subcontractorSubtotal, subcontractorOHP);

  // Calculate grand total
  const proposalAmount = calculateProposalAmount(
    laborSubtotal,
    laborOHP,
    materialSubtotal,
    materialOHP,
    equipmentSubtotal,
    equipmentOHP,
    subcontractorSubtotal,
    subcontractorOHP
  );

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
            <span>OH&P ({laborOHP}%)</span>
            <span>{formatCurrency(laborTotal - laborSubtotal)}</span>
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
            <span>OH&P ({materialOHP}%)</span>
            <span>{formatCurrency(materialTotal - materialSubtotal)}</span>
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
            <span>OH&P ({equipmentOHP}%)</span>
            <span>{formatCurrency(equipmentTotal - equipmentSubtotal)}</span>
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
            <span>OH&P ({subcontractorOHP}%)</span>
            <span>{formatCurrency(subcontractorTotal - subcontractorSubtotal)}</span>
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

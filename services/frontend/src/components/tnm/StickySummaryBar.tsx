/**
 * Sticky Summary Bar - Shows real-time TNM totals
 * Optimized for iPad with large touch targets
 * Features: Smooth animations, visual feedback, progress indicators
 */

import React, { useEffect, useState } from 'react';
import { Save, DollarSign, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';
import { formatCurrency } from '../../utils/formatters';

interface StickySummaryBarProps {
  laborSubtotal: number;
  laborOHP: number;
  laborTotal: number;

  materialSubtotal: number;
  materialOHP: number;
  materialTotal: number;

  equipmentSubtotal: number;
  equipmentOHP: number;
  equipmentTotal: number;

  subcontractorSubtotal: number;
  subcontractorOHP: number;
  subcontractorTotal: number;

  proposalAmount: number;

  onSaveDraft?: () => void;
  onSubmitForReview?: () => void;

  isSaving?: boolean;
}

export const StickySummaryBar: React.FC<StickySummaryBarProps> = ({
  laborSubtotal,
  laborOHP,
  laborTotal,
  materialSubtotal,
  materialOHP,
  materialTotal,
  equipmentSubtotal,
  equipmentOHP,
  equipmentTotal,
  subcontractorSubtotal,
  subcontractorOHP,
  subcontractorTotal,
  proposalAmount,
  onSaveDraft,
  onSubmitForReview,
  isSaving = false,
}) => {
  // Animation state for proposal amount changes
  const [isUpdating, setIsUpdating] = useState(false);
  const [prevAmount, setPrevAmount] = useState(proposalAmount);

  // Trigger pulse animation when proposal amount changes
  useEffect(() => {
    if (proposalAmount !== prevAmount && prevAmount > 0) {
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 600);
      setPrevAmount(proposalAmount);
      return () => clearTimeout(timer);
    }
    setPrevAmount(proposalAmount);
  }, [proposalAmount, prevAmount]);

  // Calculate completion percentage (for visual feedback)
  const hasContent = laborTotal > 0 || materialTotal > 0 || equipmentTotal > 0 || subcontractorTotal > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-white/95 border-t-2 border-blue-600 shadow-2xl z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Mobile: Compact view */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <div className="text-sm font-medium text-gray-700">Total Breakdown</div>
            </div>
            <div className={`text-2xl font-bold text-blue-600 transition-all duration-300 ${isUpdating ? 'scale-110 text-green-600' : ''}`}>
              {formatCurrency(proposalAmount)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Labor:</span>
              <span className="font-semibold">{formatCurrency(laborTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Material:</span>
              <span className="font-semibold">{formatCurrency(materialTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Equipment:</span>
              <span className="font-semibold">{formatCurrency(equipmentTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Subcontractor:</span>
              <span className="font-semibold">{formatCurrency(subcontractorTotal)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {onSaveDraft && (
              <Button
                type="button"
                variant="secondary"
                onClick={onSaveDraft}
                disabled={isSaving}
                className="flex-1 h-12"
              >
                <Save className="w-5 h-5 mr-2" />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            )}
            {onSubmitForReview && (
              <Button
                type="submit"
                onClick={onSubmitForReview}
                disabled={isSaving}
                className="flex-1 h-12"
              >
                Submit for Review
              </Button>
            )}
          </div>
        </div>

        {/* Desktop/iPad: Full view */}
        <div className="hidden lg:block">
          {/* Progress indicator (optional visual) */}
          {hasContent && (
            <div className="mb-3 flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Calculating totals...</span>
            </div>
          )}

          <div className="grid grid-cols-5 gap-6 mb-4">
            {/* Labor */}
            <div className="space-y-1 transition-all duration-300 hover:scale-105">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Labor</div>
              <div className="text-sm text-gray-700">
                {formatCurrency(laborSubtotal)}
                <TrendingUp className="inline-block w-3 h-3 ml-1 text-green-500" />
              </div>
              <div className="text-lg font-bold text-gray-900 transition-all duration-300">
                {formatCurrency(laborTotal)}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                +{laborOHP}% OH&P
              </div>
            </div>

            {/* Material */}
            <div className="space-y-1 transition-all duration-300 hover:scale-105">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Material</div>
              <div className="text-sm text-gray-700">
                {formatCurrency(materialSubtotal)}
                <TrendingUp className="inline-block w-3 h-3 ml-1 text-green-500" />
              </div>
              <div className="text-lg font-bold text-gray-900 transition-all duration-300">
                {formatCurrency(materialTotal)}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                +{materialOHP}% OH&P
              </div>
            </div>

            {/* Equipment */}
            <div className="space-y-1 transition-all duration-300 hover:scale-105">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Equipment</div>
              <div className="text-sm text-gray-700">
                {formatCurrency(equipmentSubtotal)}
                <TrendingUp className="inline-block w-3 h-3 ml-1 text-green-500" />
              </div>
              <div className="text-lg font-bold text-gray-900 transition-all duration-300">
                {formatCurrency(equipmentTotal)}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                +{equipmentOHP}% OH&P
              </div>
            </div>

            {/* Subcontractor */}
            <div className="space-y-1 transition-all duration-300 hover:scale-105">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Subcontractor</div>
              <div className="text-sm text-gray-700">
                {formatCurrency(subcontractorSubtotal)}
                <TrendingUp className="inline-block w-3 h-3 ml-1 text-green-500" />
              </div>
              <div className="text-lg font-bold text-gray-900 transition-all duration-300">
                {formatCurrency(subcontractorTotal)}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                +{subcontractorOHP}% OH&P
              </div>
            </div>

            {/* Proposal Amount */}
            <div className="space-y-1 border-l-4 border-blue-600 pl-6 bg-blue-50/50 -mx-3 px-6 py-2 rounded-r-lg">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                Proposal Amount
              </div>
              <div className={`text-4xl font-bold text-blue-600 mt-2 transition-all duration-500 ${isUpdating ? 'scale-110 text-green-600' : ''}`}>
                {formatCurrency(proposalAmount)}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                Total with OH&P applied
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            {onSaveDraft && (
              <Button
                type="button"
                variant="secondary"
                onClick={onSaveDraft}
                disabled={isSaving}
                className="h-12 px-6 transition-all duration-200 hover:shadow-lg"
              >
                <Save className={`w-5 h-5 mr-2 ${isSaving ? 'animate-pulse' : ''}`} />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            )}
            {onSubmitForReview && (
              <Button
                type="submit"
                onClick={onSubmitForReview}
                disabled={isSaving || !hasContent}
                className="h-12 px-8 transition-all duration-200 hover:shadow-lg hover:scale-105"
              >
                {isSaving ? 'Processing...' : 'Submit for Review →'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

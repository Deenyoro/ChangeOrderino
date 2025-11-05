/**
 * Labor Line Items Table with real-time calculations
 */

import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import { LaborItem, LaborType } from '../../types/lineItem';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { calculateLaborSubtotal } from '../../utils/calculations';

interface LaborItemTableProps {
  items: LaborItem[];
  onChange: (items: LaborItem[]) => void;
  readonly?: boolean;
  hidePrices?: boolean;
}

// Labor rates mapping (matches backend rates)
const LABOR_RATES: Record<LaborType, number> = {
  [LaborType.PROJECT_MANAGER]: 91,
  [LaborType.SUPERINTENDENT]: 82,
  [LaborType.CARPENTER]: 75,
  [LaborType.LABORER]: 57,
};

const LABOR_TYPE_OPTIONS = [
  { value: LaborType.PROJECT_MANAGER, label: 'Project Manager ($91/hr)' },
  { value: LaborType.SUPERINTENDENT, label: 'Superintendent ($82/hr)' },
  { value: LaborType.CARPENTER, label: 'Carpenter ($75/hr)' },
  { value: LaborType.LABORER, label: 'Laborer ($57/hr)' },
];

const LABOR_TYPE_OPTIONS_NO_PRICE = [
  { value: LaborType.PROJECT_MANAGER, label: 'Project Manager' },
  { value: LaborType.SUPERINTENDENT, label: 'Superintendent' },
  { value: LaborType.CARPENTER, label: 'Carpenter' },
  { value: LaborType.LABORER, label: 'Laborer' },
];

export const LaborItemTable: React.FC<LaborItemTableProps> = ({
  items,
  onChange,
  readonly = false,
  hidePrices = false,
}) => {
  const addItem = () => {
    const newItem: LaborItem = {
      description: '',
      hours: 0,
      labor_type: LaborType.LABORER,
      rate_per_hour: LABOR_RATES[LaborType.LABORER],
      line_order: items.length,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (index: number, updates: Partial<LaborItem>) => {
    const updated = [...items];

    // If labor type changed, update the rate
    if (updates.labor_type && updates.labor_type !== updated[index].labor_type) {
      updates.rate_per_hour = LABOR_RATES[updates.labor_type];
    }

    updated[index] = { ...updated[index], ...updates };

    // Recalculate subtotal
    if (updates.hours !== undefined || updates.rate_per_hour !== undefined) {
      updated[index].subtotal = calculateLaborSubtotal(
        updated[index].hours,
        updated[index].rate_per_hour
      );
    }

    onChange(updated);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const total = items.reduce((sum, item) => {
    return sum + (item.subtotal || calculateLaborSubtotal(item.hours, item.rate_per_hour));
  }, 0);

  const totalHours = items.reduce((sum, item) => sum + (item.hours || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Labor</h3>
        {!readonly && (
          <Button type="button" size="sm" onClick={addItem}>
            <Plus className="w-4 h-4 mr-1" />
            Add Labor Item
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">No labor items yet</p>
          {!readonly && (
            <Button type="button" variant="secondary" size="sm" onClick={addItem} className="mt-2">
              <Plus className="w-4 h-4 mr-1" />
              Add First Item
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-2/5">
                    Description
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">
                    Hours
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">
                    Type
                  </th>
                  {!hidePrices && (
                    <>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">
                        Rate
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">
                        Subtotal
                      </th>
                    </>
                  )}
                  {!readonly && (
                    <th className="px-3 py-3 w-12"></th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {readonly ? (
                        <div className="text-sm text-gray-900">{item.description}</div>
                      ) : (
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                          placeholder="Labor description"
                          className="min-h-[44px]"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {readonly ? (
                        <div className="text-sm text-gray-900">{formatNumber(item.hours)}</div>
                      ) : (
                        <Input
                          type="number"
                          step="0.25"
                          min="0"
                          value={item.hours || ''}
                          onChange={(e) => updateItem(index, { hours: parseFloat(e.target.value) || 0 })}
                          className="min-h-[44px]"
                          autoComplete="off"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {readonly ? (
                        <div className="text-sm text-gray-900">
                          {(hidePrices ? LABOR_TYPE_OPTIONS_NO_PRICE : LABOR_TYPE_OPTIONS).find(o => o.value === item.labor_type)?.label}
                        </div>
                      ) : (
                        <Select
                          value={item.labor_type}
                          onChange={(e) => updateItem(index, { labor_type: e.target.value as LaborType })}
                          options={hidePrices ? LABOR_TYPE_OPTIONS_NO_PRICE : LABOR_TYPE_OPTIONS}
                          className="min-h-[44px]"
                        />
                      )}
                    </td>
                    {!hidePrices && (
                      <>
                        <td className="px-3 py-2">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(item.rate_per_hour)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {formatCurrency(item.subtotal || calculateLaborSubtotal(item.hours, item.rate_per_hour))}
                          </div>
                        </td>
                      </>
                    )}
                    {!readonly && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={hidePrices ? 2 : 4} className="px-3 py-3 text-right font-semibold text-gray-900">
                    {hidePrices ? 'Total Hours:' : 'Labor Subtotal:'}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900">
                    {hidePrices ? `${formatNumber(totalHours)} hrs` : formatCurrency(total)}
                  </td>
                  {!hidePrices && <td></td>}
                  {!readonly && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

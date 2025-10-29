/**
 * Subcontractor Line Items Table
 */

import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import { SubcontractorItem } from '../../types/lineItem';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { formatCurrency } from '../../utils/formatters';
import { calculateSubcontractorTotal } from '../../utils/calculations';

interface SubcontractorItemTableProps {
  items: SubcontractorItem[];
  onChange: (items: SubcontractorItem[]) => void;
  readonly?: boolean;
  hidePrices?: boolean;
}

export const SubcontractorItemTable: React.FC<SubcontractorItemTableProps> = ({
  items,
  onChange,
  readonly = false,
  hidePrices = false,
}) => {
  const addItem = () => {
    const newItem: SubcontractorItem = {
      description: '',
      subcontractor_name: '',
      amount: 0,
      line_order: items.length,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (index: number, updates: Partial<SubcontractorItem>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const total = calculateSubcontractorTotal(items);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Subcontractors</h3>
        {!readonly && (
          <Button type="button" size="sm" onClick={addItem}>
            <Plus className="w-4 h-4 mr-1" />
            Add Subcontractor
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">No subcontractors yet</p>
          {!readonly && (
            <Button type="button" variant="secondary" size="sm" onClick={addItem} className="mt-2">
              <Plus className="w-4 h-4 mr-1" />
              Add First Item
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/3">
                  Name/Company
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/3">
                  Description
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">
                  Proposal Date
                </th>
                {!hidePrices && (
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">
                    Amount
                  </th>
                )}
                {!readonly && <th className="px-3 py-3 w-12"></th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    {readonly ? (
                      <div className="text-sm text-gray-900">{item.subcontractor_name}</div>
                    ) : (
                      <Input
                        value={item.subcontractor_name || ''}
                        onChange={(e) => updateItem(index, { subcontractor_name: e.target.value })}
                        placeholder="Subcontractor name"
                        className="min-h-[44px]"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {readonly ? (
                      <div className="text-sm text-gray-900">{item.description}</div>
                    ) : (
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, { description: e.target.value })}
                        placeholder="Work description"
                        className="min-h-[44px]"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {readonly ? (
                      <div className="text-sm text-gray-900">{item.proposal_date || '-'}</div>
                    ) : (
                      <Input
                        type="date"
                        value={item.proposal_date || ''}
                        onChange={(e) => updateItem(index, { proposal_date: e.target.value })}
                        className="min-h-[44px]"
                      />
                    )}
                  </td>
                  {!hidePrices && (
                    <td className="px-3 py-2">
                      {readonly ? (
                        <div className="text-sm font-semibold text-gray-900 text-right">
                          {formatCurrency(item.amount)}
                        </div>
                      ) : (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.amount}
                          onChange={(e) => updateItem(index, { amount: parseFloat(e.target.value) || 0 })}
                          className="min-h-[44px]"
                        />
                      )}
                    </td>
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
            {!hidePrices && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-right font-semibold text-gray-900">
                    Subcontractor Subtotal:
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900">
                    {formatCurrency(total)}
                  </td>
                  {!readonly && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
};

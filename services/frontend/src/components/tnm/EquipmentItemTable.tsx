/**
 * Equipment Line Items Table with real-time calculations
 */

import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import { EquipmentItem } from '../../types/lineItem';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { calculateItemSubtotal } from '../../utils/calculations';

interface EquipmentItemTableProps {
  items: EquipmentItem[];
  onChange: (items: EquipmentItem[]) => void;
  readonly?: boolean;
  hidePrices?: boolean;
}

export const EquipmentItemTable: React.FC<EquipmentItemTableProps> = ({
  items,
  onChange,
  readonly = false,
  hidePrices = false,
}) => {
  const addItem = () => {
    const newItem: EquipmentItem = {
      description: '',
      quantity: 0,
      unit: '',
      unit_price: 0,
      line_order: items.length,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (index: number, updates: Partial<EquipmentItem>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...updates };

    // Recalculate subtotal
    if (updates.quantity !== undefined || updates.unit_price !== undefined) {
      updated[index].subtotal = calculateItemSubtotal(
        updated[index].quantity,
        updated[index].unit_price
      );
    }

    onChange(updated);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const total = items.reduce((sum, item) => {
    return sum + (item.subtotal || calculateItemSubtotal(item.quantity, item.unit_price));
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Equipment</h3>
        {!readonly && (
          <Button type="button" size="sm" onClick={addItem}>
            <Plus className="w-4 h-4 mr-1" />
            Add Equipment
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">No equipment yet</p>
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
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-2/5">
                  Description
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">
                  Qty/Hours
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">
                  Unit
                </th>
                {!hidePrices && (
                  <>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">
                      Unit Price
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">
                      Subtotal
                    </th>
                  </>
                )}
                {!readonly && <th className="px-3 py-3 w-12"></th>}
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
                        placeholder="Equipment description"
                        className="min-h-[44px]"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {readonly ? (
                      <div className="text-sm text-gray-900">{formatNumber(item.quantity)}</div>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                        className="min-h-[44px]"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {readonly ? (
                      <div className="text-sm text-gray-900">{item.unit}</div>
                    ) : (
                      <Input
                        value={item.unit || ''}
                        onChange={(e) => updateItem(index, { unit: e.target.value })}
                        placeholder="day, hour"
                        className="min-h-[44px]"
                      />
                    )}
                  </td>
                  {!hidePrices && (
                    <>
                      <td className="px-3 py-2">
                        {readonly ? (
                          <div className="text-sm text-gray-900">{formatCurrency(item.unit_price)}</div>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, { unit_price: parseFloat(e.target.value) || 0 })}
                            className="min-h-[44px]"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(item.subtotal || calculateItemSubtotal(item.quantity, item.unit_price))}
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
            {!hidePrices && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-right font-semibold text-gray-900">
                    Equipment Subtotal:
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

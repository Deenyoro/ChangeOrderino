/**
 * Settings Page - Global application settings (Admin only)
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchGlobalSettings, updateGlobalSetting, clearError } from '../store/slices/settingsSlice';
import { AppSetting } from '../types/settings';

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { globalSettings, loading, error, lastUpdated } = useSelector(
    (state: RootState) => state.settings
  );

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchGlobalSettings());
  }, [dispatch]);

  const handleEdit = (setting: AppSetting) => {
    setEditingKey(setting.key);
    setEditValue(setting.value);
    setSaveMessage(null);
  };

  const handleSave = async (key: string) => {
    try {
      await dispatch(updateGlobalSetting({ key, value: editValue })).unwrap();
      setEditingKey(null);
      setSaveMessage(`✓ ${key} updated successfully`);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const getSettingsByCategory = (category: string) => {
    return globalSettings.filter(s => s.category === category);
  };

  const renderSettingRow = (setting: AppSetting) => {
    const isEditing = editingKey === setting.key;
    const isPassword = setting.key.includes('PASSWORD');

    // Don't allow editing passwords through UI
    if (isPassword) {
      return (
        <tr key={setting.key} className="border-b">
          <td className="py-3 px-4 font-medium text-gray-700">{setting.description || setting.key}</td>
          <td className="py-3 px-4">
            <span className="text-gray-500 italic">Set in .env only (security)</span>
          </td>
          <td className="py-3 px-4"></td>
        </tr>
      );
    }

    return (
      <tr key={setting.key} className="border-b hover:bg-gray-50">
        <td className="py-3 px-4 font-medium text-gray-700">
          {setting.description || setting.key}
          <div className="text-xs text-gray-500 mt-1">{setting.key}</div>
        </td>
        <td className="py-3 px-4">
          {isEditing ? (
            <input
              type={setting.data_type === 'boolean' ? 'checkbox' : 'text'}
              value={editValue}
              checked={setting.data_type === 'boolean' ? editValue.toLowerCase() === 'true' : undefined}
              onChange={(e) =>
                setEditValue(
                  setting.data_type === 'boolean'
                    ? e.target.checked.toString()
                    : e.target.value
                )
              }
              className="border rounded px-3 py-2 w-full max-w-md"
              autoFocus
            />
          ) : (
            <span className="text-gray-900">
              {setting.data_type === 'boolean'
                ? setting.value.toLowerCase() === 'true'
                  ? '✓ Enabled'
                  : '✗ Disabled'
                : setting.value}
            </span>
          )}
        </td>
        <td className="py-3 px-4 text-right">
          {isEditing ? (
            <div className="space-x-2">
              <button
                onClick={() => handleSave(setting.key)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleEdit(setting)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Edit
            </button>
          )}
        </td>
      </tr>
    );
  };

  const renderCategory = (title: string, category: string, description: string) => {
    const settings = getSettingsByCategory(category);
    if (settings.length === 0) return null;

    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600 mb-4">{description}</p>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Setting</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Value</th>
                <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>{settings.map(renderSettingRow)}</tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading && globalSettings.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Application Settings</h1>
        <p className="text-gray-600">
          Configure global application settings. Database is the source of truth.
        </p>
        {lastUpdated && (
          <p className="text-sm text-gray-500 mt-2">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </p>
        )}
      </div>

      {/* Success message */}
      {saveMessage && (
        <div className="mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {saveMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
          <button
            onClick={() => dispatch(clearError())}
            className="ml-4 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Settings Categories */}
      {renderCategory(
        'Company Information',
        'company',
        'Basic company details displayed in emails and documents.'
      )}

      {renderCategory(
        'Email Configuration (SMTP)',
        'smtp',
        'Email server settings for sending change order notifications. Password must be set in .env file.'
      )}

      {renderCategory(
        'Labor Rates',
        'rates',
        'Default hourly rates for labor types. Can be overridden per project or change order.'
      )}

      {renderCategory(
        'OH&P Percentages',
        'ohp',
        'Default Overhead & Profit percentages for cost categories. Can be overridden per project or change order.'
      )}

      {renderCategory(
        'Reminder Settings',
        'reminders',
        'Configure email reminder behavior for pending approvals.'
      )}

      {renderCategory(
        'Approval Settings',
        'approval',
        'Configure approval link expiration time.'
      )}

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Settings Hierarchy</h3>
        <p className="text-blue-800 mb-4">
          Many settings support hierarchical overrides:
        </p>
        <div className="bg-white rounded p-4 space-y-2 text-sm">
          <div className="flex items-center space-x-3">
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">Global</span>
            <span className="text-gray-600">→</span>
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">Project</span>
            <span className="text-gray-600">→</span>
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">Change Order</span>
          </div>
          <p className="text-gray-700 mt-3">
            <strong>Example:</strong> Set carpenter rate to $75/hr globally. Override to $85/hr for a union
            project. Override to $95/hr for overtime work on a specific change order.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

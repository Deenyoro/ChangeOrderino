/**
 * Settings Page - Global application settings (Admin only)
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { fetchGlobalSettings, updateGlobalSetting, clearError } from '../store/slices/settingsSlice';
import { AppSetting } from '../types/settings';
import { Upload, Activity } from 'lucide-react';
import { apiClient } from '../api/client';

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { globalSettings, loading, error, lastUpdated } = useSelector(
    (state: RootState) => state.settings
  );

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    dispatch(fetchGlobalSettings());
  }, [dispatch]);

  const currentLogoUrl = globalSettings.find(s => s.key === 'COMPANY_LOGO_URL')?.value;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(png|svg\+xml)$/)) {
      alert('Only PNG and SVG files are allowed');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setLogoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', logoFile);

      await apiClient.post('/v1/settings/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSaveMessage('✓ Logo uploaded successfully');
      setTimeout(() => setSaveMessage(null), 3000);

      // Refresh settings to get the new logo URL
      dispatch(fetchGlobalSettings());

      // Clear the preview and file
      setLogoFile(null);
      setLogoPreview(null);
    } catch (err: any) {
      console.error('Failed to upload logo:', err);
      alert(err.response?.data?.detail || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

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
    const isEmailTemplate = setting.category === 'email_templates';
    const isPDFFooterText = setting.key === 'PDF_FOOTER_TEXT';

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
            (isEmailTemplate || isPDFFooterText) ? (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="border rounded px-3 py-2 w-full max-w-2xl font-mono text-sm"
                rows={3}
                autoFocus
              />
            ) : (
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
            )
          ) : (
            <span className={`text-gray-900 ${(isEmailTemplate || isPDFFooterText) ? 'font-mono text-sm' : ''}`}>
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
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Application Settings</h1>
          <button
            onClick={() => navigate('/system-info')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Activity className="w-5 h-5" />
            System Information
          </button>
        </div>
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

      {/* Logo Upload Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Company Logo</h2>
        <p className="text-gray-600 mb-4">Upload your company logo (PNG or SVG). This will be displayed in emails and documents.</p>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-start space-x-6">
            {/* Current Logo Display */}
            <div className="flex-shrink-0">
              <div className="w-48 h-48 border-2 border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                {currentLogoUrl && !logoPreview ? (
                  <img src={currentLogoUrl} alt="Company Logo" className="max-w-full max-h-full object-contain p-2" />
                ) : logoPreview ? (
                  <img src={logoPreview} alt="Logo Preview" className="max-w-full max-h-full object-contain p-2" />
                ) : (
                  <div className="text-center text-gray-400">
                    <Upload className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-sm">No logo uploaded</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Controls */}
            <div className="flex-1">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Logo File
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/svg+xml"
                    onChange={handleLogoChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Accepted formats: PNG, SVG • Max size: 10MB
                  </p>
                </div>

                {logoFile && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </button>
                    <button
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(null);
                      }}
                      disabled={uploadingLogo}
                      className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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

      {renderCategory(
        'Email Templates',
        'email_templates',
        'Customize the content of automated emails. Use variables like {tnm_number}, {project_name}, {company_email}, {company_phone}, {reminder_number}, {status}.'
      )}

      {renderCategory(
        'PDF Settings',
        'pdf',
        'Customize the appearance of generated PDF documents. Use variables like {company_name}, {company_email}, {company_phone}.'
      )}

      {renderCategory(
        'TNM Ticket Settings',
        'tnm',
        'Configure TNM (Time & Material) ticket creation and approval workflow.'
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

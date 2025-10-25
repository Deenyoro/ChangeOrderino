/**
 * Settings API endpoints
 */

import apiClient from './client';
import { AppSetting, SettingUpdate, EffectiveSettings, SettingCategory } from '../types/settings';

export const settingsApi = {
  // Get all global settings (admin)
  getAll: async (category?: SettingCategory) => {
    const params = category && category !== 'all' ? { category } : {};
    const response = await apiClient.get<AppSetting[]>('v1/settings', { params });
    return response.data;
  },

  // Update global setting (admin)
  update: async (key: string, data: SettingUpdate) => {
    const response = await apiClient.put<AppSetting>(`v1/settings/${key}`, data);
    return response.data;
  },

  // Get effective settings for a context
  getEffective: async (params?: { project_id?: string; tnm_ticket_id?: string }) => {
    const response = await apiClient.get<EffectiveSettings>('v1/settings/effective', { params });
    return response.data;
  },
};

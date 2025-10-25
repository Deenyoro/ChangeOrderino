/**
 * Settings Redux slice
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AppSetting, EffectiveSettings, SettingCategory } from '../../types/settings';
import { settingsApi } from '../../api/settings';

interface SettingsState {
  globalSettings: AppSetting[];
  effectiveSettings: EffectiveSettings | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: SettingsState = {
  globalSettings: [],
  effectiveSettings: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

// Async thunks
export const fetchGlobalSettings = createAsyncThunk(
  'settings/fetchGlobal',
  async (category?: SettingCategory) => {
    return await settingsApi.getAll(category);
  }
);

export const updateGlobalSetting = createAsyncThunk(
  'settings/updateGlobal',
  async ({ key, value }: { key: string; value: string }) => {
    return await settingsApi.update(key, { value });
  }
);

export const fetchEffectiveSettings = createAsyncThunk(
  'settings/fetchEffective',
  async (params?: { project_id?: string; tnm_ticket_id?: string }) => {
    return await settingsApi.getEffective(params);
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch global settings
    builder.addCase(fetchGlobalSettings.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchGlobalSettings.fulfilled, (state, action: PayloadAction<AppSetting[]>) => {
      state.loading = false;
      state.globalSettings = action.payload;
      state.lastUpdated = new Date().toISOString();
    });
    builder.addCase(fetchGlobalSettings.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch settings';
    });

    // Update global setting
    builder.addCase(updateGlobalSetting.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(updateGlobalSetting.fulfilled, (state, action: PayloadAction<AppSetting>) => {
      state.loading = false;
      // Update the setting in the array
      const index = state.globalSettings.findIndex(s => s.key === action.payload.key);
      if (index !== -1) {
        state.globalSettings[index] = action.payload;
      }
      state.lastUpdated = new Date().toISOString();
    });
    builder.addCase(updateGlobalSetting.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to update setting';
    });

    // Fetch effective settings
    builder.addCase(fetchEffectiveSettings.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchEffectiveSettings.fulfilled, (state, action: PayloadAction<EffectiveSettings>) => {
      state.loading = false;
      state.effectiveSettings = action.payload;
    });
    builder.addCase(fetchEffectiveSettings.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch effective settings';
    });
  },
});

export const { clearError } = settingsSlice.actions;
export default settingsSlice.reducer;

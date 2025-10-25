/**
 * Settings types
 */

// Individual setting
export interface AppSetting {
  id: number;
  key: string;
  value: string;
  category: string;
  description: string | null;
  data_type: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface SettingUpdate {
  value: string;
}

// Grouped settings
export interface CompanySettings {
  name: string;
  email: string;
  phone: string;
  timezone: string;
}

export interface SMTPSettings {
  enabled: boolean;
  host: string;
  port: number;
  use_tls: boolean;
  username: string;
  from_email: string;
  from_name: string;
}

export interface LaborRates {
  project_manager: number;
  superintendent: number;
  carpenter: number;
  laborer: number;
}

export interface OHPPercentages {
  material: number;
  labor: number;
  equipment: number;
  subcontractor: number;
}

export interface ReminderSettings {
  enabled: boolean;
  interval_days: number;
  max_retries: number;
}

export interface ApprovalSettings {
  token_expiration_hours: number;
}

export interface EffectiveSettings {
  company: CompanySettings;
  smtp: SMTPSettings;
  rates: LaborRates;
  ohp: OHPPercentages;
  reminders: ReminderSettings;
  approval: ApprovalSettings;
}

// Settings overrides (for project/ticket level)
export interface SettingsOverrides {
  material_ohp_percent?: number | null;
  labor_ohp_percent?: number | null;
  equipment_ohp_percent?: number | null;
  subcontractor_ohp_percent?: number | null;
  rate_project_manager?: number | null;
  rate_superintendent?: number | null;
  rate_carpenter?: number | null;
  rate_laborer?: number | null;
}

export interface ProjectSettingsOverrides extends SettingsOverrides {
  reminder_interval_days?: number | null;
  reminder_max_retries?: number | null;
  approval_token_expiration_hours?: number | null;
}

// Category type for filtering
export type SettingCategory = 'company' | 'smtp' | 'rates' | 'ohp' | 'reminders' | 'approval' | 'all';

/**
 * Project/Job types
 */

export interface Project {
  id: string;
  name: string;
  project_number: string;
  customer_company?: string;
  gc_company?: string;
  gc_email?: string;
  gc_contact_name?: string;
  gc_phone?: string;
  project_manager_id?: string;
  project_manager_name?: string;
  material_ohp_percent: number;
  labor_ohp_percent: number;
  equipment_ohp_percent: number;
  subcontractor_ohp_percent: number;
  rate_project_manager: number;
  rate_superintendent: number;
  rate_carpenter: number;
  rate_laborer: number;
  reminder_interval_days: number;
  reminder_max_retries: number;
  is_active: boolean;
  notes?: string;
  extra_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProjectFormData {
  name: string;
  project_number: string;
  customer_company?: string;
  gc_company?: string;
  gc_email?: string;
  gc_contact_name?: string;
  gc_phone?: string;
  project_manager_id?: string;
  project_manager_name?: string;
  material_ohp_percent?: number;
  labor_ohp_percent?: number;
  equipment_ohp_percent?: number;
  subcontractor_ohp_percent?: number;
  rate_project_manager?: number;
  rate_superintendent?: number;
  rate_carpenter?: number;
  rate_laborer?: number;
  reminder_interval_days?: number;
  reminder_max_retries?: number;
  is_active?: boolean;
  notes?: string;
}

export interface ProjectListFilter {
  is_active?: boolean;
  search?: string;
  project_manager_id?: string;
}

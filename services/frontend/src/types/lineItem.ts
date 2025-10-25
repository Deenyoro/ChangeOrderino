/**
 * Line item types for TNM tickets
 */

export enum LaborType {
  PROJECT_MANAGER = 'project_manager',
  SUPERINTENDENT = 'superintendent',
  CARPENTER = 'carpenter',
  LABORER = 'laborer',
}

export interface LaborItem {
  id?: string;
  tnm_ticket_id?: string;
  description: string;
  hours: number;
  labor_type: LaborType;
  rate_per_hour: number;
  subtotal?: number;
  line_order?: number;
  created_at?: string;
}

export interface MaterialItem {
  id?: string;
  tnm_ticket_id?: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  subtotal?: number;
  line_order?: number;
  created_at?: string;
}

export interface EquipmentItem {
  id?: string;
  tnm_ticket_id?: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  subtotal?: number;
  line_order?: number;
  created_at?: string;
}

export interface SubcontractorItem {
  id?: string;
  tnm_ticket_id?: string;
  description: string;
  subcontractor_name?: string;
  proposal_date?: string;
  amount: number;
  line_order?: number;
  created_at?: string;
}

export type LineItem = LaborItem | MaterialItem | EquipmentItem | SubcontractorItem;

export type LineItemType = 'labor' | 'material' | 'equipment' | 'subcontractor';

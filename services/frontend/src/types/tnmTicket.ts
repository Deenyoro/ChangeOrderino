/**
 * TNM Ticket (Change Order) types
 */

import { LaborItem, MaterialItem, EquipmentItem, SubcontractorItem } from './lineItem';

export enum TNMStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  READY_TO_SEND = 'ready_to_send',
  SENT = 'sent',
  VIEWED = 'viewed',
  PARTIALLY_APPROVED = 'partially_approved',
  APPROVED = 'approved',
  DENIED = 'denied',
  CANCELLED = 'cancelled',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
}

export interface LineItemApproval {
  id: string;
  tnm_ticket_id: string;
  line_item_type: string;
  line_item_id: string;
  status: ApprovalStatus;
  approved_amount?: number;
  gc_comment?: string;
  approved_at?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TNMTicket {
  id: string;
  tnm_number: string;
  rfco_number?: string;
  project_id: string;
  project_number: string;
  title: string;
  description?: string;
  submitter_id?: string;
  submitter_name: string;
  submitter_email: string;
  proposal_date: string;
  response_date?: string;
  due_date?: string;
  status: TNMStatus;

  // Totals
  labor_subtotal: number;
  labor_ohp_percent: number;
  labor_total: number;

  material_subtotal: number;
  material_ohp_percent: number;
  material_total: number;

  equipment_subtotal: number;
  equipment_ohp_percent: number;
  equipment_total: number;

  subcontractor_subtotal: number;
  subcontractor_ohp_percent: number;
  subcontractor_total: number;

  // Labor rate overrides
  rate_project_manager?: number;
  rate_superintendent?: number;
  rate_carpenter?: number;
  rate_laborer?: number;

  proposal_amount: number;
  approved_amount: number;

  // Attachments
  signature_url?: string;
  photo_urls?: string[];

  // Email tracking
  email_sent_count: number;
  last_email_sent_at?: string;
  reminder_count: number;
  last_reminder_sent_at?: string;
  send_reminders_until_accepted: boolean;
  send_reminders_until_paid: boolean;

  // GC approval tracking
  approval_token?: string;
  approval_token_expires_at?: string;
  viewed_at?: string;

  // Payment tracking
  is_paid: number;
  paid_date?: string;
  paid_by?: string;

  notes?: string;
  metadata?: Record<string, any>;

  created_at: string;
  updated_at: string;

  // Relationships
  labor_items?: LaborItem[];
  material_items?: MaterialItem[];
  equipment_items?: EquipmentItem[];
  subcontractor_items?: SubcontractorItem[];
  approvals?: LineItemApproval[];
}

export interface TNMTicketFormData {
  project_id: string;
  title: string;
  description?: string;
  submitter_name: string;
  submitter_email: string;
  proposal_date: string;
  due_date?: string;
  send_reminders_until_accepted?: boolean;
  send_reminders_until_paid?: boolean;
  labor_items?: LaborItem[];
  material_items?: MaterialItem[];
  equipment_items?: EquipmentItem[];
  subcontractor_items?: SubcontractorItem[];
  signature_url?: string;
  photo_urls?: string[];
  notes?: string;
}

export interface TNMTicketListFilter {
  project_id?: string;
  status?: TNMStatus;
  search?: string;
  submitter_id?: string;
  from_date?: string;
  to_date?: string;
}

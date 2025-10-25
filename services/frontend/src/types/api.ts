/**
 * API response types
 */

export interface ApiError {
  detail: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  content_type: string;
}

export interface ApprovalPageData {
  tnm_ticket: any;
  project: any;
  is_expired: boolean;
  already_responded: boolean;
}

export interface ApprovalSubmission {
  line_item_approvals: Array<{
    line_item_type: string;
    line_item_id: string;
    status: string;
    approved_amount?: number;
    gc_comment?: string;
  }>;
  gc_comment?: string;
}

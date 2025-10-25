/**
 * Asset upload API endpoints
 */

import apiClient from './client';
import { UploadResponse } from '../types/api';

export const assetsApi = {
  // Upload signature
  uploadSignature: async (file: File, tnmTicketId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tnm_ticket_id', tnmTicketId);
    formData.append('asset_type', 'signature');

    const response = await apiClient.post<UploadResponse>('v1/assets/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Upload photo
  uploadPhoto: async (file: File, tnmTicketId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tnm_ticket_id', tnmTicketId);
    formData.append('asset_type', 'photo');

    const response = await apiClient.post<UploadResponse>('v1/assets/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete asset
  deleteAsset: async (assetId: string) => {
    await apiClient.delete(`v1/assets/${assetId}/`);
  },
};

/**
 * Project API endpoints
 */

import apiClient from './client';
import { Project, ProjectFormData } from '../types/project';

export const projectsApi = {
  // Get all projects
  getAll: async (params?: { is_active?: boolean; search?: string }) => {
    const response = await apiClient.get<Project[]>('v1/projects', { params });
    return response.data;
  },

  // Get single project
  getById: async (id: string) => {
    const response = await apiClient.get<Project>(`v1/projects/${id}`);
    return response.data;
  },

  // Get project by project number
  getByNumber: async (projectNumber: string) => {
    const response = await apiClient.get<Project>(`v1/projects/number/${projectNumber}`);
    return response.data;
  },

  // Create project
  create: async (data: ProjectFormData) => {
    const response = await apiClient.post<Project>('v1/projects', data);
    return response.data;
  },

  // Update project
  update: async (id: string, data: Partial<ProjectFormData>) => {
    const response = await apiClient.put<Project>(`v1/projects/${id}`, data);
    return response.data;
  },

  // Delete project
  delete: async (id: string) => {
    await apiClient.delete(`v1/projects/${id}`);
  },

  // Archive/unarchive project
  setActive: async (id: string, isActive: boolean) => {
    const response = await apiClient.patch<Project>(`v1/projects/${id}`, {
      is_active: isActive,
    });
    return response.data;
  },
};

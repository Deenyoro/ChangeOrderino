/**
 * Projects React Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import { ProjectFormData } from '../types/project';
import toast from 'react-hot-toast';

export const useProjects = (params?: { is_active?: boolean; search?: string }) => {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => projectsApi.getAll(params),
  });
};

export const useProject = (id: string) => {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id),
    enabled: !!id,
  });
};

export const useProjectByNumber = (projectNumber: string) => {
  return useQuery({
    queryKey: ['project', 'number', projectNumber],
    queryFn: () => projectsApi.getByNumber(projectNumber),
    enabled: !!projectNumber,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProjectFormData) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully');
    },
    onError: () => {
      toast.error('Failed to create project');
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProjectFormData> }) =>
      projectsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
      toast.success('Project updated successfully');
    },
    onError: () => {
      toast.error('Failed to update project');
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete project');
    },
  });
};

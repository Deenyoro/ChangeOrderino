/**
 * Project creation and edit form
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Project, ProjectFormData } from '../../types/project';
import { useCreateProject, useUpdateProject } from '../../hooks/useProjects';

interface ProjectFormProps {
  project?: Project;
  onSuccess?: () => void;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({ project, onSuccess }) => {
  const navigate = useNavigate();
  const isEditing = !!project;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    defaultValues: project || {
      material_ohp_percent: 15,
      labor_ohp_percent: 20,
      equipment_ohp_percent: 10,
      subcontractor_ohp_percent: 5,
      reminder_interval_days: 7,
      reminder_max_retries: 4,
    },
  });

  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

  const onSubmit = async (data: ProjectFormData) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: project.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/projects');
      }
    } catch (error) {
      // Error handling is done by React Query
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Project Name"
            {...register('name', { required: 'Project name is required' })}
            error={errors.name?.message}
            required
            placeholder="e.g., Main Street Office Building"
          />
          <Input
            label="Project Number"
            {...register('project_number', {
              required: 'Project number is required',
              pattern: {
                value: /^[a-zA-Z0-9_-]+$/,
                message: 'Only letters, numbers, dashes, and underscores allowed',
              },
            })}
            error={errors.project_number?.message}
            required
            placeholder="e.g., PROJ-2024-001"
          />
        </div>
        <div className="mt-4">
          <Input
            label="Notes"
            {...register('notes')}
            placeholder="Optional project notes"
          />
        </div>
      </div>

      {/* Customer & GC Information */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer & GC Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Customer Company"
            {...register('customer_company')}
            placeholder="Customer company name"
          />
          <Input
            label="GC Company"
            {...register('gc_company')}
            placeholder="General contractor company"
          />
          <Input
            label="GC Contact Name"
            {...register('gc_contact_name')}
            placeholder="GC contact person"
          />
          <Input
            label="GC Email"
            type="email"
            {...register('gc_email', {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email address',
              },
            })}
            error={errors.gc_email?.message}
            placeholder="gc@example.com"
          />
          <Input
            label="GC Phone"
            type="tel"
            {...register('gc_phone')}
            placeholder="(555) 123-4567"
          />
          <Input
            label="Project Manager Name"
            {...register('project_manager_name')}
            placeholder="PM name"
          />
        </div>
      </div>

      {/* Default OH&P Percentages */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Default OH&P Percentages
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          These overhead & profit percentages will be used as defaults for all TNM tickets on this project.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Materials OH&P %"
            type="number"
            step="0.01"
            {...register('material_ohp_percent', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
              max: { value: 100, message: 'Must be 100 or less' },
            })}
            error={errors.material_ohp_percent?.message}
            placeholder="15.00"
          />
          <Input
            label="Labor OH&P %"
            type="number"
            step="0.01"
            {...register('labor_ohp_percent', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
              max: { value: 100, message: 'Must be 100 or less' },
            })}
            error={errors.labor_ohp_percent?.message}
            placeholder="20.00"
          />
          <Input
            label="Equipment OH&P %"
            type="number"
            step="0.01"
            {...register('equipment_ohp_percent', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
              max: { value: 100, message: 'Must be 100 or less' },
            })}
            error={errors.equipment_ohp_percent?.message}
            placeholder="10.00"
          />
          <Input
            label="Subcontractor OH&P %"
            type="number"
            step="0.01"
            {...register('subcontractor_ohp_percent', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
              max: { value: 100, message: 'Must be 100 or less' },
            })}
            error={errors.subcontractor_ohp_percent?.message}
            placeholder="5.00"
          />
        </div>
      </div>

      {/* Labor Rates */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Labor Rates ($ per hour)
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          These hourly rates will be used for labor calculations on all TNM tickets for this project.
          Rates are captured at project creation and won't change if global defaults are updated later.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Project Manager"
            type="number"
            step="0.01"
            {...register('rate_project_manager', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
            })}
            error={errors.rate_project_manager?.message}
            placeholder="91.00"
          />
          <Input
            label="Superintendent"
            type="number"
            step="0.01"
            {...register('rate_superintendent', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
            })}
            error={errors.rate_superintendent?.message}
            placeholder="82.00"
          />
          <Input
            label="Carpenter"
            type="number"
            step="0.01"
            {...register('rate_carpenter', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
            })}
            error={errors.rate_carpenter?.message}
            placeholder="75.00"
          />
          <Input
            label="Laborer"
            type="number"
            step="0.01"
            {...register('rate_laborer', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
            })}
            error={errors.rate_laborer?.message}
            placeholder="57.00"
          />
        </div>
      </div>

      {/* Reminder Settings */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reminder Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Reminder Interval (days)"
            type="number"
            {...register('reminder_interval_days', {
              valueAsNumber: true,
              min: { value: 1, message: 'Must be at least 1 day' },
            })}
            error={errors.reminder_interval_days?.message}
            helperText="How often to send reminder emails to GC"
            placeholder="7"
          />
          <Input
            label="Maximum Retries"
            type="number"
            {...register('reminder_max_retries', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
            })}
            error={errors.reminder_max_retries?.message}
            helperText="How many reminder emails to send before stopping (0 = infinite retries)"
            placeholder="4"
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/projects')}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {isEditing ? 'Update Project' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
};

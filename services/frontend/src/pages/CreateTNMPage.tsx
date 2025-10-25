/**
 * Create TNM Ticket Page - Optimized for iPad (Foreman)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Camera, FileText } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { useProjects } from '../hooks/useProjects';
import { useCreateTNMTicket } from '../hooks/useTNMTickets';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { SignaturePad, SignatureDisplay } from '../components/common/SignaturePad';
import { LaborItemTable } from '../components/tnm/LaborItemTable';
import { MaterialItemTable } from '../components/tnm/MaterialItemTable';
import { EquipmentItemTable } from '../components/tnm/EquipmentItemTable';
import { SubcontractorItemTable } from '../components/tnm/SubcontractorItemTable';
import { StickySummaryBar } from '../components/tnm/StickySummaryBar';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TNMTicketFormData } from '../types/tnmTicket';
import { LaborItem, MaterialItem, EquipmentItem, SubcontractorItem } from '../types/lineItem';
import { formatDateForInput } from '../utils/formatters';
import {
  calculateLaborTotal,
  calculateMaterialTotal,
  calculateEquipmentTotal,
  calculateSubcontractorTotal,
  calculateTotalWithOHP,
} from '../utils/calculations';

export const CreateTNMPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectIdParam = searchParams.get('project_id');

  const { user } = useAuth();
  const { data: projects, isLoading: projectsLoading } = useProjects({ is_active: true });
  const createMutation = useCreateTNMTicket();

  const [laborItems, setLaborItems] = useState<LaborItem[]>([]);
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [subcontractorItems, setSubcontractorItems] = useState<SubcontractorItem[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(projectIdParam || '');

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Partial<TNMTicketFormData>>({
    defaultValues: {
      project_id: projectIdParam || '',
      submitter_name: user?.full_name || '',
      submitter_email: user?.email || '',
      proposal_date: formatDateForInput(new Date()),
    },
  });

  // Auto-select project if passed in URL
  useEffect(() => {
    if (projectIdParam && !selectedProject) {
      setSelectedProject(projectIdParam);
      setValue('project_id', projectIdParam);
    }
  }, [projectIdParam, selectedProject, setValue]);

  // Get selected project details
  const watchedProjectId = watch('project_id');
  const project = projects?.find(p => p.id === watchedProjectId);

  // Calculate real-time totals for sticky summary bar
  const laborSubtotal = calculateLaborTotal(laborItems);
  const materialSubtotal = calculateMaterialTotal(materialItems);
  const equipmentSubtotal = calculateEquipmentTotal(equipmentItems);
  const subcontractorSubtotal = calculateSubcontractorTotal(subcontractorItems);

  const laborOHP = project?.labor_ohp_percent || 20;
  const materialOHP = project?.material_ohp_percent || 15;
  const equipmentOHP = project?.equipment_ohp_percent || 10;
  const subcontractorOHP = project?.subcontractor_ohp_percent || 5;

  const laborTotal = calculateTotalWithOHP(laborSubtotal, laborOHP);
  const materialTotal = calculateTotalWithOHP(materialSubtotal, materialOHP);
  const equipmentTotal = calculateTotalWithOHP(equipmentSubtotal, equipmentOHP);
  const subcontractorTotal = calculateTotalWithOHP(subcontractorSubtotal, subcontractorOHP);

  const proposalAmount = laborTotal + materialTotal + equipmentTotal + subcontractorTotal;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (data: Partial<TNMTicketFormData>) => {
    try {
      const formData: TNMTicketFormData = {
        project_id: data.project_id!,
        title: data.title!,
        description: data.description,
        submitter_name: data.submitter_name!,
        submitter_email: data.submitter_email!,
        proposal_date: data.proposal_date!,
        labor_items: laborItems,
        material_items: materialItems,
        equipment_items: equipmentItems,
        subcontractor_items: subcontractorItems,
        signature_url: signature || undefined,
        photo_urls: photos.length > 0 ? photos : undefined,
      };

      await createMutation.mutateAsync(formData);
      navigate('/tnm-tickets');
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (projectsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-7xl mx-auto pb-48">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/tnm-tickets"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to TNM Tickets
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create TNM Ticket</h1>
        <p className="mt-1 text-sm text-gray-600">
          Fill out all sections below to create a Time & Materials ticket
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Ticket Header */}
        <div className="card-section">
          <h3 className="card-section-title">Ticket Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Controller
              name="project_id"
              control={control}
              rules={{ required: 'Project is required' }}
              render={({ field }) => (
                <Select
                  {...field}
                  label="Job / Project"
                  options={projects?.map(p => ({ value: p.id, label: `${p.name} (#${p.project_number})` })) || []}
                  placeholder="Select a project"
                  error={errors.project_id?.message}
                  required
                />
              )}
            />
            {project && (
              <Input
                label="Project Number"
                value={project.project_number}
                disabled
                className="bg-gray-50"
              />
            )}
            <Input
              label="TNM Title"
              {...register('title', { required: 'Title is required' })}
              error={errors.title?.message}
              placeholder="e.g., Additional framing work for 2nd floor"
              required
              className="md:col-span-2"
            />
            <Input
              label="Proposal Date"
              type="date"
              {...register('proposal_date', { required: 'Date is required' })}
              error={errors.proposal_date?.message}
              required
            />
            <Input
              label="Submitter Name"
              {...register('submitter_name', { required: 'Name is required' })}
              error={errors.submitter_name?.message}
              required
            />
            <Input
              label="Submitter Email"
              type="email"
              {...register('submitter_email', { required: 'Email is required' })}
              error={errors.submitter_email?.message}
              required
              className="md:col-span-2"
            />
            <div className="md:col-span-2">
              <label className="label">Description / Notes</label>
              <textarea
                {...register('description')}
                className="input-field min-h-[100px]"
                placeholder="Optional detailed description of the work"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-6">
          <div className="card-section">
            <LaborItemTable items={laborItems} onChange={setLaborItems} />
          </div>

          <div className="card-section">
            <MaterialItemTable items={materialItems} onChange={setMaterialItems} />
          </div>

          <div className="card-section">
            <EquipmentItemTable items={equipmentItems} onChange={setEquipmentItems} />
          </div>

          <div className="card-section">
            <SubcontractorItemTable items={subcontractorItems} onChange={setSubcontractorItems} />
          </div>
        </div>

        {/* Signature & Photos */}
        <div className="card-section">
          <h3 className="card-section-title">Signature & Documentation</h3>
          <p className="text-sm text-gray-600 mb-4">
            Option A: Capture GC signature on device, OR Option B: Attach photo of signed paper TNM
          </p>

          <div className="space-y-4">
            {/* Signature */}
            <div>
              {signature ? (
                <SignatureDisplay
                  signature={signature}
                  onRemove={() => setSignature(null)}
                  label="GC Signature"
                />
              ) : (
                <>
                  {showSignaturePad ? (
                    <SignaturePad
                      onSave={(dataUrl) => {
                        setSignature(dataUrl);
                        setShowSignaturePad(false);
                      }}
                      onCancel={() => setShowSignaturePad(false)}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowSignaturePad(true)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Add GC Signature
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Photos */}
            <div>
              <label className="label mb-2">Attach Photos (optional)</label>
              <div className="space-y-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative border border-gray-300 rounded-lg p-2">
                    <img src={photo} alt={`Photo ${index + 1}`} className="max-h-48 mx-auto rounded" />
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 hover:bg-red-700"
                    >
                      <span className="sr-only">Remove</span>
                      ✕
                    </button>
                  </div>
                ))}
                <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                  <Camera className="w-4 h-4 mr-2" />
                  Add Photo
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={handlePhotoUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

      </form>

      {/* Sticky Summary Bar at Bottom */}
      {project && (
        <StickySummaryBar
          laborSubtotal={laborSubtotal}
          laborOHP={laborOHP}
          laborTotal={laborTotal}
          materialSubtotal={materialSubtotal}
          materialOHP={materialOHP}
          materialTotal={materialTotal}
          equipmentSubtotal={equipmentSubtotal}
          equipmentOHP={equipmentOHP}
          equipmentTotal={equipmentTotal}
          subcontractorSubtotal={subcontractorSubtotal}
          subcontractorOHP={subcontractorOHP}
          subcontractorTotal={subcontractorTotal}
          proposalAmount={proposalAmount}
          onSubmitForReview={handleSubmit(onSubmit)}
          isSaving={isSubmitting}
        />
      )}
    </div>
  );
};

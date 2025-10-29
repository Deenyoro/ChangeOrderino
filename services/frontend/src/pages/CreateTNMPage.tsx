/**
 * Create TNM Ticket Page - Optimized for iPad (Foreman)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, Camera, FileText, AlertCircle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { useProjects } from '../hooks/useProjects';
import { useCreateTNMTicket, useTNMTicket, useUpdateTNMTicket } from '../hooks/useTNMTickets';
import { useAuth } from '../hooks/useAuth';
import { AppDispatch, RootState } from '../store';
import { fetchGlobalSettings } from '../store/slices/settingsSlice';
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
import { TNMTicketFormData, TNMStatus } from '../types/tnmTicket';
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
  const dispatch = useDispatch<AppDispatch>();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const projectIdParam = searchParams.get('project_id');

  const isEditMode = Boolean(id);

  const { user } = useAuth();
  const { data: projects, isLoading: projectsLoading } = useProjects({ is_active: true });
  const { data: existingTicket, isLoading: ticketLoading } = useTNMTicket(id || '');
  const createMutation = useCreateTNMTicket();
  const updateMutation = useUpdateTNMTicket();

  // Get settings from Redux store
  const { globalSettings } = useSelector((state: RootState) => state.settings);
  const hidePricesOnCreation = globalSettings.find(s => s.key === 'HIDE_PRICES_ON_TNM_CREATION')?.value?.toLowerCase() === 'true' || false;

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

  // Fetch settings on mount
  useEffect(() => {
    dispatch(fetchGlobalSettings()); // Fetch all settings for TNM creation
  }, [dispatch]);

  // Auto-select project if passed in URL
  useEffect(() => {
    if (projectIdParam && !selectedProject) {
      setSelectedProject(projectIdParam);
      setValue('project_id', projectIdParam);
    }
  }, [projectIdParam, selectedProject, setValue]);

  // Populate form with existing ticket data in edit mode
  useEffect(() => {
    if (isEditMode && existingTicket) {
      setValue('project_id', existingTicket.project_id);
      setValue('title', existingTicket.title);
      setValue('description', existingTicket.description || '');
      setValue('submitter_name', existingTicket.submitter_name);
      setValue('submitter_email', existingTicket.submitter_email);
      setValue('proposal_date', formatDateForInput(new Date(existingTicket.proposal_date)));
      if (existingTicket.due_date) {
        setValue('due_date', formatDateForInput(new Date(existingTicket.due_date)));
      }
      setValue('send_reminders_until_accepted', existingTicket.send_reminders_until_accepted);
      setValue('send_reminders_until_paid', existingTicket.send_reminders_until_paid);

      setSelectedProject(existingTicket.project_id);
      setLaborItems(existingTicket.labor_items || []);
      setMaterialItems(existingTicket.material_items || []);
      setEquipmentItems(existingTicket.equipment_items || []);
      setSubcontractorItems(existingTicket.subcontractor_items || []);
      setSignature(existingTicket.signature_url || null);
      setPhotos(existingTicket.photo_urls || []);
    }
  }, [isEditMode, existingTicket, setValue]);

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const MAX_PHOTOS = 5;

    for (const file of Array.from(files)) {
      // Check if we've reached the limit
      if (photos.length >= MAX_PHOTOS) {
        alert(`Maximum of ${MAX_PHOTOS} images allowed. Additional files will be ignored.`);
        break;
      }

      // Check if file is a PDF
      if (file.type === 'application/pdf') {
        try {
          // Send PDF to backend for conversion
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/v1/utils/convert-pdf', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Failed to convert PDF');
          }

          const result = await response.json();

          // Add converted images up to the limit
          const remainingSlots = MAX_PHOTOS - photos.length;
          const imagesToAdd = result.image_urls.slice(0, remainingSlots);

          if (result.image_urls.length > remainingSlots) {
            alert(`PDF has ${result.image_urls.length} pages, but only ${remainingSlots} slots remaining. Only first ${remainingSlots} pages will be added.`);
          }

          setPhotos(prev => [...prev, ...imagesToAdd]);
        } catch (error) {
          console.error('Error converting PDF:', error);
          alert('Failed to convert PDF. Please try again.');
        }
      } else if (file.type.startsWith('image/')) {
        // Handle image files normally
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotos(prev => {
            if (prev.length >= MAX_PHOTOS) {
              return prev;
            }
            return [...prev, reader.result as string];
          });
        };
        reader.readAsDataURL(file);
      } else {
        alert('Only images and PDF files are allowed');
      }
    }

    // Clear the file input so the same file can be selected again if needed
    e.target.value = '';
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
        due_date: data.due_date || undefined,
        send_reminders_until_accepted: data.send_reminders_until_accepted || false,
        send_reminders_until_paid: data.send_reminders_until_paid || false,
        labor_items: laborItems,
        material_items: materialItems,
        equipment_items: equipmentItems,
        subcontractor_items: subcontractorItems,
        signature_url: signature || undefined,
        photo_urls: photos.length > 0 ? photos : undefined,
      };

      if (isEditMode && id) {
        await updateMutation.mutateAsync({ id, data: formData });
        navigate(`/tnm/${id}`);
      } else {
        await createMutation.mutateAsync(formData);
        navigate('/tnm-tickets');
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (projectsLoading || (isEditMode && ticketLoading)) {
    return <LoadingSpinner />;
  }

  // Prevent editing tickets that aren't in editable status
  if (isEditMode && existingTicket) {
    const canEdit = existingTicket.status === TNMStatus.DRAFT || existingTicket.status === TNMStatus.PENDING_REVIEW;
    if (!canEdit) {
      return (
        <div className="max-w-7xl mx-auto">
          <div className="card">
            <div className="flex items-center gap-3 text-yellow-600 mb-4">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-xl font-semibold">Cannot Edit Ticket</h2>
            </div>
            <p className="text-gray-600 mb-4">
              This TNM ticket cannot be edited because it has a status of <strong>{existingTicket.status}</strong>.
              Only tickets with status "draft" or "pending_review" can be edited.
            </p>
            <Button onClick={() => navigate(`/tnm/${id}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Ticket Details
            </Button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="max-w-7xl mx-auto pb-48">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={isEditMode ? `/tnm/${id}` : "/tnm-tickets"}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {isEditMode ? 'Back to TNM Details' : 'Back to TNM Tickets'}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEditMode ? 'Edit TNM Ticket' : 'Create TNM Ticket'}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {isEditMode
            ? 'Update the form below to modify this Time & Materials ticket'
            : 'Fill out all sections below to create a Time & Materials ticket'
          }
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
              label="Due Date (Optional)"
              type="date"
              {...register('due_date')}
              error={errors.due_date?.message}
              helperText="Set a deadline for GC response. Overdue tickets appear on dashboard with alerts."
            />
            <div className="md:col-span-2 space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-gray-900">Automatic Reminder Settings</h4>
              <p className="text-sm text-gray-600">Enable automatic reminders to keep sending until specific conditions are met</p>
              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="send_reminders_until_accepted"
                  {...register('send_reminders_until_accepted')}
                  className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="send_reminders_until_accepted" className="text-sm">
                  <span className="font-medium text-gray-900">Send reminders until Accepted</span>
                  <span className="block text-gray-600">Continue sending reminders until the GC approves this ticket (ignores max reminder limit)</span>
                </label>
              </div>
              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="send_reminders_until_paid"
                  {...register('send_reminders_until_paid')}
                  className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="send_reminders_until_paid" className="text-sm">
                  <span className="font-medium text-gray-900">Send reminders until Paid</span>
                  <span className="block text-gray-600">Continue sending reminders until this ticket is marked as paid (ignores max reminder limit)</span>
                </label>
              </div>
            </div>
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
            <LaborItemTable
              items={laborItems}
              onChange={setLaborItems}
              hidePrices={!isEditMode && hidePricesOnCreation}
            />
          </div>

          <div className="card-section">
            <MaterialItemTable
              items={materialItems}
              onChange={setMaterialItems}
              hidePrices={!isEditMode && hidePricesOnCreation}
            />
          </div>

          <div className="card-section">
            <EquipmentItemTable
              items={equipmentItems}
              onChange={setEquipmentItems}
              hidePrices={!isEditMode && hidePricesOnCreation}
            />
          </div>

          <div className="card-section">
            <SubcontractorItemTable
              items={subcontractorItems}
              onChange={setSubcontractorItems}
              hidePrices={!isEditMode && hidePricesOnCreation}
            />
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
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Attach Photos/PDFs (optional)</label>
                <span className="text-sm text-gray-600">
                  {photos.length} / 5 images
                </span>
              </div>
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
                {photos.length < 5 ? (
                  <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    <Camera className="w-4 h-4 mr-2" />
                    Add Photo/PDF
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={handlePhotoUpload}
                      className="sr-only"
                    />
                  </label>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    Maximum of 5 images reached
                  </div>
                )}
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
          hidePrices={!isEditMode && hidePricesOnCreation}
        />
      )}
    </div>
  );
};

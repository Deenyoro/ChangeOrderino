-- ==========================================
-- ChangeOrderino Database Initialization
-- ==========================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'foreman', 'project_manager', 'office_staff', 'viewer');
CREATE TYPE tnm_status AS ENUM ('draft', 'pending_review', 'ready_to_send', 'sent', 'viewed', 'partially_approved', 'approved', 'denied', 'cancelled');
CREATE TYPE labor_type AS ENUM ('project_manager', 'superintendent', 'carpenter', 'laborer');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'denied');

-- ==========================================
-- Users Table (for auth reference)
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keycloak_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role user_role NOT NULL DEFAULT 'foreman',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_keycloak_id ON users(keycloak_id);
CREATE INDEX idx_users_email ON users(email);

-- ==========================================
-- Projects/Jobs Table
-- ==========================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    project_number VARCHAR(100) UNIQUE NOT NULL,
    customer_company VARCHAR(255),
    gc_company VARCHAR(255),
    gc_email VARCHAR(255),
    gc_contact_name VARCHAR(255),
    gc_phone VARCHAR(50),

    -- Project Manager
    project_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_manager_name VARCHAR(255),

    -- Default OH&P percentages (can be overridden per TNM)
    material_ohp_percent DECIMAL(5,2) DEFAULT 15.00,
    labor_ohp_percent DECIMAL(5,2) DEFAULT 20.00,
    equipment_ohp_percent DECIMAL(5,2) DEFAULT 10.00,
    subcontractor_ohp_percent DECIMAL(5,2) DEFAULT 5.00,

    -- Labor rate overrides (nullable = use global defaults if NULL)
    rate_project_manager NUMERIC(8,2),
    rate_superintendent NUMERIC(8,2),
    rate_carpenter NUMERIC(8,2),
    rate_laborer NUMERIC(8,2),

    -- Reminder settings
    reminder_interval_days INTEGER DEFAULT 7,
    reminder_max_retries INTEGER DEFAULT 4,

    -- Approval token expiration override (nullable = use global default if NULL)
    approval_token_expiration_hours INTEGER,

    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_number ON projects(project_number);
CREATE INDEX idx_projects_active ON projects(is_active);

-- ==========================================
-- TNM Tickets (Change Orders)
-- ==========================================
CREATE TABLE tnm_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tnm_number VARCHAR(100) UNIQUE NOT NULL,
    rfco_number VARCHAR(100),

    -- Project reference
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_number VARCHAR(100) NOT NULL,

    -- Header info
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Submitter (Foreman)
    submitter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    submitter_name VARCHAR(255) NOT NULL,
    submitter_email VARCHAR(255) NOT NULL,

    -- Dates
    proposal_date DATE NOT NULL,
    response_date DATE,

    -- Status
    status tnm_status NOT NULL DEFAULT 'draft',

    -- Calculated totals (stored for performance)
    labor_subtotal DECIMAL(12,2) DEFAULT 0.00,
    labor_ohp_percent DECIMAL(5,2) DEFAULT 20.00,
    labor_total DECIMAL(12,2) DEFAULT 0.00,

    material_subtotal DECIMAL(12,2) DEFAULT 0.00,
    material_ohp_percent DECIMAL(5,2) DEFAULT 15.00,
    material_total DECIMAL(12,2) DEFAULT 0.00,

    equipment_subtotal DECIMAL(12,2) DEFAULT 0.00,
    equipment_ohp_percent DECIMAL(5,2) DEFAULT 10.00,
    equipment_total DECIMAL(12,2) DEFAULT 0.00,

    subcontractor_subtotal DECIMAL(12,2) DEFAULT 0.00,
    subcontractor_ohp_percent DECIMAL(5,2) DEFAULT 5.00,
    subcontractor_total DECIMAL(12,2) DEFAULT 0.00,

    proposal_amount DECIMAL(12,2) DEFAULT 0.00,
    approved_amount DECIMAL(12,2) DEFAULT 0.00,

    -- Labor rate snapshots (captured at TNM creation from project or global defaults)
    rate_project_manager NUMERIC(8,2),
    rate_superintendent NUMERIC(8,2),
    rate_carpenter NUMERIC(8,2),
    rate_laborer NUMERIC(8,2),

    -- Attachments
    signature_url TEXT,
    photo_urls TEXT[], -- Array of URLs to signed documents

    -- Email tracking
    email_sent_count INTEGER DEFAULT 0,
    last_email_sent_at TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    last_reminder_sent_at TIMESTAMP WITH TIME ZONE,

    -- GC approval tracking
    approval_token VARCHAR(255) UNIQUE,
    approval_token_expires_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,

    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tnm_tickets_number ON tnm_tickets(tnm_number);
CREATE INDEX idx_tnm_tickets_project ON tnm_tickets(project_id);
CREATE INDEX idx_tnm_tickets_status ON tnm_tickets(status);
CREATE INDEX idx_tnm_tickets_submitter ON tnm_tickets(submitter_id);
CREATE INDEX idx_tnm_tickets_approval_token ON tnm_tickets(approval_token);

-- ==========================================
-- Labor Line Items
-- ==========================================
CREATE TABLE labor_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tnm_ticket_id UUID NOT NULL REFERENCES tnm_tickets(id) ON DELETE CASCADE,

    description TEXT NOT NULL,
    hours DECIMAL(8,2) NOT NULL,
    labor_type labor_type NOT NULL,
    rate_per_hour DECIMAL(8,2) NOT NULL,

    -- Calculated
    subtotal DECIMAL(12,2) GENERATED ALWAYS AS (hours * rate_per_hour) STORED,

    line_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_labor_items_ticket ON labor_items(tnm_ticket_id);

-- ==========================================
-- Material Line Items
-- ==========================================
CREATE TABLE material_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tnm_ticket_id UUID NOT NULL REFERENCES tnm_tickets(id) ON DELETE CASCADE,

    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50),
    unit_price DECIMAL(12,2) NOT NULL,

    -- Calculated
    subtotal DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    line_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_material_items_ticket ON material_items(tnm_ticket_id);

-- ==========================================
-- Equipment Line Items
-- ==========================================
CREATE TABLE equipment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tnm_ticket_id UUID NOT NULL REFERENCES tnm_tickets(id) ON DELETE CASCADE,

    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50),
    unit_price DECIMAL(12,2) NOT NULL,

    -- Calculated
    subtotal DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    line_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_equipment_items_ticket ON equipment_items(tnm_ticket_id);

-- ==========================================
-- Subcontractor Line Items
-- ==========================================
CREATE TABLE subcontractor_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tnm_ticket_id UUID NOT NULL REFERENCES tnm_tickets(id) ON DELETE CASCADE,

    description TEXT NOT NULL,
    subcontractor_name VARCHAR(255),
    proposal_date DATE,
    amount DECIMAL(12,2) NOT NULL,

    line_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subcontractor_items_ticket ON subcontractor_items(tnm_ticket_id);

-- ==========================================
-- Line Item Approvals (GC can approve/deny individual items)
-- ==========================================
CREATE TABLE line_item_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tnm_ticket_id UUID NOT NULL REFERENCES tnm_tickets(id) ON DELETE CASCADE,

    line_item_type VARCHAR(50) NOT NULL, -- 'labor', 'material', 'equipment', 'subcontractor'
    line_item_id UUID NOT NULL,

    status approval_status NOT NULL DEFAULT 'pending',
    approved_amount DECIMAL(12,2),
    gc_comment TEXT,

    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by VARCHAR(255),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_line_approvals_ticket ON line_item_approvals(tnm_ticket_id);
CREATE INDEX idx_line_approvals_item ON line_item_approvals(line_item_id);

-- ==========================================
-- Email Log (tracking all emails sent)
-- ==========================================
CREATE TABLE email_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tnm_ticket_id UUID REFERENCES tnm_tickets(id) ON DELETE SET NULL,

    to_email VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_text TEXT,
    body_html TEXT,

    email_type VARCHAR(50), -- 'initial_send', 'reminder', 'approval_confirmation'

    status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'sent', 'failed', 'bounced'
    error_message TEXT,

    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_log_ticket ON email_log(tnm_ticket_id);
CREATE INDEX idx_email_log_status ON email_log(status);

-- ==========================================
-- Audit Log (track all changes)
-- ==========================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    entity_type VARCHAR(100) NOT NULL, -- 'tnm_ticket', 'project', 'approval'
    entity_id UUID NOT NULL,

    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'send', 'approve', 'deny'
    changes JSONB, -- {"field": {"old": "value", "new": "value"}}

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- ==========================================
-- Attachments/Assets Table
-- ==========================================
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tnm_ticket_id UUID REFERENCES tnm_tickets(id) ON DELETE CASCADE,

    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT,
    storage_key TEXT NOT NULL, -- MinIO object path
    presigned_url TEXT,

    asset_type VARCHAR(50), -- 'signature', 'photo', 'document'

    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assets_ticket ON assets(tnm_ticket_id);

-- ==========================================
-- Functions & Triggers
-- ==========================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tnm_tickets_updated_at BEFORE UPDATE ON tnm_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_item_approvals_updated_at BEFORE UPDATE ON line_item_approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- Initial Data
-- ==========================================

-- Create default admin user (for no-auth mode)
INSERT INTO users (id, email, username, full_name, role, keycloak_id)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@treconstruction.net',
    'admin',
    'System Administrator',
    'admin',
    'admin'
) ON CONFLICT DO NOTHING;

-- ==========================================
-- Views for Reporting
-- ==========================================

-- Summary view of TNM tickets
CREATE VIEW tnm_ticket_summary AS
SELECT
    t.id,
    t.tnm_number,
    t.rfco_number,
    t.title,
    p.name AS project_name,
    p.project_number,
    t.submitter_name,
    t.proposal_date,
    t.response_date,
    t.status,
    t.proposal_amount,
    t.approved_amount,
    t.email_sent_count,
    t.reminder_count,
    t.viewed_at,
    t.created_at,
    t.updated_at
FROM tnm_tickets t
JOIN projects p ON t.project_id = p.id;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO changeorderino;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO changeorderino;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO changeorderino;

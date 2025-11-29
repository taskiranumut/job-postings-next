-- =============================================================================
-- Job Postings Database Schema
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUM TYPES
-- -----------------------------------------------------------------------------

-- LLM processing status enum
CREATE TYPE llm_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- -----------------------------------------------------------------------------
-- TABLES
-- -----------------------------------------------------------------------------

-- Job Postings table
-- Main table for storing job posting information
CREATE TABLE job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Platform & Source Information
    platform_name TEXT NOT NULL,
    platform_job_id TEXT,
    url TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    
    -- Job Details (Parsed/LLM Extracted)
    job_title TEXT,
    company_name TEXT,
    location_text TEXT,
    work_mode TEXT,                     -- remote, hybrid, onsite
    employment_type TEXT,               -- full-time, part-time, contract
    seniority_level TEXT,               -- junior, mid, senior, lead
    domain TEXT,                        -- industry/sector
    
    -- Description Fields
    description_full TEXT,
    responsibilities_text TEXT,
    requirements_text TEXT,
    nice_to_have_text TEXT,
    benefits_text TEXT,
    
    -- Experience & Education
    years_of_experience_min INTEGER,
    years_of_experience_max INTEGER,
    education_level TEXT,
    
    -- Salary Information
    salary_min NUMERIC,
    salary_max NUMERIC,
    salary_currency TEXT,
    salary_period TEXT,                 -- yearly, monthly, hourly
    
    -- Skills & Tags (JSONB arrays)
    skills_required JSONB,              -- e.g., ["Python", "SQL", "AWS"]
    skills_nice_to_have JSONB,
    tags JSONB,
    
    -- Timestamps
    posted_at TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ,
    
    -- LLM Processing Status
    llm_processed BOOLEAN DEFAULT false,
    llm_model_version TEXT,
    llm_notes TEXT,
    llm_status llm_status NOT NULL DEFAULT 'pending',
    llm_started_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT job_postings_unique_platform_url UNIQUE (platform_name, url)
);

-- LLM Logs table
-- Stores logs for LLM processing activities
CREATE TABLE llm_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to job posting (nullable for system-level logs)
    job_posting_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
    
    -- Log Information
    level TEXT CHECK (level = ANY (ARRAY['info', 'warn', 'error'])),
    message TEXT,
    details JSONB,                      -- Additional structured data
    
    -- Performance Metrics
    duration_ms INTEGER,
    
    -- Denormalized fields for quick reference
    job_title TEXT,
    company_name TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Deleted Job Postings table
-- Archive table for soft-deleted job postings
CREATE TABLE deleted_job_postings (
    id UUID PRIMARY KEY,                -- No default, copied from original
    
    -- Platform & Source Information
    platform_name TEXT NOT NULL,
    platform_job_id TEXT,
    url TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    
    -- Job Details
    job_title TEXT,
    company_name TEXT,
    location_text TEXT,
    work_mode TEXT,
    employment_type TEXT,
    seniority_level TEXT,
    domain TEXT,
    
    -- Description Fields
    description_full TEXT,
    responsibilities_text TEXT,
    requirements_text TEXT,
    nice_to_have_text TEXT,
    benefits_text TEXT,
    
    -- Experience & Education
    years_of_experience_min INTEGER,
    years_of_experience_max INTEGER,
    education_level TEXT,
    
    -- Salary Information
    salary_min NUMERIC,
    salary_max NUMERIC,
    salary_currency TEXT,
    salary_period TEXT,
    
    -- Skills & Tags (with default empty arrays)
    skills_required JSONB DEFAULT '[]'::jsonb,
    skills_nice_to_have JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    posted_at TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ DEFAULT now(),
    
    -- LLM Processing Status (stored as TEXT for historical records)
    llm_processed BOOLEAN DEFAULT false,
    llm_model_version TEXT,
    llm_notes TEXT,
    llm_status TEXT,                    -- TEXT instead of enum for flexibility
    llm_started_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- job_postings indexes
CREATE INDEX idx_job_postings_llm_processed ON job_postings USING btree (llm_processed);
CREATE INDEX idx_job_postings_llm_started_at ON job_postings USING btree (llm_started_at) 
    WHERE (llm_processed = false);

-- llm_logs indexes
CREATE INDEX idx_llm_logs_job_posting_id ON llm_logs USING btree (job_posting_id);

-- deleted_job_postings indexes
CREATE INDEX idx_deleted_job_postings_deleted_at ON deleted_job_postings USING btree (deleted_at DESC);
CREATE INDEX idx_deleted_job_postings_url ON deleted_job_postings USING btree (url);

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

-- Note: RLS is currently DISABLED for these tables in the production database
-- job_postings: RLS disabled (public access)
-- llm_logs: RLS disabled (public access)
-- deleted_job_postings: RLS disabled (public access)

-- To enable RLS in the future, uncomment the following:
-- ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE llm_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deleted_job_postings ENABLE ROW LEVEL SECURITY;

-- Example policies (adjust according to your auth requirements):
-- CREATE POLICY "Enable read access for all users" ON job_postings FOR SELECT USING (true);
-- CREATE POLICY "Enable insert for authenticated users only" ON job_postings FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------

COMMENT ON TABLE job_postings IS 'Main table storing job posting information from various platforms';
COMMENT ON TABLE llm_logs IS 'Logs for LLM processing activities including duration and status';
COMMENT ON TABLE deleted_job_postings IS 'Archive table for soft-deleted job postings';

COMMENT ON COLUMN job_postings.llm_status IS 'Current LLM processing status: pending, processing, completed, or failed';
COMMENT ON COLUMN job_postings.skills_required IS 'JSON array of required skills, e.g., ["Python", "SQL", "AWS"]';
COMMENT ON COLUMN job_postings.skills_nice_to_have IS 'JSON array of nice-to-have skills';
COMMENT ON COLUMN job_postings.tags IS 'JSON array of custom tags for categorization';

COMMENT ON COLUMN llm_logs.duration_ms IS 'Duration of LLM processing in milliseconds';
COMMENT ON COLUMN llm_logs.details IS 'Additional structured data as JSONB (model info, token counts, etc.)';

COMMENT ON COLUMN deleted_job_postings.deleted_at IS 'Timestamp when the job posting was moved to deleted';


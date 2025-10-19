-- PostgreSQL schema for Pay Stub OCR Analysis System
-- This schema supports storing OCR results, metadata, and audit trails

-- Main table for normalized pay stub analysis results
CREATE TABLE IF NOT EXISTS normalized_pay_stub_analysis (
    analysis_id VARCHAR(255) PRIMARY KEY,
    
    -- Employee information
    employee_name VARCHAR(255),
    employee_id VARCHAR(100),
    department VARCHAR(100),
    
    -- Pay period information
    pay_period_start DATE,
    pay_period_end DATE,
    pay_date DATE,
    
    -- Financial amounts (stored in cents to avoid floating point issues)
    gross_pay BIGINT, -- in cents
    net_pay BIGINT,   -- in cents
    total_deductions BIGINT, -- in cents
    
    -- JSON fields for structured data
    earnings JSONB,     -- Array of earnings entries
    deductions JSONB,   -- Array of deduction entries
    
    -- Quality metrics
    text_completeness INTEGER CHECK (text_completeness >= 0 AND text_completeness <= 100),
    data_completeness INTEGER CHECK (data_completeness >= 0 AND data_completeness <= 100),
    confidence DECIMAL(5,2) CHECK (confidence >= 0 AND confidence <= 100),
    
    -- Metadata
    services TEXT[],          -- Array of OCR services used
    page_count INTEGER,
    normalized_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw OCR results from different services
CREATE TABLE IF NOT EXISTS ocr_service_results (
    id SERIAL PRIMARY KEY,
    analysis_id VARCHAR(255) NOT NULL REFERENCES normalized_pay_stub_analysis(analysis_id) ON DELETE CASCADE,
    
    -- Service information
    service_name VARCHAR(50) NOT NULL,
    service_version VARCHAR(20),
    
    -- OCR results
    extracted_text TEXT,
    structured_data JSONB,
    confidence DECIMAL(5,2),
    
    -- Processing metrics
    processing_time_ms INTEGER,
    pages_processed INTEGER,
    blocks_detected INTEGER,
    
    -- Service-specific metadata
    service_metadata JSONB,
    
    -- Status and errors
    success BOOLEAN NOT NULL,
    error_message TEXT,
    warnings TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Image preprocessing results
CREATE TABLE IF NOT EXISTS image_preprocessing_results (
    analysis_id VARCHAR(255) PRIMARY KEY REFERENCES normalized_pay_stub_analysis(analysis_id) ON DELETE CASCADE,
    
    -- Original file information
    original_bucket VARCHAR(255),
    original_key VARCHAR(500),
    original_format VARCHAR(20),
    original_size BIGINT,
    
    -- Processing results
    processed_bucket VARCHAR(255),
    processed_key VARCHAR(500),
    processed_format VARCHAR(20),
    processed_size BIGINT,
    
    -- Quality metrics
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    brightness DECIMAL(5,2),
    contrast DECIMAL(5,2),
    noise_level DECIMAL(5,2),
    rotation_angle DECIMAL(5,2),
    
    -- Processing information
    processing_time_ms INTEGER,
    processing_steps JSONB,
    processing_log JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Violation analysis results (for future integration with rules engine)
CREATE TABLE IF NOT EXISTS violation_analysis (
    id SERIAL PRIMARY KEY,
    analysis_id VARCHAR(255) NOT NULL REFERENCES normalized_pay_stub_analysis(analysis_id) ON DELETE CASCADE,
    
    -- Violation information
    violation_type VARCHAR(100) NOT NULL,
    violation_category VARCHAR(50) NOT NULL, -- 'wage', 'hour', 'record', 'other'
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Calculations and evidence
    calculated_amount BIGINT, -- in cents
    expected_amount BIGINT,   -- in cents
    difference BIGINT,        -- in cents
    
    -- Confidence and evidence
    confidence DECIMAL(5,2) CHECK (confidence >= 0 AND confidence <= 100),
    evidence JSONB,
    legal_citations JSONB,
    
    -- LLM processing
    llm_summary TEXT,
    llm_confidence DECIMAL(5,2),
    llm_model VARCHAR(100),
    llm_processing_time_ms INTEGER,
    
    -- Status
    status VARCHAR(20) CHECK (status IN ('detected', 'reviewed', 'confirmed', 'dismissed')) DEFAULT 'detected',
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log for compliance and debugging
CREATE TABLE IF NOT EXISTS analysis_audit_log (
    id SERIAL PRIMARY KEY,
    analysis_id VARCHAR(255) NOT NULL REFERENCES normalized_pay_stub_analysis(analysis_id) ON DELETE CASCADE,
    
    -- Event information
    event_type VARCHAR(50) NOT NULL, -- 'uploaded', 'preprocessed', 'ocr_started', 'ocr_completed', etc.
    event_status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed', 'retry'
    
    -- Event details
    service_name VARCHAR(50),
    event_data JSONB,
    duration_ms INTEGER,
    
    -- Request context
    request_id VARCHAR(100),
    user_id VARCHAR(255),
    client_ip INET,
    user_agent TEXT,
    
    -- Error information
    error_message TEXT,
    error_type VARCHAR(100),
    stack_trace TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing statistics for monitoring
CREATE TABLE IF NOT EXISTS processing_statistics (
    id SERIAL PRIMARY KEY,
    date_bucket DATE NOT NULL,
    
    -- Aggregated metrics
    total_analyses INTEGER,
    successful_analyses INTEGER,
    failed_analyses INTEGER,
    
    -- Service usage
    textract_usage INTEGER,
    google_vision_usage INTEGER,
    azure_vision_usage INTEGER,
    
    -- Performance metrics
    avg_processing_time_ms INTEGER,
    avg_confidence DECIMAL(5,2),
    avg_data_completeness DECIMAL(5,2),
    
    -- Quality metrics
    high_confidence_analyses INTEGER, -- confidence >= 80%
    low_confidence_analyses INTEGER,  -- confidence < 50%
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date_bucket)
);

-- Create indexes for performance optimization

-- Main analysis table indexes
CREATE INDEX IF NOT EXISTS idx_normalized_analysis_employee_id ON normalized_pay_stub_analysis(employee_id);
CREATE INDEX IF NOT EXISTS idx_normalized_analysis_pay_date ON normalized_pay_stub_analysis(pay_date);
CREATE INDEX IF NOT EXISTS idx_normalized_analysis_created_at ON normalized_pay_stub_analysis(created_at);
CREATE INDEX IF NOT EXISTS idx_normalized_analysis_confidence ON normalized_pay_stub_analysis(confidence);
CREATE INDEX IF NOT EXISTS idx_normalized_analysis_gross_pay ON normalized_pay_stub_analysis(gross_pay);
CREATE INDEX IF NOT EXISTS idx_normalized_analysis_services ON normalized_pay_stub_analysis USING GIN(services);

-- JSONB indexes for structured data queries
CREATE INDEX IF NOT EXISTS idx_normalized_analysis_earnings ON normalized_pay_stub_analysis USING GIN(earnings);
CREATE INDEX IF NOT EXISTS idx_normalized_analysis_deductions ON normalized_pay_stub_analysis USING GIN(deductions);

-- OCR service results indexes
CREATE INDEX IF NOT EXISTS idx_ocr_results_analysis_id ON ocr_service_results(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ocr_results_service_name ON ocr_service_results(service_name);
CREATE INDEX IF NOT EXISTS idx_ocr_results_confidence ON ocr_service_results(confidence);
CREATE INDEX IF NOT EXISTS idx_ocr_results_created_at ON ocr_service_results(created_at);

-- Violation analysis indexes
CREATE INDEX IF NOT EXISTS idx_violations_analysis_id ON violation_analysis(analysis_id);
CREATE INDEX IF NOT EXISTS idx_violations_type ON violation_analysis(violation_type);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON violation_analysis(severity);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violation_analysis(status);
CREATE INDEX IF NOT EXISTS idx_violations_created_at ON violation_analysis(created_at);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_analysis_id ON analysis_audit_log(analysis_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON analysis_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON analysis_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_request_id ON analysis_audit_log(request_id);

-- Processing statistics indexes
CREATE INDEX IF NOT EXISTS idx_stats_date_bucket ON processing_statistics(date_bucket);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_normalized_analysis_updated_at 
    BEFORE UPDATE ON normalized_pay_stub_analysis 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_violation_analysis_updated_at 
    BEFORE UPDATE ON violation_analysis 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_statistics_updated_at 
    BEFORE UPDATE ON processing_statistics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for common analysis queries
CREATE OR REPLACE VIEW analysis_summary AS
SELECT 
    a.analysis_id,
    a.employee_name,
    a.employee_id,
    a.pay_date,
    a.gross_pay,
    a.net_pay,
    a.confidence,
    a.data_completeness,
    a.services,
    a.created_at,
    COUNT(v.id) as violation_count,
    COUNT(CASE WHEN v.severity = 'high' OR v.severity = 'critical' THEN 1 END) as critical_violations,
    MAX(v.severity) as max_violation_severity
FROM normalized_pay_stub_analysis a
LEFT JOIN violation_analysis v ON a.analysis_id = v.analysis_id
GROUP BY a.analysis_id, a.employee_name, a.employee_id, a.pay_date, 
         a.gross_pay, a.net_pay, a.confidence, a.data_completeness, 
         a.services, a.created_at;

-- Grant permissions (adjust as needed for your setup)
-- These are basic grants - adjust based on your security requirements

-- For the application user
CREATE USER IF NOT EXISTS paystub_app WITH PASSWORD 'secure_password_here';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO paystub_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO paystub_app;

-- For read-only access (reporting/analytics)
CREATE USER IF NOT EXISTS paystub_readonly WITH PASSWORD 'readonly_password_here';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO paystub_readonly;

-- Create stored procedure for daily statistics aggregation
CREATE OR REPLACE FUNCTION update_daily_statistics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    stat_record RECORD;
BEGIN
    -- Insert or update daily statistics
    INSERT INTO processing_statistics (
        date_bucket,
        total_analyses,
        successful_analyses,
        failed_analyses,
        textract_usage,
        google_vision_usage,
        azure_vision_usage,
        avg_processing_time_ms,
        avg_confidence,
        avg_data_completeness,
        high_confidence_analyses,
        low_confidence_analyses
    )
    SELECT 
        target_date,
        COUNT(*)::INTEGER,
        COUNT(CASE WHEN a.confidence >= 70 THEN 1 END)::INTEGER,
        COUNT(CASE WHEN a.confidence < 70 THEN 1 END)::INTEGER,
        COUNT(CASE WHEN 'textract' = ANY(a.services) THEN 1 END)::INTEGER,
        COUNT(CASE WHEN 'google-vision' = ANY(a.services) THEN 1 END)::INTEGER,
        COUNT(CASE WHEN 'azure-vision' = ANY(a.services) THEN 1 END)::INTEGER,
        ROUND(AVG(EXTRACT(EPOCH FROM (a.updated_at - a.created_at)) * 1000))::INTEGER,
        ROUND(AVG(a.confidence), 2),
        ROUND(AVG(a.data_completeness), 2),
        COUNT(CASE WHEN a.confidence >= 80 THEN 1 END)::INTEGER,
        COUNT(CASE WHEN a.confidence < 50 THEN 1 END)::INTEGER
    FROM normalized_pay_stub_analysis a
    WHERE DATE(a.created_at) = target_date
    ON CONFLICT (date_bucket) DO UPDATE SET
        total_analyses = EXCLUDED.total_analyses,
        successful_analyses = EXCLUDED.successful_analyses,
        failed_analyses = EXCLUDED.failed_analyses,
        textract_usage = EXCLUDED.textract_usage,
        google_vision_usage = EXCLUDED.google_vision_usage,
        azure_vision_usage = EXCLUDED.azure_vision_usage,
        avg_processing_time_ms = EXCLUDED.avg_processing_time_ms,
        avg_confidence = EXCLUDED.avg_confidence,
        avg_data_completeness = EXCLUDED.avg_data_completeness,
        high_confidence_analyses = EXCLUDED.high_confidence_analyses,
        low_confidence_analyses = EXCLUDED.low_confidence_analyses,
        updated_at = NOW();
    
    RAISE LOG 'Updated daily statistics for %', target_date;
END;
$$ LANGUAGE plpgsql;

-- Create function to get analysis statistics
CREATE OR REPLACE FUNCTION get_analysis_metrics(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_analyses BIGINT,
    successful_analyses BIGINT,
    success_rate DECIMAL(5,2),
    avg_confidence DECIMAL(5,2),
    avg_processing_time_seconds DECIMAL(10,2),
    violations_detected BIGINT,
    critical_violations BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COUNT(CASE WHEN a.confidence >= 70 THEN 1 END)::BIGINT,
        ROUND(
            (COUNT(CASE WHEN a.confidence >= 70 THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2
        ) as success_rate,
        ROUND(AVG(a.confidence), 2),
        ROUND(AVG(EXTRACT(EPOCH FROM (a.updated_at - a.created_at))), 2),
        COUNT(v.id)::BIGINT,
        COUNT(CASE WHEN v.severity IN ('high', 'critical') THEN 1 END)::BIGINT
    FROM normalized_pay_stub_analysis a
    LEFT JOIN violation_analysis v ON a.analysis_id = v.analysis_id
    WHERE DATE(a.created_at) BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE normalized_pay_stub_analysis IS 'Main table storing normalized OCR results for pay stub analysis';
COMMENT ON TABLE ocr_service_results IS 'Raw results from OCR services (Textract, Google Vision, Azure)';
COMMENT ON TABLE image_preprocessing_results IS 'Results from image preprocessing and enhancement';
COMMENT ON TABLE violation_analysis IS 'Detected labor law violations from rules engine analysis';
COMMENT ON TABLE analysis_audit_log IS 'Audit trail for all processing events and compliance tracking';
COMMENT ON TABLE processing_statistics IS 'Daily aggregated statistics for monitoring and reporting';

-- Enable Row Level Security (RLS) for additional security
ALTER TABLE normalized_pay_stub_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic example - customize based on your security model)
CREATE POLICY "Users can view their own analyses" ON normalized_pay_stub_analysis
    FOR SELECT USING (true); -- Adjust with proper user identification logic

CREATE POLICY "Users can view their own violations" ON violation_analysis
    FOR SELECT USING (true); -- Adjust with proper user identification logic

CREATE POLICY "Service can insert audit logs" ON analysis_audit_log
    FOR INSERT WITH CHECK (true); -- Adjust with proper service authentication logic
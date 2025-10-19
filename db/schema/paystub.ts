import { pgTable, serial, text, timestamp, decimal, integer, boolean, jsonb, varchar } from 'drizzle-orm/pg-core';

// Pay stub submissions table
export const payStubSubmissions = pgTable('pay_stub_submissions', {
  id: serial('id').primaryKey(),
  submissionId: varchar('submission_id', { length: 255 }).notNull().unique(),
  
  // Worker information
  workerName: varchar('worker_name', { length: 255 }),
  employerName: varchar('employer_name', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 2 }).default('CA'),
  zipCode: varchar('zip_code', { length: 10 }),
  
  // File information
  originalFileName: varchar('original_file_name', { length: 255 }),
  mimeType: varchar('mime_type', { length: 100 }),
  fileSize: integer('file_size'),
  blobPath: varchar('blob_path', { length: 500 }),
  
  // Processing information
  status: varchar('status', { length: 20 }).default('pending'), // pending, processing, completed, error
  ocrService: varchar('ocr_service', { length: 100 }),
  processingTime: integer('processing_time'), // milliseconds
  
  // Consent
  consentGiven: boolean('consent_given').default(false),
  consentTimestamp: timestamp('consent_timestamp'),
  
  // Timestamps
  submissionDate: timestamp('submission_date').defaultNow(),
  processingDate: timestamp('processing_date'),
  
  // OCR extracted data (JSON)
  ocrData: jsonb('ocr_data'),
  
  // Error information
  errorMessage: text('error_message'),
});

// Violations detected table
export const payStubViolations = pgTable('pay_stub_violations', {
  id: serial('id').primaryKey(),
  submissionId: varchar('submission_id', { length: 255 }).notNull(),
  
  // Violation details
  violationType: varchar('violation_type', { length: 100 }).notNull(),
  description: text('description').notNull(),
  severity: varchar('severity', { length: 10 }).notNull(), // low, medium, high
  confidence: decimal('confidence', { precision: 3, scale: 2 }).notNull(), // 0.00-1.00
  
  // Legal references
  laborCode: varchar('labor_code', { length: 100 }),
  
  // Extracted values that triggered the violation
  actualValue: decimal('actual_value', { precision: 10, scale: 2 }),
  expectedValue: decimal('expected_value', { precision: 10, scale: 2 }),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
});

// QA reviews table
export const qaReviews = pgTable('qa_reviews', {
  id: serial('id').primaryKey(),
  submissionId: varchar('submission_id', { length: 255 }).notNull(),
  
  // Review details
  reviewStatus: varchar('review_status', { length: 2 }).notNull(), // TP, FP, FN
  reviewerName: varchar('reviewer_name', { length: 255 }),
  notes: text('notes'),
  
  // Feedback on violations
  violationFeedback: jsonb('violation_feedback'), // detailed feedback per violation
  
  // Timestamps
  reviewDate: timestamp('review_date').defaultNow(),
});

// OCR processing logs table
export const ocrProcessingLogs = pgTable('ocr_processing_logs', {
  id: serial('id').primaryKey(),
  submissionId: varchar('submission_id', { length: 255 }).notNull(),
  
  // Processing details
  serviceUsed: varchar('service_used', { length: 100 }).notNull(),
  processingStartTime: timestamp('processing_start_time').notNull(),
  processingEndTime: timestamp('processing_end_time'),
  processingDuration: integer('processing_duration'), // milliseconds
  
  // Service-specific data
  serviceResponse: jsonb('service_response'),
  confidenceScores: jsonb('confidence_scores'), // field-level confidence scores
  
  // Error handling
  errorMessage: text('error_message'),
  errorType: varchar('error_type', { length: 100 }),
  
  // Cost tracking (for billing/usage)
  serviceCost: decimal('service_cost', { precision: 10, scale: 4 }),
  tokensUsed: integer('tokens_used'),
});

// System configuration table
export const systemConfig = pgTable('system_config', {
  id: serial('id').primaryKey(),
  configKey: varchar('config_key', { length: 100 }).notNull().unique(),
  configValue: text('config_value'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Types for TypeScript
export type PayStubSubmission = typeof payStubSubmissions.$inferSelect;
export type NewPayStubSubmission = typeof payStubSubmissions.$inferInsert;

export type PayStubViolation = typeof payStubViolations.$inferSelect;
export type NewPayStubViolation = typeof payStubViolations.$inferInsert;

export type QAReview = typeof qaReviews.$inferSelect;
export type NewQAReview = typeof qaReviews.$inferInsert;

export type OCRProcessingLog = typeof ocrProcessingLogs.$inferSelect;
export type NewOCRProcessingLog = typeof ocrProcessingLogs.$inferInsert;

export type SystemConfig = typeof systemConfig.$inferSelect;
export type NewSystemConfig = typeof systemConfig.$inferInsert;
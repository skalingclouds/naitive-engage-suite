import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as authSchema from './schema/auth';
import * as paystubSchema from './schema/paystub';

export const db = drizzle(process.env.DATABASE_URL!);

// Export all schemas
export const schema = {
  ...authSchema,
  ...paystubSchema
};

// Export specific tables for convenience
export const {
  user,
  session,
  account,
  verification
} = authSchema;

export const {
  payStubSubmissions,
  payStubViolations,
  qaReviews,
  ocrProcessingLogs,
  systemConfig
} = paystubSchema;
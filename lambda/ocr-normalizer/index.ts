import { SQSHandler, SQSEvent } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Client } from 'pg';
import { Pool } from 'pg';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Initialize PostgreSQL client
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

// Environment variables
const ANALYSIS_TABLE = process.env.ANALYSIS_TABLE!;
const RULES_ENGINE_QUEUE_URL = process.env.RULES_ENGINE_QUEUE_URL!;
const SQS_CLIENT = require('@aws-sdk/client-sqs');
const { SQSClient, SendMessageCommand } = SQS_CLIENT;
const sqsClient = new SQSClient({});

interface FinalProcessingJob {
  analysisId: string;
  timestamp: string;
  ocrStatus: string;
  bestResult: any;
  combinedConfidence: number;
  services: string[];
}

interface NormalizedResult {
  analysisId: string;
  employeeInfo: {
    name?: string;
    id?: string;
    department?: string;
  };
  payPeriod: {
    startDate?: string;
    endDate?: string;
    payDate?: string;
    period?: string;
  };
  earnings: Array<{
    description: string;
    hours?: number;
    rate?: number;
    amount: number;
    type: string;
  }>;
  deductions: Array<{
    description: string;
    amount: number;
    type: string;
  }>;
  totals: {
    grossPay: number;
    netPay: number;
    totalDeductions: number;
    ytdGross?: number;
    ytdNet?: number;
  };
  quality: {
    textCompleteness: number;
    dataCompleteness: number;
    confidence: number;
    issues: string[];
  };
  metadata: {
    pageCount: number;
    services: string[];
    processingTime: number;
    normalizedAt: string;
  };
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('OCR normalization SQS event received:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const job: FinalProcessingJob = JSON.parse(record.body);
      console.log(`Normalizing OCR results for analysisId: ${job.analysisId}`);

      const normalizedResult = await normalizeOCRResults(job);
      
      // Validate the normalized results
      const validationResult = validateNormalizedResult(normalizedResult);
      normalizedResult.quality.issues.push(...validationResult.issues);

      // Store in PostgreSQL
      await storeNormalizedResult(normalizedResult);

      // Update DynamoDB status
      await updateAnalysisStatus(job.analysisId, 'normalized', normalizedResult);

      // Queue for rules engine processing
      await queueForRulesEngine(job.analysisId, normalizedResult);

      console.log(`Successfully normalized OCR results for ${job.analysisId}`);

    } catch (error) {
      console.error('Error normalizing OCR record:', error);
      
      const job: FinalProcessingJob = JSON.parse(record.body);
      await updateAnalysisStatus(job.analysisId, 'normalization_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};

async function normalizeOCRResults(job: FinalProcessingJob): Promise<NormalizedResult> {
  const result: NormalizedResult = {
    analysisId: job.analysisId,
    employeeInfo: {},
    payPeriod: {},
    earnings: [],
    deductions: [],
    totals: {
      grossPay: 0,
      netPay: 0,
      totalDeductions: 0,
    },
    quality: {
      textCompleteness: 0,
      dataCompleteness: 0,
      confidence: job.combinedConfidence,
      issues: [],
    },
    metadata: {
      pageCount: job.bestResult?.pages || 1,
      services: job.services,
      processingTime: 0,
      normalizedAt: new Date().toISOString(),
    },
  };

  if (!job.bestResult || !job.bestResult.extractedText) {
    result.quality.issues.push('No text extracted from OCR');
    return result;
  }

  const extractedText = job.bestResult.extractedText;
  const structuredData = job.bestResult.structuredData || {};

  // Normalize employee information
  result.employeeInfo = normalizeEmployeeInfo(extractedText, structuredData);
  
  // Normalize pay period information
  result.payPeriod = normalizePayPeriod(extractedText, structuredData);
  
  // Normalize earnings
  result.earnings = normalizeEarnings(extractedText, structuredData);
  
  // Normalize deductions
  result.deductions = normalizeDeductions(extractedText, structuredData);
  
  // Normalize totals
  result.totals = normalizeTotals(extractedText, structuredData, result.earnings, result.deductions);

  // Calculate quality metrics
  result.quality.textCompleteness = calculateTextCompleteness(extractedText);
  result.quality.dataCompleteness = calculateDataCompleteness(result);

  return result;
}

function normalizeEmployeeInfo(text: string, structuredData: any): any {
  const employeeInfo: any = {};

  // Extract employee name
  const namePatterns = [
    /(?:Employee Name|Name|Employee):\s*([^\n\r]+)/i,
    /^([A-Z][a-z]+\s+[A-Z][a-z]+)/m,
    /(?:Paid to|Payee):\s*([^\n\r]+)/i,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      employeeInfo.name = match[1].trim();
      break;
    }
  }

  // Extract employee ID
  const idPatterns = [
    /(?:Employee ID|ID|EID|Emp\s*#):\s*([A-Z0-9-]+)/i,
    /(?:Staff\s*ID|Associate\s*ID):\s*([A-Z0-9-]+)/i,
  ];

  for (const pattern of idPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      employeeInfo.id = match[1].trim();
      break;
    }
  }

  // Extract department
  const deptPatterns = [
    /(?:Department|Dept|Division):\s*([^\n\r]+)/i,
    /(?:Cost\s*Center|CC):\s*([A-Z0-9-]+)/i,
  ];

  for (const pattern of deptPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      employeeInfo.department = match[1].trim();
      break;
    }
  }

  // Use structured data if available
  if (structuredData.employeeInfo) {
    employeeInfo.name = employeeInfo.name || structuredData.employeeInfo.name;
    employeeInfo.id = employeeInfo.id || structuredData.employeeInfo.id;
  }

  return employeeInfo;
}

function normalizePayPeriod(text: string, structuredData: any): any {
  const payPeriod: any = {};

  // Extract pay period dates
  const periodPatterns = [
    /(?:Pay Period|Period):\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–to]*\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(?:Week ending|WE):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(?:Period\s*(?:Ending|End)):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
  ];

  for (const pattern of periodPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) {
        payPeriod.startDate = normalizeDate(match[1]);
        payPeriod.endDate = normalizeDate(match[2]);
      } else {
        payPeriod.endDate = normalizeDate(match[1]);
      }
      break;
    }
  }

  // Extract pay date
  const payDatePatterns = [
    /(?:Pay Date|Date of Payment|Paid):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(?:Check\s*Date):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
  ];

  for (const pattern of payDatePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      payPeriod.payDate = normalizeDate(match[1]);
      break;
    }
  }

  // Use structured data if available
  if (structuredData.payPeriod) {
    payPeriod.period = payPeriod.period || structuredData.payPeriod.period;
    payPeriod.payDate = payPeriod.payDate || structuredData.payPeriod.payDate;
  }

  return payPeriod;
}

function normalizeEarnings(text: string, structuredData: any): any[] {
  const earnings: any[] = [];

  // Use structured data first
  if (structuredData.earnings && structuredData.earnings.length > 0) {
    return structuredData.earnings.map((earning: any) => ({
      description: earning.description || earning.description || '',
      hours: earning.hours ? parseFloat(earning.hours) : undefined,
      rate: earning.rate ? parseFloat(earning.rate) : undefined,
      amount: earning.amount ? parseFloat(earning.amount) : 0,
      type: inferEarningType(earning.description || ''),
    }));
  }

  // Extract earnings from text using patterns
  const earningsPatterns = [
    // Regular earnings
    /(.+?)\s+(\d+\.?\d*)\s+\$?(\d+\.?\d*)\s+\$?([0-9,]+\.\d{2})/gim,
    // Amount only
    /(.+?)\s+\$?([0-9,]+\.\d{2})/gim,
    // Hours and amount
    /(.+?)\s+(\d+\.?\d*)\s+\$?([0-9,]+\.\d{2})/gim,
  ];

  for (const pattern of earningsPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const earning = {
        description: match[1].trim(),
        amount: parseFloat(match[match.length - 1].replace(',', '')),
        type: inferEarningType(match[1]),
      };

      if (match.length >= 4) {
        earning.hours = parseFloat(match[2]);
        earning.rate = parseFloat(match[3].replace(',', ''));
      }

      // Skip if this looks like a deduction
      if (!isDeductionDescription(earning.description)) {
        earnings.push(earning);
      }
    }
  }

  return earnings;
}

function normalizeDeductions(text: string, structuredData: any): any[] {
  const deductions: any[] = [];

  // Use structured data first
  if (structuredData.deductions && structuredData.deductions.length > 0) {
    return structuredData.deductions.map((deduction: any) => ({
      description: deduction.description || '',
      amount: deduction.amount ? parseFloat(deduction.amount) : 0,
      type: inferDeductionType(deduction.description || ''),
    }));
  }

  // Extract deductions from text
  const deductionKeywords = [
    'tax', 'insurance', '401k', 'medicare', 'social security', 'fica',
    'federal', 'state', 'local', 'parking', 'united way', 'garnishment'
  ];

  const lines = text.split('\n');
  for (const line of lines) {
    // Look for lines with amounts and deduction keywords
    const amountMatch = line.match(/\$?([0-9,]+\.\d{2})/);
    if (amountMatch) {
      const description = line.replace(amountMatch[0], '').trim();
      if (deductionKeywords.some(keyword => description.toLowerCase().includes(keyword))) {
        deductions.push({
          description,
          amount: parseFloat(amountMatch[1].replace(',', '')),
          type: inferDeductionType(description),
        });
      }
    }
  }

  return deductions;
}

function normalizeTotals(
  text: string, 
  structuredData: any, 
  earnings: any[], 
  deductions: any[]
): any {
  const totals: any = {
    grossPay: 0,
    netPay: 0,
    totalDeductions: 0,
  };

  // Calculate totals from structured data
  if (structuredData.totals) {
    totals.grossPay = parseAmount(structuredData.totals.grossPay) || 0;
    totals.netPay = parseAmount(structuredData.totals.netPay) || 0;
    totals.totalDeductions = parseAmount(structuredData.totals.totalDeductions) || 0;
  }

  // Extract from text if not found in structured data
  if (totals.grossPay === 0) {
    const grossPattern = /(?:Gross Pay|Gross|Total\s*Earnings):\s*\$?([0-9,]+\.\d{2})/i;
    const grossMatch = text.match(grossPattern);
    if (grossMatch) {
      totals.grossPay = parseFloat(grossMatch[1].replace(',', ''));
    }
  }

  if (totals.netPay === 0) {
    const netPattern = /(?:Net Pay|Net|Take\s*Home):\s*\$?([0-9,]+\.\d{2})/i;
    const netMatch = text.match(netPattern);
    if (netMatch) {
      totals.netPay = parseFloat(netMatch[1].replace(',', ''));
    }
  }

  // Calculate from earnings if still zero
  if (totals.grossPay === 0 && earnings.length > 0) {
    totals.grossPay = earnings.reduce((sum, earning) => sum + earning.amount, 0);
  }

  // Calculate total deductions if still zero
  if (totals.totalDeductions === 0 && deductions.length > 0) {
    totals.totalDeductions = deductions.reduce((sum, deduction) => sum + deduction.amount, 0);
  }

  // Calculate net pay from gross and deductions if still zero
  if (totals.netPay === 0 && totals.grossPay > 0) {
    totals.netPay = totals.grossPay - totals.totalDeductions;
  }

  return totals;
}

function normalizeDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

function parseAmount(amountString: any): number | null {
  if (!amountString) return null;
  const parsed = parseFloat(String(amountString).replace(/[$,]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

function inferEarningType(description: string): string {
  const desc = description.toLowerCase();
  
  if (desc.includes('regular') || desc.includes('hourly')) return 'regular';
  if (desc.includes('overtime') || desc.includes('ot')) return 'overtime';
  if (desc.includes('holiday') || desc.includes('premium')) return 'premium';
  if (desc.includes('bonus') || desc.includes('commission')) return 'bonus';
  if (desc.includes('vacation') || desc.includes('pto')) return 'paid_time_off';
  if (desc.includes('sick') || desc.includes('personal')) return 'leave';
  
  return 'other';
}

function inferDeductionType(description: string): string {
  const desc = description.toLowerCase();
  
  if (desc.includes('federal') && desc.includes('tax')) return 'federal_tax';
  if (desc.includes('state') && desc.includes('tax')) return 'state_tax';
  if (desc.includes('social security') || desc.includes('fica')) return 'social_security';
  if (desc.includes('medicare')) return 'medicare';
  if (desc.includes('insurance') || desc.includes('medical')) return 'health_insurance';
  if (desc.includes('401k') || desc.includes('retirement')) return 'retirement';
  if (desc.includes('parking')) return 'parking';
  
  return 'other';
}

function isDeductionDescription(description: string): boolean {
  const desc = description.toLowerCase();
  const deductionKeywords = [
    'tax', 'insurance', '401k', 'medicare', 'social security', 'fica',
    'federal', 'state', 'local', 'parking', 'deduction', 'withholding'
  ];
  
  return deductionKeywords.some(keyword => desc.includes(keyword));
}

function calculateTextCompleteness(text: string): number {
  if (!text) return 0;
  
  // Check for key indicators of a complete pay stub
  const indicators = [
    /employee|name/i,
    /pay\s*period|period|date/i,
    /gross\s*pay|earnings/i,
    /net\s*pay|take\s*home/i,
    /deduction|tax/i,
    /\$\d+\.\d{2}/, // Currency amounts
  ];
  
  const foundIndicators = indicators.filter(pattern => pattern.test(text)).length;
  return Math.round((foundIndicators / indicators.length) * 100);
}

function calculateDataCompleteness(result: NormalizedResult): number {
  let score = 0;
  let maxScore = 0;
  
  // Employee info completeness (30%)
  if (result.employeeInfo.name) score += 10;
  if (result.employeeInfo.id) score += 10;
  if (result.employeeInfo.department) score += 10;
  maxScore += 30;
  
  // Pay period completeness (20%)
  if (result.payPeriod.startDate) score += 10;
  if (result.payPeriod.payDate) score += 10;
  maxScore += 20;
  
  // Earnings completeness (25%)
  if (result.earnings.length > 0) {
    score += 15;
    if (result.earnings.some(e => e.hours)) score += 5;
    if (result.earnings.some(e => e.rate)) score += 5;
  }
  maxScore += 25;
  
  // Totals completeness (25%)
  if (result.totals.grossPay > 0) score += 10;
  if (result.totals.netPay > 0) score += 10;
  if (result.totals.totalDeductions > 0) score += 5;
  maxScore += 25;
  
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

function validateNormalizedResult(result: NormalizedResult): { issues: string[] } {
  const issues: string[] = [];
  
  // Validate employee info
  if (!result.employeeInfo.name) {
    issues.push('Employee name not found');
  }
  
  // Validate financial data
  if (result.totals.grossPay <= 0) {
    issues.push('Gross pay amount invalid or missing');
  }
  
  if (result.totals.netPay < 0) {
    issues.push('Net pay cannot be negative');
  }
  
  if (result.totals.grossPay > 0 && result.totals.netPay > result.totals.grossPay) {
    issues.push('Net pay cannot exceed gross pay');
  }
  
  // Validate earnings
  if (result.earnings.length === 0) {
    issues.push('No earnings information found');
  }
  
  // Validate totals consistency
  const calculatedTotalDeductions = result.deductions.reduce((sum, d) => sum + d.amount, 0);
  if (Math.abs(calculatedTotalDeductions - result.totals.totalDeductions) > 0.01) {
    issues.push('Total deductions calculation mismatch');
  }
  
  const calculatedNetPay = result.totals.grossPay - result.totals.totalDeductions;
  if (Math.abs(calculatedNetPay - result.totals.netPay) > 0.01) {
    issues.push('Net pay calculation mismatch');
  }
  
  return { issues };
}

async function storeNormalizedResult(result: NormalizedResult): Promise<void> {
  const client = await pool.connect();
  
  try {
    const query = `
      INSERT INTO normalized_pay_stub_analysis (
        analysis_id, employee_name, employee_id, department,
        pay_period_start, pay_period_end, pay_date,
        gross_pay, net_pay, total_deductions,
        earnings, deductions, text_completeness, data_completeness,
        confidence, services, page_count, normalized_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (analysis_id) DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        employee_id = EXCLUDED.employee_id,
        department = EXCLUDED.department,
        pay_period_start = EXCLUDED.pay_period_start,
        pay_period_end = EXCLUDED.pay_period_end,
        pay_date = EXCLUDED.pay_date,
        gross_pay = EXCLUDED.gross_pay,
        net_pay = EXCLUDED.net_pay,
        total_deductions = EXCLUDED.total_deductions,
        earnings = EXCLUDED.earnings,
        deductions = EXCLUDED.deductions,
        text_completeness = EXCLUDED.text_completeness,
        data_completeness = EXCLUDED.data_completeness,
        confidence = EXCLUDED.confidence,
        services = EXCLUDED.services,
        page_count = EXCLUDED.page_count,
        normalized_at = EXCLUDED.normalized_at
    `;
    
    await client.query(query, [
      result.analysisId,
      result.employeeInfo.name,
      result.employeeInfo.id,
      result.employeeInfo.department,
      result.payPeriod.startDate,
      result.payPeriod.endDate,
      result.payPeriod.payDate,
      result.totals.grossPay,
      result.totals.netPay,
      result.totals.totalDeductions,
      JSON.stringify(result.earnings),
      JSON.stringify(result.deductions),
      result.quality.textCompleteness,
      result.quality.dataCompleteness,
      result.quality.confidence,
      result.metadata.services,
      result.metadata.pageCount,
      result.metadata.normalizedAt,
    ]);
    
  } finally {
    client.release();
  }
}

async function updateAnalysisStatus(analysisId: string, status: string, data: any): Promise<void> {
  const updateParams = {
    TableName: ANALYSIS_TABLE,
    Key: { analysisId: { S: analysisId } },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #normalizedResult = :normalizedResult',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
      '#normalizedResult': 'normalizedResult',
    },
    ExpressionAttributeValues: {
      ':status': { S: status },
      ':updatedAt': { S: new Date().toISOString() },
      ':normalizedResult': { S: JSON.stringify(data) },
    },
  };

  await dynamoClient.send(new UpdateItemCommand(updateParams));
}

async function queueForRulesEngine(analysisId: string, result: NormalizedResult): Promise<void> {
  const message = {
    analysisId,
    normalizedData: result,
    timestamp: new Date().toISOString(),
  };

  const sqsParams = {
    QueueUrl: RULES_ENGINE_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      analysisId: {
        DataType: 'String',
        StringValue: analysisId,
      },
    },
  };

  await sqsClient.send(new SendMessageCommand(sqsParams));
  console.log(`Queued rules engine processing for ${analysisId}`);
}
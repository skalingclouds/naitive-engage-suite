import { SQSHandler, SQSEvent } from 'aws-lambda';
import { TextractClient, AnalyzeDocumentCommand, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand } from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Readable } from 'stream';

// Initialize AWS clients
const textractClient = new TextractClient({});
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Environment variables
const ANALYSIS_TABLE = process.env.ANALYSIS_TABLE!;
const OCR_RESULTS_TABLE = process.env.OCR_RESULTS_TABLE!;
const FALLBACK_QUEUE_URL = process.env.FALLBACK_QUEUE_URL!;
const SQS_CLIENT = require('@aws-sdk/client-sqs');
const { SQSClient, SendMessageCommand } = SQS_CLIENT;
const sqsClient = new SQSClient({});

interface OCRJob {
  analysisId: string;
  bucket: string;
  key: string;
  contentType: string;
  timestamp: string;
}

interface OCRResult {
  analysisId: string;
  service: string;
  success: boolean;
  confidence: number;
  extractedText: string;
  structuredData: any;
  processingTime: number;
  pages: number;
  blocks: any[];
  error?: string;
  warnings?: string[];
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('OCR processing SQS event received:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const job: OCRJob = JSON.parse(record.body);
      console.log(`Processing OCR for analysisId: ${job.analysisId} with AWS Textract`);

      const startTime = Date.now();
      const result = await processWithTextract(job);
      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;

      await updateAnalysisStatus(result);
      await storeOCRResult(result);

      console.log(`Successfully completed OCR for ${job.analysisId} in ${processingTime}ms`);

      // If Textract failed with low confidence, queue for fallback services
      if (!result.success || result.confidence < 70) {
        await queueForFallback(job, result);
        console.log(`Queued fallback processing for ${job.analysisId} due to low confidence or failure`);
      }

    } catch (error) {
      console.error('Error processing OCR record:', error);
      
      const job: OCRJob = JSON.parse(record.body);
      await updateAnalysisStatus({
        analysisId: job.analysisId,
        service: 'textract',
        success: false,
        confidence: 0,
        extractedText: '',
        structuredData: null,
        processingTime: 0,
        pages: 0,
        blocks: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings: [],
      });
    }
  }
};

async function processWithTextract(job: OCRJob): Promise<OCRResult> {
  const result: OCRResult = {
    analysisId: job.analysisId,
    service: 'textract',
    success: false,
    confidence: 0,
    extractedText: '',
    structuredData: null,
    processingTime: 0,
    pages: 0,
    blocks: [],
  };

  try {
    // Download document from S3
    const documentBuffer = await downloadDocument(job.bucket, job.key);
    
    let analysisResponse;
    
    if (job.contentType === 'application/pdf') {
      // For PDFs, use asynchronous analysis
      analysisResponse = await analyzePDFDocument(job.bucket, job.key);
    } else {
      // For images, use synchronous analysis
      analysisResponse = await analyzeImageDocument(documentBuffer);
    }

    if (analysisResponse) {
      result.success = true;
      result.blocks = analysisResponse.Blocks || [];
      result.pages = Math.max(...result.blocks.map((block: any) => block.Page || 1));
      
      // Extract text from blocks
      result.extractedText = extractTextFromBlocks(result.blocks);
      
      // Extract structured data for pay stubs
      result.structuredData = extractPayStubData(result.blocks);
      
      // Calculate overall confidence
      result.confidence = calculateConfidence(result.blocks);
      
      console.log(`Textract analysis completed for ${job.analysisId}. Text length: ${result.extractedText.length}, Confidence: ${result.confidence}%`);
    }

  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Textract processing failed for ${job.analysisId}:`, error);
  }

  return result;
}

async function analyzeImageDocument(imageBuffer: Buffer) {
  const params = {
    Document: {
      Bytes: imageBuffer,
    },
    FeatureTypes: ['FORMS', 'TABLES'] as const,
  };

  const command = new AnalyzeDocumentCommand(params);
  const response = await textractClient.send(command);
  return response;
}

async function analyzePDFDocument(bucket: string, key: string) {
  // Start asynchronous analysis
  const startParams = {
    DocumentLocation: {
      S3Object: {
        Bucket: bucket,
        Name: key,
      },
    },
    FeatureTypes: ['FORMS', 'TABLES'] as const,
  };

  const startCommand = new StartDocumentAnalysisCommand(startParams);
  const startResponse = await textractClient.send(startCommand);
  
  if (!startResponse.JobId) {
    throw new Error('Failed to start Textract job');
  }

  // Poll for completion
  const maxAttempts = 30;
  const pollInterval = 2000; // 2 seconds
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const getParams = {
      JobId: startResponse.JobId,
    };
    
    const getCommand = new GetDocumentAnalysisCommand(getParams);
    const response = await textractClient.send(getCommand);
    
    if (response.JobStatus === 'SUCCEEDED') {
      return response;
    } else if (response.JobStatus === 'FAILED') {
      throw new Error(`Textract job failed: ${response.StatusMessage}`);
    }
    
    // Continue polling if still in progress
    console.log(`Textract job ${startResponse.JobId} status: ${response.JobStatus} (attempt ${attempt + 1}/${maxAttempts})`);
  }
  
  throw new Error('Textract job timed out');
}

function extractTextFromBlocks(blocks: any[]): string {
  return blocks
    .filter(block => block.BlockType === 'LINE')
    .map(block => block.Text)
    .join('\n');
}

function extractPayStubData(blocks: any[]): any {
  const result: any = {
    employeeInfo: {},
    payPeriod: {},
    earnings: [],
    deductions: [],
    totals: {},
  };

  // Extract key-value pairs from forms
  const keyValuePairs = extractKeyValuePairs(blocks);
  
  // Find employee information
  if (keyValuePairs['Employee Name'] || keyValuePairs['Name']) {
    result.employeeInfo.name = keyValuePairs['Employee Name'] || keyValuePairs['Name'];
  }
  if (keyValuePairs['Employee ID'] || keyValuePairs['ID']) {
    result.employeeInfo.id = keyValuePairs['Employee ID'] || keyValuePairs['ID'];
  }
  
  // Extract pay period information
  if (keyValuePairs['Pay Period'] || keyValuePairs['Period']) {
    result.payPeriod.period = keyValuePairs['Pay Period'] || keyValuePairs['Period'];
  }
  if (keyValuePairs['Pay Date']) {
    result.payPeriod.payDate = keyValuePairs['Pay Date'];
  }
  
  // Extract earnings from tables
  const earningsTable = extractTableData(blocks, ['Rate', 'Hours', 'Amount', 'Earnings']);
  if (earningsTable.length > 0) {
    result.earnings = earningsTable;
  }
  
  // Extract deductions from tables
  const deductionsTable = extractTableData(blocks, ['Deduction', 'Amount', 'YTD']);
  if (deductionsTable.length > 0) {
    result.deductions = deductionsTable;
  }
  
  // Extract totals
  if (keyValuePairs['Gross Pay']) {
    result.totals.grossPay = keyValuePairs['Gross Pay'];
  }
  if (keyValuePairs['Net Pay']) {
    result.totals.netPay = keyValuePairs['Net Pay'];
  }
  if (keyValuePairs['Total Deductions']) {
    result.totals.totalDeductions = keyValuePairs['Total Deductions'];
  }

  return result;
}

function extractKeyValuePairs(blocks: any[]): Record<string, string> {
  const pairs: Record<string, string> = {};
  
  const keyBlocks = blocks.filter(block => block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY'));
  const valueBlocks = blocks.filter(block => block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('VALUE'));
  
  keyBlocks.forEach(keyBlock => {
    if (keyBlock.Relationships) {
      const valueBlock = valueBlocks.find(vBlock => 
        keyBlock.Relationships?.some(rel => 
          rel.Type === 'VALUE' && rel.Ids?.includes(vBlock.Id)
        )
      );
      
      if (valueBlock && keyBlock.Relationships) {
        const childBlocks = keyBlock.Relationships
          .filter(rel => rel.Type === 'CHILD')
          .flatMap(rel => rel.Ids || [])
          .map(id => blocks.find(block => block.Id === id))
          .filter(block => block?.BlockType === 'WORD')
          .map(block => block.Text)
          .join(' ');
          
        const valueChildBlocks = valueBlock.Relationships
          ?.filter(rel => rel.Type === 'CHILD')
          ?.flatMap(rel => rel.Ids || [])
          ?.map(id => blocks.find(block => block.Id === id))
          ?.filter(block => block?.BlockType === 'WORD')
          ?.map(block => block.Text)
          ?.join(' ');
          
        if (childBlocks && valueChildBlocks) {
          pairs[childBlocks.trim()] = valueChildBlocks.trim();
        }
      }
    }
  });
  
  return pairs;
}

function extractTableData(blocks: any[], columnHeaders: string[]): any[] {
  const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');
  const results: any[] = [];
  
  tableBlocks.forEach(tableBlock => {
    if (tableBlock.Relationships) {
      const tableCells = tableBlock.Relationships
        .filter(rel => rel.Type === 'CHILD')
        .flatMap(rel => rel.Ids || [])
        .map(id => blocks.find(block => block.Id === id))
        .filter(block => block?.BlockType === 'CELL');
      
      // Group cells by row
      const rows: { [key: number]: any[] } = {};
      tableCells.forEach(cell => {
        const rowIndex = cell.RowIndex || 1;
        if (!rows[rowIndex]) {
          rows[rowIndex] = [];
        }
        rows[rowIndex].push(cell);
      });
      
      // Convert rows to objects
      Object.keys(rows).forEach(rowIndex => {
        const row = rows[parseInt(rowIndex)];
        if (row.length > 1) { // Skip header or empty rows
          const rowData: any = {};
          row.forEach(cell => {
            const cellText = cell.Relationships
              ?.filter(rel => rel.Type === 'CHILD')
              ?.flatMap(rel => rel.Ids || [])
              ?.map(id => blocks.find(block => block.Id === id))
              ?.filter(block => block?.BlockType === 'WORD')
              ?.map(block => block.Text)
              ?.join(' ');
              
            if (cellText) {
              const columnIndex = cell.ColumnIndex || 1;
              const header = columnHeaders[columnIndex - 1] || `Column${columnIndex}`;
              rowData[header] = cellText;
            }
          });
          results.push(rowData);
        }
      });
    }
  });
  
  return results;
}

function calculateConfidence(blocks: any[]): number {
  const textBlocks = blocks.filter(block => block.BlockType === 'LINE' || block.BlockType === 'WORD');
  
  if (textBlocks.length === 0) {
    return 0;
  }
  
  const totalConfidence = textBlocks.reduce((sum, block) => {
    return sum + (block.Confidence || 0);
  }, 0);
  
  return Math.round(totalConfidence / textBlocks.length);
}

async function downloadDocument(bucket: string, key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);
  
  if (response.Body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  
  throw new Error('Unable to download document from S3');
}

async function updateAnalysisStatus(result: OCRResult): Promise<void> {
  const updateParams = {
    TableName: ANALYSIS_TABLE,
    Key: { analysisId: { S: result.analysisId } },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #ocrResult = :ocrResult',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
      '#ocrResult': 'ocrResult',
    },
    ExpressionAttributeValues: {
      ':status': { S: result.success ? 'ocr_completed' : 'ocr_failed' },
      ':updatedAt': { S: new Date().toISOString() },
      ':ocrResult': { S: JSON.stringify(result) },
    },
  };

  await dynamoClient.send(new UpdateItemCommand(updateParams));
}

async function storeOCRResult(result: OCRResult): Promise<void> {
  const command = new PutCommand({
    TableName: OCR_RESULTS_TABLE,
    Item: {
      analysisId: result.analysisId,
      service: result.service,
      success: result.success,
      confidence: result.confidence,
      extractedText: result.extractedText,
      structuredData: result.structuredData,
      processingTime: result.processingTime,
      pages: result.pages,
      blockCount: result.blocks.length,
      error: result.error,
      warnings: result.warnings || [],
      timestamp: new Date().toISOString(),
    },
  });

  await docClient.send(command);
}

async function queueForFallback(job: OCRJob, primaryResult: OCRResult): Promise<void> {
  const fallbackMessage = {
    analysisId: job.analysisId,
    bucket: job.bucket,
    key: job.key,
    contentType: job.contentType,
    timestamp: job.timestamp,
    primaryService: 'textract',
    primaryResult: {
      success: primaryResult.success,
      confidence: primaryResult.confidence,
      error: primaryResult.error,
    },
  };

  const sqsParams = {
    QueueUrl: FALLBACK_QUEUE_URL,
    MessageBody: JSON.stringify(fallbackMessage),
    MessageAttributes: {
      contentType: {
        DataType: 'String',
        StringValue: job.contentType,
      },
      analysisId: {
        DataType: 'String',
        StringValue: job.analysisId,
      },
      primaryService: {
        DataType: 'String',
        StringValue: 'textract',
      },
    },
  };

  await sqsClient.send(new SendMessageCommand(sqsParams));
  console.log(`Queued fallback processing for ${job.analysisId}`);
}
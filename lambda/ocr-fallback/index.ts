import { SQSHandler, SQSEvent } from 'aws-lambda';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { ComputerVisionClient } from '@azure/cognitiveservices-computer-vision';
import { CognitiveServicesCredentials } from '@ms-rest-azure';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Readable } from 'stream';

// Initialize clients
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Initialize Google Vision client
const googleVisionClient = new ImageAnnotatorClient();

// Initialize Azure Computer Vision client
const azureCredentials = new CognitiveServicesCredentials(
  process.env.AZURE_COMPUTER_VISION_KEY!
);
const azureClient = new ComputerVisionClient(
  azureCredentials,
  process.env.AZURE_COMPUTER_VISION_ENDPOINT!
);

// Environment variables
const ANALYSIS_TABLE = process.env.ANALYSIS_TABLE!;
const OCR_RESULTS_TABLE = process.env.OCR_RESULTS_TABLE!;
const FINAL_RESULTS_QUEUE_URL = process.env.FINAL_RESULTS_QUEUE_URL!;
const SQS_CLIENT = require('@aws-sdk/client-sqs');
const { SQSClient, SendMessageCommand } = SQS_CLIENT;
const sqsClient = new SQSClient({});

interface FallbackJob {
  analysisId: string;
  bucket: string;
  key: string;
  contentType: string;
  timestamp: string;
  primaryService: string;
  primaryResult: {
    success: boolean;
    confidence: number;
    error?: string;
  };
}

interface FallbackResult {
  analysisId: string;
  services: string[];
  results: any[];
  bestResult: any;
  combinedConfidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('OCR fallback SQS event received:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const job: FallbackJob = JSON.parse(record.body);
      console.log(`Processing fallback OCR for analysisId: ${job.analysisId}`);

      const startTime = Date.now();
      const result = await processFallbackOCR(job);
      result.processingTime = Date.now() - startTime;

      await updateAnalysisStatus(result);
      await storeFallbackResult(result);

      console.log(`Successfully completed fallback OCR for ${job.analysisId} in ${result.processingTime}ms`);

      // Queue for final processing and rule engine analysis
      await queueForFinalProcessing(job.analysisId, result);

    } catch (error) {
      console.error('Error processing fallback OCR record:', error);
      
      const job: FallbackJob = JSON.parse(record.body);
      await updateAnalysisStatus({
        analysisId: job.analysisId,
        services: [],
        results: [],
        bestResult: null,
        combinedConfidence: 0,
        processingTime: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};

async function processFallbackOCR(job: FallbackJob): Promise<FallbackResult> {
  const result: FallbackResult = {
    analysisId: job.analysisId,
    services: [],
    results: [],
    bestResult: null,
    combinedConfidence: 0,
    processingTime: 0,
    success: false,
  };

  try {
    // Download document from S3
    const documentBuffer = await downloadDocument(job.bucket, job.key);
    
    const services = [];
    const results = [];

    // Try Google Vision API first
    try {
      console.log(`Trying Google Vision API for ${job.analysisId}`);
      const googleResult = await processWithGoogleVision(documentBuffer, job.contentType);
      if (googleResult.success) {
        services.push('google-vision');
        results.push(googleResult);
        console.log(`Google Vision succeeded with confidence: ${googleResult.confidence}%`);
      }
    } catch (error) {
      console.error(`Google Vision failed for ${job.analysisId}:`, error);
    }

    // Try Azure Computer Vision next
    try {
      console.log(`Trying Azure Computer Vision for ${job.analysisId}`);
      const azureResult = await processWithAzureVision(documentBuffer, job.contentType);
      if (azureResult.success) {
        services.push('azure-vision');
        results.push(azureResult);
        console.log(`Azure Vision succeeded with confidence: ${azureResult.confidence}%`);
      }
    } catch (error) {
      console.error(`Azure Vision failed for ${job.analysisId}:`, error);
    }

    // Evaluate results
    result.services = services;
    result.results = results;
    
    if (results.length > 0) {
      // Find the best result (highest confidence)
      result.bestResult = results.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      result.combinedConfidence = calculateCombinedConfidence(results);
      result.success = true;
      
      console.log(`Fallback processing completed for ${job.analysisId}. Best service: ${result.bestResult.service}, Confidence: ${result.combinedConfidence}%`);
    } else {
      result.success = false;
      result.error = 'All fallback services failed';
    }

  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Fallback processing failed for ${job.analysisId}:`, error);
  }

  return result;
}

async function processWithGoogleVision(imageBuffer: Buffer, contentType: string): Promise<any> {
  try {
    let image;
    
    if (contentType === 'application/pdf') {
      // For PDFs, we'd need to extract pages first
      // For now, return failure for PDFs in Google Vision
      throw new Error('PDF processing not supported in Google Vision fallback');
    } else {
      image = { content: imageBuffer.toString('base64') };
    }

    const [result] = await googleVisionClient.documentTextDetection({
      image,
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
    });

    const fullTextAnnotation = result.fullTextAnnotation;
    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      throw new Error('No text detected by Google Vision');
    }

    // Extract structured data from pages
    const structuredData = extractStructuredDataFromGoogleVision(fullTextAnnotation);
    
    // Calculate confidence
    const confidence = calculateGoogleVisionConfidence(fullTextAnnotation);

    return {
      service: 'google-vision',
      success: true,
      confidence,
      extractedText: fullTextAnnotation.text,
      structuredData,
      pages: fullTextAnnotation.pages?.length || 1,
      blockCount: fullTextAnnotation.pages?.reduce((total, page) => 
        total + (page.blocks?.length || 0), 0) || 0,
    };

  } catch (error) {
    return {
      service: 'google-vision',
      success: false,
      confidence: 0,
      extractedText: '',
      structuredData: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function processWithAzureVision(imageBuffer: Buffer, contentType: string): Promise<any> {
  try {
    let result;
    
    if (contentType === 'application/pdf') {
      // For PDFs, use Read API with PDF support
      result = await azureClient.readInStream(imageBuffer, { language: 'en' });
      
      // Poll for operation completion
      const operationLocation = result.operationLocation;
      const operationId = operationLocation?.split('/').pop();
      
      if (!operationId) {
        throw new Error('Unable to get Azure operation ID');
      }
      
      // Poll for completion (simplified)
      await new Promise(resolve => setTimeout(resolve, 5000));
      const readResult = await azureClient.getReadResult(operationId);
      
      if (readResult.status !== 'succeeded') {
        throw new Error(`Azure read operation failed: ${readResult.status}`);
      }
      
      const extractedText = readResult.analyzeResult?.readResults
        ?.map(page => page.lines?.map(line => line.text).join('\n') || '')
        ?.join('\n') || '';
        
      return {
        service: 'azure-vision',
        success: true,
        confidence: 85, // Azure doesn't provide confidence in read API
        extractedText,
        structuredData: extractStructuredDataFromAzure(readResult.analyzeResult?.readResults),
        pages: readResult.analyzeResult?.readResults?.length || 1,
      };
      
    } else {
      // For images, use OCR API
      result = await azureClient.recognizePrintedTextInStream(true, imageBuffer, 'en');
      
      const extractedText = result.regions
        ?.map(region => region.lines?.map(line => line.words?.map(word => word.text).join(' ')).join('\n') || '')
        ?.join('\n') || '';
        
      if (!extractedText) {
        throw new Error('No text detected by Azure Vision');
      }

      return {
        service: 'azure-vision',
        success: true,
        confidence: 80, // Estimated confidence
        extractedText,
        structuredData: extractStructuredDataFromAzure(result.regions),
        pages: 1,
      };
    }

  } catch (error) {
    return {
      service: 'azure-vision',
      success: false,
      confidence: 0,
      extractedText: '',
      structuredData: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function extractStructuredDataFromGoogleVision(fullTextAnnotation: any): any {
  const result = {
    employeeInfo: {},
    payPeriod: {},
    earnings: [],
    deductions: [],
    totals: {},
  };

  const text = fullTextAnnotation.text;
  
  // Use regex patterns to extract key information
  const patterns = {
    employeeName: /(?:Employee Name|Name|Employee):\s*([^\n]+)/i,
    employeeId: /(?:Employee ID|ID|EID):\s*([^\n]+)/i,
    payPeriod: /(?:Pay Period|Period):\s*([^\n]+)/i,
    payDate: /(?:Pay Date|Date):\s*([^\n]+)/i,
    grossPay: /(?:Gross Pay|Gross):\s*\$?([0-9,]+\.\d{2})/i,
    netPay: /(?:Net Pay|Net):\s*\$?([0-9,]+\.\d{2})/i,
  };

  // Extract patterns
  Object.entries(patterns).forEach(([key, pattern]) => {
    const match = text.match(pattern);
    if (match) {
      switch (key) {
        case 'employeeName':
          result.employeeInfo.name = match[1].trim();
          break;
        case 'employeeId':
          result.employeeInfo.id = match[1].trim();
          break;
        case 'payPeriod':
          result.payPeriod.period = match[1].trim();
          break;
        case 'payDate':
          result.payPeriod.payDate = match[1].trim();
          break;
        case 'grossPay':
          result.totals.grossPay = match[1].trim();
          break;
        case 'netPay':
          result.totals.netPay = match[1].trim();
          break;
      }
    }
  });

  // Extract earnings and deductions using more complex patterns
  result.earnings = extractEarningsFromText(text);
  result.deductions = extractDeductionsFromText(text);

  return result;
}

function extractStructuredDataFromAzure(readResults: any): any {
  const result = {
    employeeInfo: {},
    payPeriod: {},
    earnings: [],
    deductions: [],
    totals: {},
  };

  if (!readResults) return result;

  const allText = readResults
    .map((page: any) => page.lines?.map((line: any) => line.text).join('\n') || '')
    .join('\n');

  // Use similar extraction logic as Google Vision
  return extractStructuredDataFromGoogleVision({ text: allText });
}

function extractEarningsFromText(text: string): any[] {
  const earnings = [];
  
  // Look for patterns like "Regular 40.0 $25.00 $1,000.00"
  const earningsPattern = /(.+?)\s+(\d+\.?\d*)\s+\$?(\d+\.?\d*)\s+\$?([0-9,]+\.\d{2})/gim;
  let match;
  
  while ((match = earningsPattern.exec(text)) !== null) {
    earnings.push({
      description: match[1].trim(),
      hours: parseFloat(match[2]),
      rate: parseFloat(match[3].replace(',', '')),
      amount: parseFloat(match[4].replace(',', '')),
    });
  }
  
  return earnings;
}

function extractDeductionsFromText(text: string): any[] {
  const deductions = [];
  
  // Look for patterns like "Federal Tax $150.00"
  const deductionsPattern = /(.+?)\s+\$?([0-9,]+\.\d{2})/gim;
  const deductionKeywords = ['tax', 'insurance', '401k', 'medicare', 'social security', 'fica'];
  
  let match;
  while ((match = deductionsPattern.exec(text)) !== null) {
    const description = match[1].trim().toLowerCase();
    if (deductionKeywords.some(keyword => description.includes(keyword))) {
      deductions.push({
        description: match[1].trim(),
        amount: parseFloat(match[2].replace(',', '')),
      });
    }
  }
  
  return deductions;
}

function calculateGoogleVisionConfidence(fullTextAnnotation: any): number {
  // Google Vision doesn't provide per-word confidence in document text detection
  // Use text length and other heuristics to estimate confidence
  const text = fullTextAnnotation.text;
  const textLength = text.length;
  
  // Base confidence
  let confidence = 75;
  
  // Add confidence based on text length
  if (textLength > 100) confidence += 10;
  if (textLength > 500) confidence += 5;
  
  // Add confidence based on page count
  const pageCount = fullTextAnnotation.pages?.length || 1;
  if (pageCount > 1) confidence += 5;
  
  return Math.min(95, confidence);
}

function calculateCombinedConfidence(results: any[]): number {
  if (results.length === 0) return 0;
  if (results.length === 1) return results[0].confidence;
  
  // Weight by confidence and prioritize services
  const weights = {
    'google-vision': 1.2,
    'azure-vision': 1.0,
  };
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  results.forEach(result => {
    const weight = weights[result.service as keyof typeof weights] || 1.0;
    weightedSum += result.confidence * weight;
    totalWeight += weight;
  });
  
  return Math.round(weightedSum / totalWeight);
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

async function updateAnalysisStatus(result: FallbackResult): Promise<void> {
  const updateParams = {
    TableName: ANALYSIS_TABLE,
    Key: { analysisId: { S: result.analysisId } },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #fallbackResult = :fallbackResult',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
      '#fallbackResult': 'fallbackResult',
    },
    ExpressionAttributeValues: {
      ':status': { S: result.success ? 'ocr_fallback_completed' : 'ocr_failed' },
      ':updatedAt': { S: new Date().toISOString() },
      ':fallbackResult': { S: JSON.stringify(result) },
    },
  };

  await dynamoClient.send(new UpdateItemCommand(updateParams));
}

async function storeFallbackResult(result: FallbackResult): Promise<void> {
  const command = new PutCommand({
    TableName: OCR_RESULTS_TABLE,
    Item: {
      analysisId: result.analysisId,
      service: 'fallback',
      success: result.success,
      confidence: result.combinedConfidence,
      extractedText: result.bestResult?.extractedText || '',
      structuredData: result.bestResult?.structuredData || null,
      processingTime: result.processingTime,
      services: result.services,
      resultCount: result.results.length,
      error: result.error,
      timestamp: new Date().toISOString(),
    },
  });

  await docClient.send(command);
}

async function queueForFinalProcessing(analysisId: string, result: FallbackResult): Promise<void> {
  const finalMessage = {
    analysisId,
    timestamp: new Date().toISOString(),
    ocrStatus: result.success ? 'completed' : 'failed',
    bestResult: result.bestResult,
    combinedConfidence: result.combinedConfidence,
    services: result.services,
  };

  const sqsParams = {
    QueueUrl: FINAL_RESULTS_QUEUE_URL,
    MessageBody: JSON.stringify(finalMessage),
    MessageAttributes: {
      analysisId: {
        DataType: 'String',
        StringValue: analysisId,
      },
      ocrStatus: {
        DataType: 'String',
        StringValue: result.success ? 'completed' : 'failed',
      },
    },
  };

  await sqsClient.send(new SendMessageCommand(sqsParams));
  console.log(`Queued final processing for ${analysisId}`);
}
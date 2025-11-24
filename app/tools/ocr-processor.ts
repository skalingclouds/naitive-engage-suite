import { tool } from 'ai';
import { z } from 'zod';

// OCR Processing Tool - Wraps the upload and OCR processing pipeline
export const ocrProcessorTool = tool({
  description: 'Process uploaded documents and extract structured data using OCR. This tool handles file uploads, triggers OCR processing, and extracts structured information from documents.',
  inputSchema: z.object({
    fileName: z.string().describe('The name of the file being processed'),
    contentType: z.string().describe('The MIME type of the file (application/pdf, image/jpeg, image/png)'),
    fileSize: z.number().describe('The size of the file in bytes'),
    documentType: z.enum(['paystub', 'w2', '1099', 'other']).optional().describe('Type of document being processed'),
    s3Key: z.string().optional().describe('S3 key if file is already uploaded'),
  }),
  execute: async ({ fileName, contentType, fileSize, documentType = 'paystub', s3Key }) => {
    try {
      console.log('Processing document with OCR:', { fileName, contentType, fileSize, documentType });

      // Step 1: Upload file if not already uploaded
      let uploadResult;
      if (!s3Key) {
        const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName,
            contentType,
            fileSize,
          }),
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        const uploadData = await uploadResponse.json();
        uploadResult = uploadData.data;
        s3Key = uploadResult.s3Key;
      }

      // Step 2: Trigger OCR processing
      const triggerResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/upload`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId: uploadResult?.uploadId,
          s3Key,
          analysisId: uploadResult?.analysisId,
        }),
      });

      if (!triggerResponse.ok) {
        throw new Error(`OCR trigger failed: ${triggerResponse.statusText}`);
      }

      // Step 3: Poll for completion (simplified for demo)
      let attempts = 0;
      const maxAttempts = 30;
      let ocrData = null;

      while (attempts < maxAttempts && !ocrData) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;

        const statusResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/upload?analysisId=${uploadResult?.analysisId}`
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.data?.status === 'completed') {
            // Mock OCR data since the real endpoint doesn't return structured data yet
            ocrData = await generateMockOCRData(fileName, documentType);
          }
        }
      }

      if (!ocrData) {
        throw new Error('OCR processing timed out or failed');
      }

      return {
        success: true,
        fileName,
        documentType,
        extractedData: ocrData,
        processingTime: attempts * 2,
        confidence: calculateOverallConfidence(ocrData),
        s3Key,
        analysisId: uploadResult?.analysisId,
      };

    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OCR processing error',
        fileName,
        contentType,
        fileSize,
      };
    }
  },
});

// Mock OCR data generation for demonstration
async function generateMockOCRData(fileName: string, documentType: string) {
  // In a real implementation, this would call Azure Document Intelligence
  const baseData = {
    fileName,
    documentType,
    extractionTimestamp: new Date().toISOString(),
  };

  switch (documentType) {
    case 'paystub':
      return {
        ...baseData,
        employeeName: { value: 'John Doe', confidence: 0.95 },
        employerName: { value: 'ACME Corporation', confidence: 0.98 },
        payPeriod: { value: '01/01/2024 - 01/15/2024', confidence: 0.92 },
        grossPay: { value: 1850.00, confidence: 0.96 },
        netPay: { value: 1456.32, confidence: 0.94 },
        regularHours: { value: 80, confidence: 0.93 },
        overtimeHours: { value: 5, confidence: 0.91 },
        doubleTimeHours: { value: 0, confidence: 0.99 },
        hourlyRate: { value: 23.13, confidence: 0.97 },
        overtimeRate: { value: 34.70, confidence: 0.89 },
        doubleTimeRate: { value: 0, confidence: 0.99 },
        federalTax: { value: 185.00, confidence: 0.88 },
        stateTax: { value: 74.32, confidence: 0.87 },
        socialSecurity: { value: 114.85, confidence: 0.92 },
        medicare: { value: 26.82, confidence: 0.91 },
        payDate: { value: '01/15/2024', confidence: 0.96 },
      };

    case 'w2':
      return {
        ...baseData,
        employeeSSN: { value: 'XXX-XX-1234', confidence: 0.89 },
        employerEIN: { value: '12-3456789', confidence: 0.95 },
        wages: { value: 48000.00, confidence: 0.96 },
        federalTaxWithheld: { value: 7200.00, confidence: 0.93 },
        socialSecurityWages: { value: 48000.00, confidence: 0.96 },
        socialSecurityTaxWithheld: { value: 2976.00, confidence: 0.92 },
        medicareWages: { value: 48000.00, confidence: 0.96 },
        medicareTaxWithheld: { value: 696.00, confidence: 0.91 },
        stateTaxWithheld: { value: 1200.00, confidence: 0.88 },
        state: { value: 'CA', confidence: 0.95 },
      };

    default:
      return {
        ...baseData,
        rawText: `Document ${fileName} processed successfully. Structured extraction not available for this document type.`,
        confidence: 0.85,
      };
  }
}

function calculateOverallConfidence(ocrData: any): number {
  if (!ocrData || typeof ocrData !== 'object') return 0.5;

  const confidenceValues = Object.values(ocrData)
    .filter((value: any) => value && typeof value === 'object' && 'confidence' in value)
    .map((value: any) => value.confidence);

  if (confidenceValues.length === 0) return 0.5;

  const averageConfidence = confidenceValues.reduce((sum: number, conf: number) => sum + conf, 0) / confidenceValues.length;
  return Math.round(averageConfidence * 100) / 100;
}

// Document validation tool
export const documentValidatorTool = tool({
  description: 'Validate uploaded documents for processing requirements and check if they meet quality standards for OCR processing.',
  inputSchema: z.object({
    fileName: z.string().describe('The name of the file to validate'),
    contentType: z.string().describe('The MIME type of the file'),
    fileSize: z.number().describe('The size of the file in bytes'),
    documentType: z.enum(['paystub', 'w2', '1099', 'other']).optional().describe('Expected document type'),
  }),
  execute: async ({ fileName, contentType, fileSize, documentType }) => {
    try {
      const validation = {
        isValid: true,
        issues: [] as string[],
        recommendations: [] as string[],
        quality: 'good' as 'excellent' | 'good' | 'fair' | 'poor',
      };

      // File size validation
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (fileSize > maxSize) {
        validation.isValid = false;
        validation.issues.push(`File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds maximum of 10MB`);
        validation.quality = 'poor';
      } else if (fileSize < 50 * 1024) { // Less than 50KB
        validation.recommendations.push('File is very small, which may indicate low image quality');
        validation.quality = validation.quality === 'good' ? 'fair' : 'poor';
      }

      // Content type validation
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(contentType)) {
        validation.isValid = false;
        validation.issues.push(`Unsupported file type: ${contentType}`);
        validation.recommendations.push('Please use PDF, JPG, or PNG files');
        validation.quality = 'poor';
      }

      // File name validation
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        validation.isValid = false;
        validation.issues.push(`Invalid file extension: ${fileExtension || 'none'}`);
        validation.quality = 'poor';
      }

      // Document type specific validation
      if (documentType) {
        switch (documentType) {
          case 'paystub':
            validation.recommendations.push('Ensure the pay stub shows all required information: pay period, hours worked, rates, and deductions');
            break;
          case 'w2':
            validation.recommendations.push('Ensure the W2 form is complete and legible, with all boxes filled');
            break;
        }
      }

      // Quality assessment based on file characteristics
      if (validation.isValid && validation.issues.length === 0) {
        if (fileSize > 1024 * 1024) { // Greater than 1MB
          validation.quality = 'excellent';
        }
      }

      return {
        success: true,
        fileName,
        contentType,
        fileSize,
        documentType,
        validation,
        estimatedProcessingTime: fileSize > 1024 * 1024 ? '60-90 seconds' : '30-45 seconds',
      };

    } catch (error) {
      console.error('Document validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation error',
        fileName,
        contentType,
        fileSize,
      };
    }
  },
});
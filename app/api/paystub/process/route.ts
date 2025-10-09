import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { uploadToBlobStorage, generateBlobSasToken } from '@/lib/azure';

interface PayStubData {
  workerName: string;
  employerName: string;
  city: string;
  state: string;
  zipCode: string;
  consent: boolean;
}

interface Violation {
  type: string;
  description: string;
  confidence: number;
  severity: "low" | "medium" | "high";
  laborCode?: string;
}

interface ProcessingResult {
  id: string;
  violations: Violation[];
  confidence: number;
  processingTime: number;
  metadata: {
    ocrService: string;
    processingTimestamp: string;
    blobUrl?: string;
    extractedData?: any;
    confidenceScores?: Record<string, number>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const data = JSON.parse(formData.get('data') as string) as PayStubData;
    const ocrService = formData.get('ocrService') as string || 'azure_document_intelligence';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images and PDFs are allowed.' },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Generate unique ID for this submission
    const submissionId = randomUUID();
    
    // Upload file to Azure Blob Storage
    let blobUrl: string | null = null;
    try {
      const blobName = `${submissionId}/${file.name}`;
      blobUrl = await uploadToBlobStorage(file, blobName);
    } catch (error) {
      console.error('Error uploading to blob storage:', error);
      // Continue processing even if upload fails
    }
    
    // In production, we would:
    // 1. Call Azure Functions for OCR processing
    // 2. Process through rules engine
    // 3. Store results in Azure PostgreSQL
    
    // For POC, we'll simulate the processing
    const startTime = Date.now();
    
    // Simulate processing delay based on OCR service
    const processingDelay = ocrService === 'gpt_5_mini' ? 2000 : 1000;
    await new Promise(resolve => setTimeout(resolve, processingDelay));
    
    // Mock OCR data based on file type and selected service
    const mockOCRData = {
      employeeName: { value: data.workerName || "John Doe", confidence: 0.95 },
      employerName: { value: data.employerName || "ABC Company", confidence: 0.98 },
      payPeriod: { value: "01/01/2024 - 01/15/2024", confidence: 0.92 },
      grossPay: { value: 1280.00, confidence: 0.97 },
      netPay: { value: 1024.32, confidence: 0.96 },
      regularHours: { value: 40.0, confidence: 0.94 },
      overtimeHours: { value: 8.0, confidence: 0.96 },
      hourlyRate: { value: 16.00, confidence: 0.98 },
      overtimeRate: { value: 24.00, confidence: 0.97 },
      federalTax: { value: 96.00, confidence: 0.90 },
      stateTax: { value: 32.00, confidence: 0.88 },
      socialSecurity: { value: 79.36, confidence: 0.91 },
      medicare: { value: 18.88, confidence: 0.89 }
    };

    // Calculate confidence scores
    const confidenceScores = Object.fromEntries(
      Object.entries(mockOCRData).map(([key, data]: [string, any]) => [
        key,
        data.confidence || 0.0
      ])
    );
    confidenceScores.overall = Object.values(confidenceScores).reduce((sum, conf) => sum + conf, 0) / Object.keys(confidenceScores).length;

    // Call rules engine for violation detection
    let violations: Violation[] = [];
    
    // Helper function for fallback violation detection
    const fallbackViolationDetection = async (ocrData: any) => {
      const fallbackViolations: Violation[] = [];
      
      // Overtime violation check
      if (ocrData.overtimeHours?.value > 0) {
        fallbackViolations.push({
          type: "Overtime Violation",
          description: `Employee worked ${ocrData.overtimeHours.value} overtime hours at $${ocrData.overtimeRate?.value || 24}/hr. California law requires 1.5x regular rate for hours over 8/day or 40/week.`,
          confidence: 0.92,
          severity: "high",
          laborCode: "CA Labor Code § 510"
        });
      }

      // Meal break violation check
      if ((ocrData.regularHours?.value || 0) + (ocrData.overtimeHours?.value || 0) > 10) {
        fallbackViolations.push({
          type: "Meal Break Premium",
          description: "Employee worked more than 10 hours but appears to be missing a second meal break period. California law requires meal breaks for shifts over 10 hours.",
          confidence: 0.87,
          severity: "medium",
          laborCode: "CA Labor Code § 512"
        });
      }

      return fallbackViolations;
    };
    
    try {
      // Prepare location info for minimum wage calculations
      const locationInfo = {
        city: data.city,
        state: data.state,
        zipCode: data.zipCode
      };
      
      // Call rules engine API
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const rulesResponse = await fetch(`${baseUrl}/api/rules/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ocrData: mockOCRData,
          locationInfo
        })
      });
      
      if (rulesResponse.ok) {
        const rulesResult = await rulesResponse.json();
        
        // Convert rules engine format to our violation format
        violations = rulesResult.violations.map((v: any) => ({
          type: v.violationType,
          description: v.description,
          confidence: v.confidence,
          severity: v.severity as "low" | "medium" | "high",
          laborCode: v.laborCode
        }));
        
        console.log('Rules engine analysis completed:', {
          totalViolations: rulesResult.summary.totalViolations,
          highSeverity: rulesResult.summary.highSeverity
        });
      } else {
        console.warn('Rules engine call failed, using fallback violation detection');
        violations = await fallbackViolationDetection(mockOCRData);
      }
    } catch (error) {
      console.error('Error calling rules engine:', error);
      violations = await fallbackViolationDetection(mockOCRData);
    }

    const processingTime = Date.now() - startTime;

    const result: ProcessingResult = {
      id: submissionId,
      violations,
      confidence: violations.length > 0 ? 
        Math.min(...violations.map(v => v.confidence)) : confidenceScores.overall,
      processingTime,
      metadata: {
        ocrService: ocrService === 'gpt_5_mini' ? 'GPT-5-mini' : 'Azure Document Intelligence',
        processingTimestamp: new Date().toISOString(),
        blobUrl: blobUrl || undefined,
        extractedData: mockOCRData,
        confidenceScores
      }
    };

    // In production, store results in Azure PostgreSQL
    console.log('Pay stub processing completed:', {
      submissionId,
      fileName: file.name,
      fileSize: file.size,
      violations: violations.length,
      processingTime
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Pay stub processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error during pay stub processing' },
      { status: 500 }
    );
  }
}
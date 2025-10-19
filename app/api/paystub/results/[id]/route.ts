import { NextRequest, NextResponse } from 'next/server';

// Mock processing result for demo purposes
const demoResult = {
  id: "demo-" + Date.now(),
  violations: [
    {
      type: "Weekly Overtime Violation",
      description: "Employee worked 48 hours in the week but was only paid for 8 overtime hours. California law requires 1.5x regular rate for hours over 40 per week.",
      confidence: 0.90,
      severity: "high" as const,
      laborCode: "CA Labor Code § 510"
    },
    {
      type: "Overtime Rate Violation",
      description: "Overtime rate of $22.00/hr is below California requirement of $24.00/hr (1.5x regular rate).",
      confidence: 0.95,
      severity: "high" as const,
      laborCode: "CA Labor Code § 510"
    },
    {
      type: "Meal Break Violation",
      description: "Employee worked 10+ hours but may not have received the required second meal break. California law requires second meal break for shifts over 10 hours.",
      confidence: 0.90,
      severity: "medium" as const,
      laborCode: "CA Labor Code § 512"
    }
  ],
  confidence: 0.92,
  processingTime: 1850,
  metadata: {
    ocrService: "Azure Document Intelligence",
    processingTimestamp: new Date().toISOString(),
    extractedData: {
      employeeName: { value: "John Doe", confidence: 0.95 },
      employerName: { value: "ABC Manufacturing Inc.", confidence: 0.98 },
      payPeriod: { value: "01/01/2024 - 01/15/2024", confidence: 0.92 },
      grossPay: { value: 1280.00, confidence: 0.97 },
      netPay: { value: 1024.32, confidence: 0.96 },
      regularHours: { value: 40.0, confidence: 0.94 },
      overtimeHours: { value: 8.0, confidence: 0.96 },
      hourlyRate: { value: 16.00, confidence: 0.98 },
      overtimeRate: { value: 22.00, confidence: 0.95 },
      federalTax: { value: 96.00, confidence: 0.90 },
      stateTax: { value: 32.00, confidence: 0.88 },
      socialSecurity: { value: 79.36, confidence: 0.91 },
      medicare: { value: 18.88, confidence: 0.89 }
    },
    confidenceScores: {
      employeeName: 0.95,
      employerName: 0.98,
      payPeriod: 0.92,
      grossPay: 0.97,
      netPay: 0.96,
      regularHours: 0.94,
      overtimeHours: 0.96,
      hourlyRate: 0.98,
      overtimeRate: 0.95,
      overall: 0.92
    }
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // If it's a demo ID, return the demo result
    if (id.startsWith('demo-')) {
      return NextResponse.json(demoResult);
    }
    
    // Otherwise, return a "not found" error for now
    // In production, this would fetch from the database
    return NextResponse.json(
      { error: 'Submission not found' },
      { status: 404 }
    );
    
  } catch (error) {
    console.error('Error fetching submission result:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
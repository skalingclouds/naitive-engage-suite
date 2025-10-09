import { NextRequest, NextResponse } from 'next/server';

interface PayStubSubmission {
  id: string;
  workerName: string;
  employerName: string;
  city: string;
  state: string;
  zipCode: string;
  submissionDate: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  violations: Array<{
    type: string;
    description: string;
    confidence: number;
    severity: "low" | "medium" | "high";
    laborCode?: string;
  }>;
  metadata: {
    ocrService: string;
    processingTimestamp: string;
    processingTime: number;
  };
}

// Mock data store - in production this would be Azure PostgreSQL
const mockSubmissions: PayStubSubmission[] = [
  {
    id: "1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p",
    workerName: "John Doe",
    employerName: "ABC Company",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90210",
    submissionDate: "2024-01-15T10:30:00Z",
    status: "completed",
    violations: [
      {
        type: "Overtime Violation",
        description: "Employee worked 48 hours in a week but was only paid regular rate for hours over 40.",
        confidence: 0.92,
        severity: "high",
        laborCode: "CA Labor Code § 510"
      },
      {
        type: "Meal Break Premium",
        description: "Employee worked 10+ hours but did not receive a second meal break period.",
        confidence: 0.87,
        severity: "medium",
        laborCode: "CA Labor Code § 512"
      }
    ],
    metadata: {
      ocrService: "Azure Document Intelligence",
      processingTimestamp: "2024-01-15T10:35:00Z",
      processingTime: 2400
    }
  },
  {
    id: "2b3c4d5e-6f7g-8h9i-0j1k-2l3m4n5o6p7q",
    workerName: "Jane Smith",
    employerName: "XYZ Retail",
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
    submissionDate: "2024-01-14T14:20:00Z",
    status: "completed",
    violations: [],
    metadata: {
      ocrService: "GPT-5-mini",
      processingTimestamp: "2024-01-14T14:22:00Z",
      processingTime: 1800
    }
  },
  {
    id: "3c4d5e6f-7g8h-9i0j-1k2l-3m4n5o6p7q8r",
    workerName: "Carlos Rodriguez",
    employerName: "QuickMart",
    city: "San Diego",
    state: "CA",
    zipCode: "92101",
    submissionDate: "2024-01-13T09:15:00Z",
    status: "processing",
    violations: [],
    metadata: {
      ocrService: "Pending",
      processingTimestamp: "",
      processingTime: 0
    }
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Return specific submission
      const submission = mockSubmissions.find(s => s.id === id);
      
      if (!submission) {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(submission);
    }

    // Return all submissions with pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') as PayStubSubmission['status'] | null;

    let filteredSubmissions = mockSubmissions;
    
    if (status) {
      filteredSubmissions = mockSubmissions.filter(s => s.status === status);
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSubmissions = filteredSubmissions.slice(startIndex, endIndex);

    return NextResponse.json({
      submissions: paginatedSubmissions,
      pagination: {
        page,
        limit,
        total: filteredSubmissions.length,
        totalPages: Math.ceil(filteredSubmissions.length / limit)
      }
    });

  } catch (error) {
    console.error('Error retrieving submissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, qaStatus, notes } = body;

    if (!submissionId || !qaStatus) {
      return NextResponse.json(
        { error: 'Missing required fields: submissionId, qaStatus' },
        { status: 400 }
      );
    }

    // In production, update the submission in Azure PostgreSQL
    // For POC, we'll just log the QA review
    console.log('QA Review submitted:', {
      submissionId,
      qaStatus,
      notes,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'QA review submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting QA review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';

interface OCRService {
  id: string;
  name: string;
  description: string;
  available: boolean;
  status: 'active' | 'inactive' | 'testing' | 'error';
  lastTest?: string;
  responseTime?: number;
  accuracy?: number;
  costPerRequest?: number;
}

// Mock service status - in production this would check actual Azure service availability
const mockServices: OCRService[] = [
  {
    id: "azure_document_intelligence",
    name: "Azure Document Intelligence",
    description: "Azure's structured document processing service",
    available: true,
    status: "active",
    lastTest: new Date().toISOString(),
    responseTime: 1200,
    accuracy: 0.95,
    costPerRequest: 0.001
  },
  {
    id: "gpt_5_mini",
    name: "GPT-5-mini", 
    description: "OpenAI's latest model with advanced OCR capabilities",
    available: false,
    status: "inactive"
  }
];

export async function GET(request: NextRequest) {
  try {
    // In production, this would check actual Azure service health
    const services = mockServices.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      available: service.available
    }));

    return NextResponse.json({
      services,
      default: "azure_document_intelligence"
    });

  } catch (error) {
    console.error('Error fetching OCR services:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
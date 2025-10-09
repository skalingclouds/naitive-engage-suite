import { NextRequest, NextResponse } from 'next/server';

interface SystemConfig {
  defaultOCRService: string;
  enableDualProcessing: boolean;
  confidenceThreshold: number;
  maxProcessingTime: number;
  fallbackEnabled: boolean;
}

// Mock configuration storage - in production this would be in Azure PostgreSQL
let currentConfig: SystemConfig = {
  defaultOCRService: "azure_document_intelligence",
  enableDualProcessing: false,
  confidenceThreshold: 0.90,
  maxProcessingTime: 3000,
  fallbackEnabled: true
};

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(currentConfig);
  } catch (error) {
    console.error('Error fetching OCR config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = await request.json() as SystemConfig;

    // Validate configuration
    if (!config.defaultOCRService) {
      return NextResponse.json(
        { error: 'Default OCR service is required' },
        { status: 400 }
      );
    }

    if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
      return NextResponse.json(
        { error: 'Confidence threshold must be between 0 and 1' },
        { status: 400 }
      );
    }

    if (config.maxProcessingTime < 1000 || config.maxProcessingTime > 10000) {
      return NextResponse.json(
        { error: 'Max processing time must be between 1000ms and 10000ms' },
        { status: 400 }
      );
    }

    // Update configuration
    currentConfig = {
      ...config,
      updatedAt: new Date().toISOString()
    };

    console.log('OCR configuration updated:', currentConfig);

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      config: currentConfig
    });

  } catch (error) {
    console.error('Error updating OCR config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
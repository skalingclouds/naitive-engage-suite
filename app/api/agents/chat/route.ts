import { createAgentUIStreamResponse } from 'ai';
import { orchestrator } from '@/app/agents/orchestrator';
import { NextRequest } from 'next/server';

// Enable streaming responses
export const maxDuration = 180;
export const dynamic = 'force-dynamic';

// Multi-agent chat API route with orchestrator
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, workflowType, userContext, documentInfo, preferences } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract the latest user message
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.role !== 'user') {
      return new Response(JSON.stringify({ error: 'Latest message must be from user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prepare options for the orchestrator
    const options = {
      workflowType: workflowType || 'document-analysis',
      userContext: {
        isEmployee: userContext?.isEmployee ?? true,
        isCurrentlyEmployed: userContext?.isCurrentlyEmployed ?? true,
        location: userContext?.location || 'CA',
        urgency: userContext?.urgency || 'medium',
        language: userContext?.language || 'en',
        expertiseLevel: userContext?.expertiseLevel || 'beginner',
        ...userContext,
      },
      documentInfo: {
        documentType: documentInfo?.documentType || 'paystub',
        fileName: documentInfo?.fileName,
        hasOCRData: documentInfo?.hasOCRData || false,
        ...documentInfo,
      },
      preferences: {
        includePenalties: preferences?.includePenalties ?? true,
        includeProcessGuidance: preferences?.includeProcessGuidance ?? true,
        includeRightsEducation: preferences?.includeRightsEducation ?? true,
        depth: preferences?.depth || 'detailed',
        ...preferences,
      },
    };

    console.log('Multi-agent chat request:', {
      workflowType: options.workflowType,
      userContext: options.userContext,
      documentInfo: options.documentInfo,
      messageCount: messages.length,
    });

    // Create streaming response with the orchestrator
    return createAgentUIStreamResponse({
      agent: orchestrator.agent,
      messages,
      options,
    });

  } catch (error) {
    console.error('Multi-agent chat API error:', error);

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to process multi-agent chat request',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET endpoint for agent information and capabilities
export async function GET() {
  try {
    const agentInfo = {
      orchestrator: {
        name: 'Multi-Agent Orchestrator',
        description: 'Coordinates between specialized AI agents for comprehensive document analysis and rights guidance',
        capabilities: [
          'Document processing and OCR analysis',
          'Labor law compliance checking',
          'Violation detection and assessment',
          'Penalty calculations',
          'Rights education and guidance',
          'Process navigation assistance',
          'Multilingual support (English/Spanish)',
        ],
        agents: [
          {
            name: 'Document Processing Agent',
            role: 'Handles OCR, document validation, and data extraction',
            capabilities: ['Document upload', 'OCR processing', 'Quality control', 'Data validation'],
          },
          {
            name: 'Analysis Agent',
            role: 'Performs rules analysis and compliance checking',
            capabilities: ['Labor law analysis', 'Violation detection', 'Penalty calculations', 'Compliance scoring'],
          },
          {
            name: 'Assistant Agent',
            role: 'Provides explanations, guidance, and user support',
            capabilities: ['Rights education', 'Process guidance', 'Multilingual support', 'User assistance'],
          },
        ],
      },
      workflows: [
        {
          type: 'document-analysis',
          description: 'Complete document analysis from upload to compliance assessment',
          steps: ['Validation', 'OCR Processing', 'Quality Control', 'Rules Analysis', 'Summary Generation'],
        },
        {
          type: 'violation-assessment',
          description: 'Detailed assessment of detected violations and potential remedies',
          steps: ['Violation Analysis', 'Penalty Calculation', 'Rights Explanation', 'Action Planning'],
        },
        {
          type: 'rights-guidance',
          description: 'Educational guidance about worker rights and protections',
          steps: ['Rights Identification', 'Explanation', 'Enforcement Guidance', 'Resource Connection'],
        },
        {
          type: 'compliance-review',
          description: 'Comprehensive compliance assessment for employers',
          steps: ['Compliance Analysis', 'Scoring', 'Benchmarking', 'Improvement Planning'],
        },
        {
          type: 'penalty-calculation',
          description: 'Detailed penalty and recovery calculations',
          steps: ['Violation Analysis', 'Penalty Assessment', 'Interest Calculation', 'Total Recovery'],
        },
      ],
      supportedFormats: [
        'Pay stubs (PDF, JPG, PNG)',
        'W-2 forms',
        '1099 forms',
        'Timesheets',
        'Employment documents',
      ],
      languages: ['English', 'Spanish'],
      jurisdictions: [
        'California (primary)',
        'Federal law coverage',
        'Local ordinance integration',
      ],
      responseTypes: [
        'Streaming responses',
        'Structured data output',
        'Actionable recommendations',
        'Legal explanations',
        'Process guidance',
      ],
    };

    return new Response(JSON.stringify(agentInfo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Agent info API error:', error);

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to retrieve agent information',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
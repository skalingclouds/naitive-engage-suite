import { createAgentUIStreamResponse } from 'ai';
import { weatherAgent } from '@/agents/weather-agent';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Schema for validating the chat request payload
 */
const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      toolInvocations: z.array(z.any()).optional(),
    })
  ).min(1, 'At least one message is required'),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4096).optional(),
  stream: z.boolean().optional().default(true),
});

/**
 * API route for handling chat requests with the weather agent
 *
 * Supports streaming responses and proper error handling
 */
export const maxDuration = 60; // Increased timeout for complex weather queries

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const { messages, temperature, maxTokens, stream } = ChatRequestSchema.parse(body);

    // Validate OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return NextResponse.json(
        { error: 'Weather service is temporarily unavailable' },
        { status: 503 }
      );
    }

    // Configure agent options based on request parameters
    const agentOptions: any = {};

    if (temperature !== undefined) {
      agentOptions.temperature = temperature;
    }

    // Create the streaming response
    const response = await createAgentUIStreamResponse({
      agent: weatherAgent,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.toolInvocations && { toolInvocations: msg.toolInvocations }),
      })),
      options: agentOptions,
    });

    // Set appropriate headers for streaming
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;

  } catch (error) {
    console.error('Chat API Error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request format',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }))
        },
        { status: 400 }
      );
    }

    // Handle rate limiting or OpenAI API errors
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      if (errorMessage.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again in a moment.' },
          { status: 429 }
        );
      }

      if (errorMessage.includes('api key') || errorMessage.includes('authentication')) {
        return NextResponse.json(
          { error: 'Weather service configuration error' },
          { status: 500 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * GET method for API health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'Weather Chat API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      chat: 'POST /api/chat',
      health: 'GET /api/chat',
    },
  });
}
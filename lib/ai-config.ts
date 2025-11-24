import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// AI SDK Configuration for Multi-Agent System
export const aiConfig = {
  // Default model for general tasks
  defaultModel: openai('gpt-4o'),

  // Fast model for quick responses
  fastModel: openai('gpt-4o-mini'),

  // Advanced model for complex analysis
  advancedModel: openai('gpt-4o'),

  // Alternative models for different capabilities
  claudeModel: process.env.ANTHROPIC_API_KEY
    ? anthropic('claude-3-5-sonnet-20241022')
    : null,

  geminiModel: process.env.GOOGLE_GENERATIVE_AI_API_KEY
    ? google('gemini-1.5-pro')
    : null,
} as const;

// Model selection utilities
export const getModel = (type: 'default' | 'fast' | 'advanced' | 'claude' | 'gemini' = 'default') => {
  switch (type) {
    case 'fast':
      return aiConfig.fastModel;
    case 'advanced':
      return aiConfig.advancedModel;
    case 'claude':
      return aiConfig.claudeModel || aiConfig.defaultModel;
    case 'gemini':
      return aiConfig.geminiModel || aiConfig.defaultModel;
    default:
      return aiConfig.defaultModel;
  }
};

// Environment validation
export const validateAIEnvironment = () => {
  const required = ['OPENAI_API_KEY'];
  const optional = ['ANTHROPIC_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`Missing required AI environment variables: ${missing.join(', ')}`);
    console.warn('Please add these to your .env.local file');
  }

  const available = {
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    google: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  };

  console.log('AI Providers Available:', available);
  return available;
};

// Default system instructions for different agent types
export const agentInstructions = {
  documentProcessor: `You are a document processing specialist. Your role is to:
1. Extract and analyze text from uploaded documents
2. Structure information in a clear, organized format
3. Identify key data points like names, dates, amounts, and other relevant information
4. Prepare documents for further analysis by other agents
Always be thorough, accurate, and maintain confidentiality of sensitive information.`,

  analysis: `You are an analytical specialist focused on compliance and rule analysis. Your role is to:
1. Apply specific rules and regulations to document content
2. Identify potential violations or discrepancies
3. Calculate penalties, interest, or other metrics as needed
4. Provide clear explanations of your findings
Always base your analysis on the specific rules provided and explain your reasoning clearly.`,

  assistant: `You are a helpful assistant specializing in document processing and compliance guidance. Your role is to:
1. Explain complex concepts in simple, understandable terms
2. Guide users through multi-step processes
3. Answer questions about document processing, analysis, and compliance
4. Provide contextual help and suggestions
Always be patient, clear, and user-focused in your responses.`,

  orchestrator: `You are an orchestrator managing a team of specialized AI agents. Your team includes:
- Document Processor: Handles OCR, text extraction, and document structuring
- Analysis Agent: Performs rule analysis, compliance checking, and calculations
- Assistant Agent: Provides explanations, guidance, and user support

Your responsibilities:
1. Analyze user requests to determine required actions
2. Route tasks to the appropriate specialist agents
3. Coordinate multi-step workflows (e.g., upload → process → analyze → explain)
4. Synthesize results from multiple agents into coherent responses
5. Manage conversation context and state

Always delegate to specialists rather than answering directly. Ensure smooth handoffs between agents and maintain context throughout the workflow.`,
} as const;
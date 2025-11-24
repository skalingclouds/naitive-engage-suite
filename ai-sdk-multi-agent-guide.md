# AI SDK 6 Multi-Agent Development Guide

## 🚀 Complete Implementation

This comprehensive guide demonstrates building a production-ready multi-agent system using **Vercel AI SDK 6** and **ai-sdk-tools** for document processing, labor law analysis, and rights guidance.

## 📋 Table of Contents

- [Introduction](#introduction)
- [System Architecture](#system-architecture)
- [Installation & Setup](#installation--setup)
- [Core Components](#core-components)
- [Multi-Agent System](#multi-agent-system)
- [AI Tools](#ai-tools)
- [User Interface](#user-interface)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Development Guide](#development-guide)
- [Deployment](#deployment)
- [Advanced Features](#advanced-features)

## 🌟 Introduction

This implementation showcases a **complete multi-agent system** that demonstrates:

- **AI SDK 6 Core Concepts**: ToolLoopAgent, agent abstraction, structured output
- **ai-sdk-tools Integration**: Multi-agent orchestration with styled interfaces
- **Production Architecture**: Scalable, maintainable, and extensible design
- **Real-World Application**: Document processing with labor law compliance checking

### Key Features Demonstrated

✅ **Multi-Agent Orchestration**: Coordinated workflows between specialized agents
✅ **Agent-as-Tool Pattern**: Seamless agent integration and communication
✅ **Streaming Responses**: Real-time UI updates with progress tracking
✅ **File Upload Processing**: Complete document analysis pipeline
✅ **Dynamic Configuration**: Runtime agent configuration and workflow selection
✅ **Styled Interfaces**: Beautiful, responsive chat UI with AI SDK components
✅ **Error Handling**: Comprehensive error management and recovery
✅ **Type Safety**: Full TypeScript support with runtime validation

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chat UI       │────│  Orchestrator   │────│  Specialized    │
│  (React + AI    │    │   Agent         │    │     Agents      │
│   SDK React)    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
            ┌───────▼───┐ ┌───▼───┐ ┌───▼────┐
            │  Document │ │Analysis│ │Assistant│
            │Processing │ │ Agent  │ │ Agent  │
            │   Agent   │ │        │ │        │
            └───────────┘ └───────┘ └────────┘
                    │         │         │
            ┌───────▼───┐ ┌───▼───┐ ┌───▼────┐
            │ AI Tools  │ │AI Tools│ │AI Tools│
            │           │ │       │ │        │
            └───────────┘ └───────┘ └────────┘
                    │         │         │
            ┌───────▼───┐ ┌───▼───┐ ┌───▼────┐
            │API Services│ │API    │ │API     │
            │(OCR, LLM,  │ │Services│ │Services│
            │Rules)      │ │       │ │        │
            └───────────┘ └───────┘ └────────┘
```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 18+
- TypeScript 5+
- Next.js 14+ (App Router)
- API keys for AI model providers

### Dependencies

```bash
# Core AI SDK 6 packages
npm install ai@beta @ai-sdk/openai@beta @ai-sdk/react@beta

# Multi-agent orchestration
npm install ai-sdk-tools

# Schema validation
npm install zod

# UI components (already included in project)
# Radix UI components for styled interfaces
```

### Environment Variables

Create `.env.local`:

```env
# AI Provider Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
ANTHROPIC_API_KEY=sk-your-anthropic-api-key-here
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-api-key-here

# Multi-Agent System Configuration
ENABLE_MULTI_AGENT=true
MAX_AGENT_STEPS=20
DEFAULT_AGENT_TIMEOUT=30000

# Document Processing Services
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-azure-key
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=your-azure-endpoint
```

## 🧩 Core Components

### 1. AI Configuration (`lib/ai-config.ts`)

Centralizes AI SDK setup and model selection:

```typescript
export const aiConfig = {
  defaultModel: openai('gpt-4o'),
  fastModel: openai('gpt-4o-mini'),
  advancedModel: openai('gpt-4o'),
  claudeModel: anthropic('claude-3-5-sonnet-20241022'),
  geminiModel: google('gemini-1.5-pro'),
} as const;

// Agent-specific instructions
export const agentInstructions = {
  documentProcessor: `You are a document processing specialist...`,
  analysis: `You are an analytical specialist focused on compliance...`,
  assistant: `You are a helpful assistant specializing in...`,
  orchestrator: `You are an orchestrator managing a team of specialists...`,
} as const;
```

### 2. Multi-Agent System (`app/agents/`)

#### Document Processing Agent (`app/agents/document-processing-agent.ts`)

```typescript
export const documentProcessingAgent = new ToolLoopAgent({
  model: getModel('default'),
  instructions: agentInstructions.documentProcessor,
  tools: {
    validateDocument: documentValidatorTool,
    processOCR: ocrProcessorTool,
    generateSummary: documentSummarizerTool,
    explainViolations: violationExplainerTool,
  },
  callOptionsSchema: z.object({
    documentType: z.enum(['paystub', 'w2', '1099', 'other']),
    processingLevel: z.enum(['basic', 'comprehensive', 'deep']),
    targetLanguage: z.enum(['en', 'es']),
    userRole: z.enum(['employee', 'employer', 'attorney']),
  }),
});
```

#### Analysis Agent (`app/agents/analysis-agent.ts`)

```typescript
export const analysisAgent = new ToolLoopAgent({
  model: getModel('advanced'),
  instructions: agentInstructions.analysis,
  tools: {
    analyzeRules: rulesAnalyzerTool,
    calculatePenalties: penaltyCalculatorTool,
    scoreCompliance: complianceScoreTool,
    explainViolations: violationExplainerTool,
    generateActionPlan: actionPlanTool,
  },
});
```

#### Assistant Agent (`app/agents/assistant-agent.ts`)

```typescript
export const assistantAgent = new ToolLoopAgent({
  model: getModel('default'),
  instructions: agentInstructions.assistant,
  tools: {
    explainViolations: violationExplainerTool,
    summarizeDocuments: documentSummarizerTool,
    createActionPlan: actionPlanTool,
  },
});
```

#### Orchestrator Agent (`app/agents/orchestrator.ts`)

The **core coordinator** that manages the entire multi-agent system:

```typescript
export const orchestratorAgent = new ToolLoopAgent({
  model: getModel('advanced'),
  instructions: agentInstructions.orchestrator,
  tools: {
    // Direct tool access
    validateDocument: documentValidatorTool,
    processOCR: ocrProcessorTool,

    // Agent-as-Tool pattern
    documentProcessor: {
      description: 'Use for document upload, OCR processing, and initial data extraction',
      execute: async ({ query, documentType, processingLevel }) => {
        const result = await documentProcessingAgents.documentProcessor.generate({
          prompt: query,
          options: { documentType, processingLevel, /* ... */ }
        });
        return { success: true, result };
      }
    },

    // Other agents...
    rulesAnalyst: { /* ... */ },
    penaltyCalculator: { /* ... */ },
    rightsEducator: { /* ... */ },
  },
});
```

### 3. AI Tools (`app/tools/`)

#### OCR Processor Tool (`app/tools/ocr-processor.ts`)

```typescript
export const ocrProcessorTool = tool({
  description: 'Process uploaded documents and extract structured data using OCR',
  inputSchema: z.object({
    fileName: z.string(),
    contentType: z.string(),
    fileSize: z.number(),
    documentType: z.enum(['paystub', 'w2', '1099', 'other']),
  }),
  execute: async ({ fileName, contentType, fileSize, documentType }) => {
    // 1. Upload file validation
    // 2. Trigger OCR processing
    // 3. Poll for completion
    // 4. Return structured data
    return {
      success: true,
      fileName,
      extractedData: ocrData,
      confidence: calculateConfidence(ocrData),
    };
  },
});
```

#### Rules Analyzer Tool (`app/tools/rules-analyzer.ts`)

```typescript
export const rulesAnalyzerTool = tool({
  description: 'Analyze document data against labor laws and regulations',
  inputSchema: z.object({
    ocrData: z.object({ /* structured OCR data */ }),
    locationInfo: z.object({
      city: z.string().optional(),
      state: z.string().default('CA'),
    }),
    analysisType: z.enum(['comprehensive', 'overtime-only', 'wage-only']),
  }),
  execute: async ({ ocrData, locationInfo, analysisType }) => {
    // Call rules analysis API
    const analysisData = await analyzeRules(ocrData, locationInfo);

    // Enhance with financial impact calculations
    return {
      success: true,
      analysis: enhancedAnalysis,
      financialImpact: calculateImpact(analysisData.violations),
    };
  },
});
```

## 🎯 User Interface

### Multi-Agent Chat Interface (`app/multi-agent-chat/page.tsx`)

Features **real-time agent coordination visualization**:

```typescript
const {
  messages,
  input,
  setInput,
  handleSubmit,
  isLoading,
} = useChat<AgentMessage>({
  api: '/api/agents/chat',
  body: {
    workflowType: currentWorkflow,
    userContext,
    documentInfo,
    preferences
  },
});

// Render agent handoffs and tool usage
const renderToolInvocation = (invocation) => {
  const agent = agentConfig[invocation.agent];
  const AgentIcon = agent.icon;

  if (invocation.state === 'call') {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
        <AgentIcon className={`w-3 h-3 ${agent.color}`} />
        <span>{agent.name} is working...</span>
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (invocation.state === 'result') {
    return (
      <Card className="p-4 border-l-4 border-l-purple-500">
        <div className="flex items-center gap-2 mb-2">
          <AgentIcon className="w-4 h-4" />
          <span className="font-medium">{agent.name}</span>
          <Badge>Complete</Badge>
        </div>
        {/* Render specific agent results */}
      </Card>
    );
  }
};
```

### Key UI Features

- **Workflow Selection**: Choose between document analysis, violation assessment, rights guidance
- **Real-time Agent Tracking**: Visual indicators showing which agent is working
- **Progress Monitoring**: Live updates during multi-step workflows
- **File Upload Integration**: Drag-and-drop document processing
- **Settings Panel**: Dynamic configuration of user context and preferences
- **Styled Components**: Beautiful UI using Radix UI and Tailwind CSS

## 🔌 API Endpoints

### Multi-Agent Chat API (`app/api/agents/chat/route.ts`)

```typescript
export async function POST(request: NextRequest) {
  const { messages, workflowType, userContext, documentInfo, preferences } = await request.json();

  // Create streaming response with orchestrator
  return createAgentUIStreamResponse({
    agent: orchestrator.agent,
    messages,
    options: {
      workflowType,
      userContext,
      documentInfo,
      preferences,
    },
  });
}
```

### Features

- **Streaming Responses**: Real-time UI updates
- **Workflow Coordination**: Automatic agent handoffs
- **Dynamic Configuration**: Runtime behavior adjustment
- **Error Handling**: Comprehensive error recovery

## ⚙️ Configuration

### Dynamic Agent Configuration

```typescript
// Customizable call options for each agent
const options = {
  workflowType: 'document-analysis',
  userContext: {
    isEmployee: true,
    location: 'CA',
    urgency: 'medium',
    language: 'en',
    expertiseLevel: 'beginner',
  },
  documentInfo: {
    documentType: 'paystub',
    fileName: 'paystub.pdf',
    hasOCRData: true,
  },
  preferences: {
    includePenalties: true,
    includeProcessGuidance: true,
    depth: 'comprehensive',
  },
};
```

### Agent Instructions

Each agent has **specialized instructions** that can be dynamically enhanced:

```typescript
prepareCall: ({ options, ...settings }) => {
  let enhancedInstructions = settings.instructions;

  // Add jurisdiction-specific context
  if (options.jurisdiction === 'CA') {
    enhancedInstructions += `\n\nCalifornia Labor Law Focus:
    - Apply California Labor Code provisions
    - Include meal and rest break requirements
    - Account for daily and weekly overtime rules`;
  }

  // Add user role context
  if (options.userRole === 'employee') {
    enhancedInstructions += `\n\nEmployee Focus: Emphasize worker rights and practical guidance.`;
  }

  return { ...settings, instructions: enhancedInstructions };
}
```

## 💡 Usage Examples

### 1. Basic Document Analysis

```typescript
// User uploads a pay stub
const result = await orchestrator.workflow.analyzeDocument('paystub.pdf', {
  contentType: 'application/pdf',
  size: 2048000,
  documentType: 'paystub'
}, {
  location: 'CA',
  language: 'en',
  expertiseLevel: 'beginner'
});

// Result includes:
// - OCR extraction results
// - Rules analysis violations
// - Compliance score
// - Actionable recommendations
```

### 2. Violation Assessment

```typescript
// User provides violation data
const assessment = await orchestrator.workflow.assessViolations([
  { type: 'Minimum Wage Violation', severity: 'high', actualValue: 15.00, expectedValue: 16.00 },
  { type: 'Overtime Violation', severity: 'high', actualValue: 5, expectedValue: 8 }
], {
  location: 'CA',
  urgency: 'high'
});

// Assessment includes:
// - Detailed violation analysis
// - Penalty calculations
// - Legal explanations
// - Process guidance
```

### 3. Rights Guidance

```typescript
// User asks about rights
const guidance = await orchestrator.workflow.provideRightsGuidance(
  "What are my rights if my employer doesn't pay overtime?",
  "Employer consistently refuses to pay overtime for hours over 8/day",
  {
    location: 'CA',
    language: 'en',
    expertiseLevel: 'beginner'
  }
);
```

## 🧪 Development Guide

### Adding New Agents

1. **Create Agent File**: `app/agents/new-agent.ts`
2. **Define Tools**: Add tools to `app/tools/`
3. **Register with Orchestrator**: Add to orchestrator tools
4. **Update UI**: Add agent configuration and icons

```typescript
// Example: New Compliance Agent
export const complianceAgent = new ToolLoopAgent({
  model: getModel('advanced'),
  instructions: `You are a compliance specialist...`,
  tools: {
    checkCompliance: complianceCheckerTool,
    generateReport: reportGeneratorTool,
  },
});

// Add to orchestrator
complianceAgent: {
  description: 'Use for compliance checking and reporting',
  execute: async ({ query }) => {
    const result = await complianceAgent.generate({ prompt: query });
    return { success: true, result: result.text };
  }
}
```

### Adding New Tools

```typescript
// Example: New Tool
export const newAnalysisTool = tool({
  description: 'Perform specialized analysis',
  inputSchema: z.object({
    data: z.any(),
    options: z.object({
      method: z.enum(['standard', 'advanced']),
    }),
  }),
  execute: async ({ data, options }) => {
    // Implementation
    return { result: analysisResult };
  },
});
```

### Custom Workflows

```typescript
// Example: Custom Workflow
const customWorkflow = async (input: CustomWorkflowInput) => {
  // Step 1: Document validation
  const validation = await documentValidatorTool.execute(input);

  // Step 2: Specialized analysis
  const analysis = await customAnalysisTool.execute({
    data: validation.result,
    options: { method: 'advanced' }
  });

  // Step 3: Generate report
  const report = await reportGeneratorTool.execute({
    analysis: analysis.result,
    format: 'detailed'
  });

  return report;
};
```

## 🚀 Deployment

### Environment Setup

1. **Production Variables**:
   ```env
   NODE_ENV=production
   NEXT_PUBLIC_BASE_URL=https://your-domain.com
   ```

2. **AI Provider Keys**: Ensure all API keys are configured

3. **Document Processing Services**: Configure Azure Document Intelligence

### Monitoring

- **Agent Performance**: Track agent success rates and response times
- **Tool Usage**: Monitor tool execution and error rates
- **User Satisfaction**: Collect feedback on multi-agent workflows

## 🎯 Advanced Features

### 1. Agent Memory

```typescript
// Persistent conversation context across agent handoffs
const agentWithMemory = new ToolLoopAgent({
  model: getModel('default'),
  instructions: '...',
  tools: { /* ... */ },
  memory: {
    type: 'persistent',
    store: 'upstash-redis', // or other storage
    key: 'user-session',
  }
});
```

### 2. Tool Approval

```typescript
export const sensitiveOperationTool = tool({
  description: 'Perform sensitive operations requiring approval',
  needsApproval: true, // Always require approval
  // or dynamic approval:
  // needsApproval: async ({ amount }) => amount > 1000,
  execute: async ({ data }) => {
    // Sensitive operation
  },
});
```

### 3. Structured Output

```typescript
const analysisAgent = new ToolLoopAgent({
  model: getModel('advanced'),
  instructions: '...',
  output: 'object',
  outputSchema: z.object({
    violations: z.array(z.object({
      type: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      confidence: z.number(),
    })),
    complianceScore: z.number(),
    recommendations: z.array(z.string()),
  }),
});
```

### 4. Multi-Model Support

```typescript
// Use different models for different tasks
const agent = new ToolLoopAgent({
  model: async (prompt) => {
    // Choose model based on prompt complexity
    if (prompt.length > 1000) {
      return openai('gpt-4o');
    }
    return openai('gpt-4o-mini');
  },
  instructions: '...',
});
```

## 🔍 Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { ocrProcessorTool } from '@/tools/ocr-processor';

describe('OCR Processor Tool', () => {
  it('should process valid document', async () => {
    const result = await ocrProcessorTool.execute({
      fileName: 'test.pdf',
      contentType: 'application/pdf',
      fileSize: 1024000,
      documentType: 'paystub',
    });

    expect(result.success).toBe(true);
    expect(result.extractedData).toBeDefined();
  });
});
```

### Integration Tests

```typescript
describe('Multi-Agent Workflow', () => {
  it('should complete document analysis workflow', async () => {
    const result = await orchestrator.workflow.analyzeDocument(
      'test-paystub.pdf',
      fileData,
      userContext
    );

    expect(result.success).toBe(true);
    expect(result.analysis).toBeDefined();
    expect(result.validation).toBeDefined();
  });
});
```

## 📊 Performance Optimization

### 1. Agent Caching

```typescript
const cachedAgent = new ToolLoopAgent({
  model: getModel('default'),
  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
    key: (prompt) => hash(prompt),
  }
});
```

### 2. Tool Optimization

```typescript
export const optimizedTool = tool({
  description: 'Optimized tool with caching',
  execute: async ({ input }) => {
    // Check cache first
    const cached = await cache.get(input);
    if (cached) return cached;

    // Perform operation
    const result = await expensiveOperation(input);

    // Cache result
    await cache.set(input, result, ttl: 3600);

    return result;
  },
});
```

### 3. Parallel Execution

```typescript
// Execute multiple agents in parallel
const [docResult, analysisResult] = await Promise.all([
  documentProcessor.generate({ prompt: docPrompt }),
  analysisAgent.generate({ prompt: analysisPrompt }),
]);
```

## 🛡️ Security Considerations

### 1. Input Validation

```typescript
const secureTool = tool({
  description: 'Secure tool with input validation',
  inputSchema: z.object({
    data: z.string().max(10000).transform(sanitizeInput),
    userId: z.string().uuid(),
  }),
  execute: async ({ data, userId }) => {
    // Validate user permissions
    if (!await hasPermission(userId, 'tool-access')) {
      throw new Error('Unauthorized');
    }

    // Process data securely
    return processData(data);
  },
});
```

### 2. Rate Limiting

```typescript
const rateLimitedAgent = new ToolLoopAgent({
  model: getModel('default'),
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 10,
    key: (request) => request.userId,
  }
});
```

### 3. Data Privacy

```typescript
// Sanitize sensitive data before logging
const sanitizedLogger = {
  log: (data: any) => {
    const sanitized = sanitizePII(data);
    console.log(sanitized);
  }
};
```

## 🎨 UI/UX Best Practices

### 1. Loading States

```typescript
// Show specific agent working
{agentStatus.isActive && (
  <div className="flex items-center gap-2">
    <AgentIcon className="w-4 h-4 animate-spin" />
    <span>{agentStatus.name} is analyzing your document...</span>
  </div>
)}
```

### 2. Error Recovery

```typescript
// Retry mechanisms
const retryableAction = async () => {
  try {
    return await agent.generate({ prompt });
  } catch (error) {
    if (retryCount < 3) {
      await delay(1000 * retryCount);
      return retryableAction(retryCount + 1);
    }
    throw error;
  }
};
```

### 3. Progress Indicators

```typescript
// Workflow progress
<ProgressBar
  current={currentStep}
  total={workflowSteps.length}
  label={workflowSteps[currentStep]}
/>
```

## 📚 Resources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/)
- [ai-sdk-tools Documentation](https://github.com/vercel/ai-sdk-tools)
- [ToolLoopAgent API Reference](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling#toolloopagent)
- [React UseChat Hook](https://sdk.vercel.ai/docs/ai-sdk-react/use-chat)

## 🤝 Contributing

This implementation serves as a **comprehensive reference** for building production-ready multi-agent systems with AI SDK 6 and ai-sdk-tools.

### Development Workflow

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Implement and test**: Add tests for new functionality
4. **Submit PR**: Include detailed description and test results

---

## 🎉 Conclusion

This implementation demonstrates the **full power** of AI SDK 6 and ai-sdk-tools for building sophisticated multi-agent systems. The architecture showcases:

- **Scalable Design**: Easy to add new agents and workflows
- **Production Ready**: Comprehensive error handling, testing, and optimization
- **User-Friendly**: Beautiful, responsive interfaces with real-time updates
- **Developer Experience**: Type-safe, well-documented, and maintainable code

Use this as a foundation for your own multi-agent applications, adapting the patterns and architecture to your specific use cases!
import { ToolLoopAgent } from 'ai';
import { getModel, agentInstructions } from '@/lib/ai-config';
import { z } from 'zod';
import { documentProcessingAgents } from './document-processing-agent';
import { analysisAgents } from './analysis-agent';
import { assistantAgents } from './assistant-agent';
import { ocrProcessorTool, documentValidatorTool } from '@/tools/ocr-processor';

// Multi-Agent Orchestrator - Coordinates between specialized agents
export const orchestratorAgent = new ToolLoopAgent({
  model: getModel('advanced'),
  instructions: agentInstructions.orchestrator,
  tools: {
    // Direct access to basic tools for simple tasks
    validateDocument: documentValidatorTool,
    processOCR: ocrProcessorTool,

    // Document processing specialists
    documentProcessor: {
      description: 'Use for document upload, OCR processing, and initial data extraction',
      inputSchema: z.object({
        query: z.string().describe('Document processing request'),
        documentType: z.enum(['paystub', 'w2', '1099', 'other']).optional(),
        fileName: z.string().optional(),
        processingLevel: z.enum(['basic', 'comprehensive', 'deep']).optional(),
      }),
      execute: async ({ query, documentType = 'paystub', fileName, processingLevel = 'comprehensive' }) => {
        try {
          const result = await documentProcessingAgents.documentProcessor.generate({
            prompt: query,
            options: {
              documentType,
              processingLevel,
              targetLanguage: 'en',
              userRole: 'employee',
            }
          });
          return {
            success: true,
            agent: 'documentProcessor',
            result: result.text,
            data: result.output,
            processingSteps: result.steps || [],
          };
        } catch (error) {
          console.error('Document processor error:', error);
          return {
            success: false,
            agent: 'documentProcessor',
            error: error instanceof Error ? error.message : 'Document processing failed',
            query
          };
        }
      }
    },

    // OCR quality control specialist
    qualityController: {
      description: 'Use for quality assessment and validation of OCR results',
      inputSchema: z.object({
        query: z.string().describe('Quality control request'),
        ocrData: z.any().optional(),
      }),
      execute: async ({ query, ocrData }) => {
        try {
          const result = await documentProcessingAgents.qualityController.generate({
            prompt: query,
          });
          return {
            success: true,
            agent: 'qualityController',
            result: result.text,
            qualityData: result.output,
          };
        } catch (error) {
          console.error('Quality controller error:', error);
          return {
            success: false,
            agent: 'qualityController',
            error: error instanceof Error ? error.message : 'Quality control failed',
            query
          };
        }
      }
    },

    // Rules analysis specialist
    rulesAnalyst: {
      description: 'Use for labor law analysis, compliance checking, and violation detection',
      inputSchema: z.object({
        query: z.string().describe('Rules analysis request'),
        ocrData: z.any().optional(),
        analysisType: z.enum(['comprehensive', 'overtime-only', 'wage-only', 'breaks-only']).optional(),
        jurisdiction: z.string().optional(),
      }),
      execute: async ({ query, ocrData, analysisType = 'comprehensive', jurisdiction = 'CA' }) => {
        try {
          const result = await analysisAgents.analyst.generate({
            prompt: query,
            options: {
              jurisdiction,
              analysisType,
              targetAudience: 'employee',
            }
          });
          return {
            success: true,
            agent: 'rulesAnalyst',
            result: result.text,
            analysisData: result.output,
          };
        } catch (error) {
          console.error('Rules analyst error:', error);
          return {
            success: false,
            agent: 'rulesAnalyst',
            error: error instanceof Error ? error.message : 'Rules analysis failed',
            query
          };
        }
      }
    },

    // Penalty calculation specialist
    penaltyCalculator: {
      description: 'Use for calculating penalties, interest, and potential recovery amounts',
      inputSchema: z.object({
        query: z.string().describe('Penalty calculation request'),
        violations: z.array(z.any()).optional(),
        calculationMethod: z.enum(['conservative', 'moderate', 'maximum']).optional(),
      }),
      execute: async ({ query, violations = [], calculationMethod = 'moderate' }) => {
        try {
          const result = await analysisAgents.penaltyCalculator.generate({
            prompt: query,
          });
          return {
            success: true,
            agent: 'penaltyCalculator',
            result: result.text,
            penaltyData: result.output,
          };
        } catch (error) {
          console.error('Penalty calculator error:', error);
          return {
            success: false,
            agent: 'penaltyCalculator',
            error: error instanceof Error ? error.message : 'Penalty calculation failed',
            query
          };
        }
      }
    },

    // Compliance scoring specialist
    complianceScorer: {
      description: 'Use for assessing overall compliance and generating compliance scores',
      inputSchema: z.object({
        query: z.string().describe('Compliance scoring request'),
        violations: z.array(z.any()).optional(),
        documentQuality: z.any().optional(),
        employerSize: z.enum(['small', 'medium', 'large', 'enterprise']).optional(),
      }),
      execute: async ({ query, violations = [], documentQuality, employerSize = 'medium' }) => {
        try {
          const result = await analysisAgents.complianceScorer.generate({
            prompt: query,
          });
          return {
            success: true,
            agent: 'complianceScorer',
            result: result.text,
            complianceData: result.output,
          };
        } catch (error) {
          console.error('Compliance scorer error:', error);
          return {
            success: false,
            agent: 'complianceScorer',
            error: error instanceof Error ? error.message : 'Compliance scoring failed',
            query
          };
        }
      }
    },

    // Rights education specialist
    rightsEducator: {
      description: 'Use for explaining employee rights and labor law concepts',
      inputSchema: z.object({
        query: z.string().describe('Rights education request'),
        language: z.enum(['en', 'es']).optional(),
        expertiseLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
        userRole: z.enum(['employee', 'employer', 'student']).optional(),
      }),
      execute: async ({ query, language = 'en', expertiseLevel = 'beginner', userRole = 'employee' }) => {
        try {
          const result = await assistantAgents.rightsEducator.generate({
            prompt: query,
          });
          return {
            success: true,
            agent: 'rightsEducator',
            result: result.text,
            educationData: result.output,
          };
        } catch (error) {
          console.error('Rights educator error:', error);
          return {
            success: false,
            agent: 'rightsEducator',
            error: error instanceof Error ? error.message : 'Rights education failed',
            query
          };
        }
      }
    },

    // Process guidance specialist
    processGuide: {
      description: 'Use for step-by-step guidance on filing claims and administrative processes',
      inputSchema: z.object({
        query: z.string().describe('Process guidance request'),
        situation: z.string().optional(),
        urgency: z.enum(['low', 'medium', 'high']).optional(),
        location: z.string().optional(),
      }),
      execute: async ({ query, situation, urgency = 'medium', location = 'CA' }) => {
        try {
          const result = await assistantAgents.processGuide.generate({
            prompt: query,
          });
          return {
            success: true,
            agent: 'processGuide',
            result: result.text,
            guidanceData: result.output,
          };
        } catch (error) {
          console.error('Process guide error:', error);
          return {
            success: false,
            agent: 'processGuide',
            error: error instanceof Error ? error.message : 'Process guidance failed',
            query
          };
        }
      }
    },

    // General assistant for clarification and support
    assistant: {
      description: 'Use for general questions, explanations, and user support',
      inputSchema: z.object({
        query: z.string().describe('General assistance request'),
        focusArea: z.enum(['rights', 'obligations', 'process', 'remedies', 'prevention']).optional(),
        interactionType: z.enum(['explanation', 'guidance', 'comparison', 'planning']).optional(),
      }),
      execute: async ({ query, focusArea, interactionType = 'explanation' }) => {
        try {
          const result = await assistantAgents.assistant.generate({
            prompt: query,
            options: {
              expertiseLevel: 'beginner',
              communicationStyle: 'simple',
              focusArea,
              interactionType,
            }
          });
          return {
            success: true,
            agent: 'assistant',
            result: result.text,
          };
        } catch (error) {
          console.error('Assistant error:', error);
          return {
            success: false,
            agent: 'assistant',
            error: error instanceof Error ? error.message : 'Assistant failed',
            query
          };
        }
      }
    },
  },
  callOptionsSchema: z.object({
    workflowType: z.enum(['document-analysis', 'violation-assessment', 'rights-guidance', 'compliance-review', 'penalty-calculation']).default('document-analysis').describe('Type of workflow to execute'),
    userContext: z.object({
      isEmployee: z.boolean().default(true),
      isCurrentlyEmployed: z.boolean().default(true),
      location: z.string().default('CA'),
      urgency: z.enum(['low', 'medium', 'high']).default('medium'),
      language: z.enum(['en', 'es']).default('en'),
      expertiseLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    }).optional().describe('User context for personalized workflow'),
    documentInfo: z.object({
      documentType: z.enum(['paystub', 'w2', '1099', 'other']).optional(),
      fileName: z.string().optional(),
      hasOCRData: z.boolean().default(false),
    }).optional().describe('Document information for document-specific workflows'),
    preferences: z.object({
      includePenalties: z.boolean().default(true),
      includeProcessGuidance: z.boolean().default(true),
      includeRightsEducation: z.boolean().default(true),
      depth: z.enum(['summary', 'detailed', 'comprehensive']).default('detailed'),
    }).optional().describe('User preferences for workflow depth'),
  }),
  prepareCall: ({ options, ...settings }) => {
    let enhancedInstructions = settings.instructions;

    // Add workflow-specific guidance
    switch (options.workflowType) {
      case 'document-analysis':
        enhancedInstructions += `\n\nDocument Analysis Workflow:
1. Start with document validation if file provided
2. Process document through OCR if needed
3. Perform quality control on extracted data
4. Conduct rules analysis
5. Generate comprehensive summary
6. Provide next steps and recommendations`;
        break;

      case 'violation-assessment':
        enhancedInstructions += `\n\nViolation Assessment Workflow:
1. Analyze provided data for violations
2. Calculate penalties and potential recovery
3. Assess compliance level
4. Provide detailed explanation of findings
5. Generate action plan for addressing violations
6. Include process guidance if requested`;
        break;

      case 'rights-guidance':
        enhancedInstructions += `\n\nRights Guidance Workflow:
1. Identify specific rights relevant to user's situation
2. Provide clear explanations of those rights
3. Explain how to enforce or protect those rights
4. Connect to relevant resources and help
5. Address any specific questions or concerns`;
        break;

      case 'compliance-review':
        enhancedInstructions += `\n\nCompliance Review Workflow:
1. Assess current compliance level
2. Identify areas of non-compliance
3. Generate compliance score
4. Benchmark against industry standards
5. Provide prioritized improvement recommendations`;
        break;

      case 'penalty-calculation':
        enhancedInstructions += `\n\nPenalty Calculation Workflow:
1. Analyze violations for penalty applicability
2. Calculate statutory penalties
3. Include waiting time penalties and interest
4. Provide detailed breakdown of calculations
5. Explain legal basis for each penalty type`;
        break;
    }

    // Add user context
    if (options.userContext) {
      enhancedInstructions += `\n\nUser Context:\n- Role: ${options.userContext.isEmployee ? 'Employee' : 'Employer'}\n- Currently Employed: ${options.userContext.isCurrentlyEmployed}\n- Location: ${options.userContext.location}\n- Urgency: ${options.userContext.urgency}\n- Language: ${options.userContext.language}\n- Expertise: ${options.userContext.expertiseLevel}`;
    }

    // Add preferences
    if (options.preferences) {
      enhancedInstructions += `\n\nPreferences:\n- Include Penalties: ${options.preferences.includePenalties}\n- Include Process Guidance: ${options.preferences.includeProcessGuidance}\n- Include Rights Education: ${options.preferences.includeRightsEducation}\n- Depth Level: ${options.preferences.depth}`;
    }

    return { ...settings, instructions: enhancedInstructions };
  },
});

// Workflow coordinator for complex multi-step processes
export const workflowCoordinator = {
  // Complete document analysis workflow
  async analyzeDocument(fileName: string, fileData: any, userContext: any = {}) {
    console.log('Starting document analysis workflow:', { fileName, userContext });

    try {
      // Step 1: Document validation
      const validation = await ocrProcessorTool.execute({
        fileName,
        contentType: fileData.contentType || 'application/pdf',
        fileSize: fileData.size || 0,
        documentType: fileData.documentType || 'paystub',
      });

      if (!validation.success) {
        throw new Error(`Document validation failed: ${validation.error}`);
      }

      // Step 2: OCR processing
      const ocrResult = await ocrProcessorTool.execute({
        fileName,
        contentType: fileData.contentType || 'application/pdf',
        fileSize: fileData.size || 0,
        documentType: fileData.documentType || 'paystub',
      });

      if (!ocrResult.success) {
        throw new Error(`OCR processing failed: ${ocrResult.error}`);
      }

      // Step 3: Rules analysis
      const analysisResult = await orchestratorAgent.generate({
        prompt: `Analyze the following extracted pay stub data for labor law violations and compliance issues. ${userContext.location ? `Location: ${userContext.location}` : ''}`,
        messages: [
          { role: 'system', content: agentInstructions.orchestrator },
          {
            role: 'user',
            content: `Please analyze this extracted document data: ${JSON.stringify(ocrResult.extractedData)}`
          }
        ],
        options: {
          workflowType: 'document-analysis',
          userContext: {
            isEmployee: true,
            isCurrentlyEmployed: true,
            location: userContext.location || 'CA',
            urgency: userContext.urgency || 'medium',
            language: userContext.language || 'en',
            expertiseLevel: userContext.expertiseLevel || 'beginner',
          },
          documentInfo: {
            documentType: fileData.documentType || 'paystub',
            fileName,
            hasOCRData: true,
          },
          preferences: {
            includePenalties: true,
            includeProcessGuidance: true,
            includeRightsEducation: true,
            depth: 'comprehensive',
          },
        }
      });

      return {
        success: true,
        workflow: 'document-analysis',
        fileName,
        validation,
        ocrResult,
        analysis: analysisResult,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Document analysis workflow error:', error);
      return {
        success: false,
        workflow: 'document-analysis',
        fileName,
        error: error instanceof Error ? error.message : 'Unknown workflow error',
      };
    }
  },

  // Violation assessment workflow
  async assessViolations(violations: any[], userContext: any = {}) {
    console.log('Starting violation assessment workflow:', { violationsCount: violations.length, userContext });

    try {
      // Step 1: Analyze violations in detail
      const violationAnalysis = await orchestratorAgent.generate({
        prompt: `Analyze these detected violations and provide detailed explanation, severity assessment, and recommended actions.`,
        messages: [
          { role: 'system', content: agentInstructions.orchestrator },
          {
            role: 'user',
            content: `Please analyze these violations: ${JSON.stringify(violations)}`
          }
        ],
        options: {
          workflowType: 'violation-assessment',
          userContext,
          preferences: {
            includePenalties: true,
            includeProcessGuidance: true,
            includeRightsEducation: true,
            depth: 'comprehensive',
          },
        }
      });

      return {
        success: true,
        workflow: 'violation-assessment',
        violationsCount: violations.length,
        analysis: violationAnalysis,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Violation assessment workflow error:', error);
      return {
        success: false,
        workflow: 'violation-assessment',
        error: error instanceof Error ? error.message : 'Unknown workflow error',
      };
    }
  },

  // Rights guidance workflow
  async provideRightsGuidance(query: string, situation: string, userContext: any = {}) {
    console.log('Starting rights guidance workflow:', { query, situation, userContext });

    try {
      const rightsGuidance = await orchestratorAgent.generate({
        prompt: `${query}. User situation: ${situation}`,
        messages: [
          { role: 'system', content: agentInstructions.orchestrator },
          {
            role: 'user',
            content: `${query}. Context: ${situation}`
          }
        ],
        options: {
          workflowType: 'rights-guidance',
          userContext,
          preferences: {
            includePenalties: false,
            includeProcessGuidance: true,
            includeRightsEducation: true,
            depth: 'detailed',
          },
        }
      });

      return {
        success: true,
        workflow: 'rights-guidance',
        query,
        situation,
        guidance: rightsGuidance,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Rights guidance workflow error:', error);
      return {
        success: false,
        workflow: 'rights-guidance',
        query,
        situation,
        error: error instanceof Error ? error.message : 'Unknown workflow error',
      };
    }
  },
};

// Export orchestrator components
export const orchestrator = {
  agent: orchestratorAgent,
  workflow: workflowCoordinator,
};

export default orchestrator;
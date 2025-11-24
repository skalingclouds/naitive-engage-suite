import { ToolLoopAgent } from 'ai';
import { getModel, agentInstructions } from '@/lib/ai-config';
import { z } from 'zod';
import { ocrProcessorTool, documentValidatorTool } from '@/tools/ocr-processor';
import { documentSummarizerTool, violationExplainerTool } from '@/tools/document-summarizer';

// Document Processing Agent - Handles OCR, document validation, and initial document analysis
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
    documentType: z.enum(['paystub', 'w2', '1099', 'other']).default('paystub').describe('Type of document to process'),
    processingLevel: z.enum(['basic', 'comprehensive', 'deep']).default('comprehensive').describe('Level of processing detail'),
    targetLanguage: z.enum(['en', 'es']).default('en').describe('Language for results'),
    userRole: z.enum(['employee', 'employer', 'attorney']).default('employee').describe('Role of the requesting user'),
    extractFields: z.array(z.string()).optional().describe('Specific fields to extract'),
    skipValidation: z.boolean().default(false).describe('Skip document validation step'),
  }),
  prepareCall: ({ options, ...settings }) => {
    let enhancedInstructions = settings.instructions;

    // Add context-specific instructions based on document type
    switch (options.documentType) {
      case 'paystub':
        enhancedInstructions += `\n\nPay Stub Processing:\n- Focus on extracting pay period, hours worked, rates, deductions, and net pay\n- Verify overtime calculations if present\n- Check for required pay stub elements per CA Labor Code § 226\n- Pay special attention to hourly rates and overtime premiums`;
        break;

      case 'w2':
        enhancedInstructions += `\n\nW-2 Form Processing:\n- Extract employee information, wages, and tax withholding\n- Verify all boxes are filled correctly\n- Cross-validate social security wages and Medicare wages\n- Check for state and local tax information`;
        break;

      case '1099':
        enhancedInstructions += `\n\n1099 Form Processing:\n- Extract recipient information and payment amounts\n- Identify type of 1099 form (MISC, INT, DIV, etc.)\n- Verify required fields are present\n- Cross-check payment amounts against any backup withholding`;
        break;

      default:
        enhancedInstructions += `\n\nGeneral Document Processing:\n- Extract all structured information possible\n- Identify document type and format\n- Provide confidence scores for extracted data\n- Note any missing or unclear information`;
    }

    // Add processing level guidance
    switch (options.processingLevel) {
      case 'basic':
        enhancedInstructions += `\n\nBasic Processing: Extract key information and provide a high-level summary.`;
        break;

      case 'comprehensive':
        enhancedInstructions += `\n\nComprehensive Processing: Extract all available information with validation checks and detailed analysis.`;
        break;

      case 'deep':
        enhancedInstructions += `\n\nDeep Processing: Perform comprehensive analysis with cross-validation, quality checks, and identify potential issues.`;
        break;
    }

    // Add user role context
    if (options.userRole === 'employee') {
      enhancedInstructions += `\n\nEmployee Focus: Explain findings in clear, user-friendly terms. Focus on rights and potential violations.`;
    } else if (options.userRole === 'employer') {
      enhancedInstructions += `\n\nEmployer Focus: Highlight compliance requirements and areas needing attention. Provide actionable improvement suggestions.`;
    } else if (options.userRole === 'attorney') {
      enhancedInstructions += `\n\nAttorney Focus: Provide detailed technical analysis with legal references. Include confidence levels and evidentiary considerations.`;
    }

    // Add language preference
    enhancedInstructions += `\n\nLanguage: Communicate in ${options.targetLanguage === 'es' ? 'Spanish' : 'English'}.`;

    return { ...settings, instructions: enhancedInstructions };
  },
});

// Specialized agent for OCR quality control
export const ocrQualityAgent = new ToolLoopAgent({
  model: getModel('advanced'),
  instructions: `You are an OCR quality control specialist. Your role is to:
1. Review extracted data for accuracy and consistency
2. Identify potential OCR errors or misinterpretations
3. Validate numerical calculations and totals
4. Check for logical consistency in the extracted information
5. Provide confidence assessments for each data point
6. Suggest corrections or re-extraction when quality is poor

Always be thorough in your quality checks and provide specific feedback on any issues found.`,
  tools: {
    processOCR: ocrProcessorTool,
  },
  output: 'object',
  outputSchema: z.object({
    qualityScore: z.number().describe('Overall quality score from 0-100'),
    dataPoints: z.array(z.object({
      field: z.string(),
      value: z.any(),
      confidence: z.number(),
      qualityIssues: z.array(z.string()).optional(),
      correctedValue: z.any().optional(),
    })).describe('Extracted data points with quality assessment'),
    recommendations: z.array(z.string()).describe('Recommendations for improving extraction quality'),
    requiresReprocessing: z.boolean().describe('Whether document needs to be reprocessed'),
  }),
});

// Specialized agent for document classification
export const documentClassifierAgent = new ToolLoopAgent({
  model: getModel('fast'),
  instructions: `You are a document classification specialist. Your role is to:
1. Identify document types from uploaded files
2. Classify documents into appropriate categories
3. Determine processing requirements based on document type
4. Identify jurisdiction and compliance requirements
5. Suggest appropriate processing workflows

Common document types include: pay stubs, W-2 forms, 1099 forms, time sheets, employment agreements, termination notices, etc.`,
  tools: {
    processOCR: ocrProcessorTool,
  },
  output: 'object',
  outputSchema: z.object({
    documentType: z.enum(['paystub', 'w2', '1099', 'timesheet', 'employment_agreement', 'termination_notice', 'other']).describe('Primary document type'),
    confidence: z.number().describe('Confidence in classification'),
    jurisdiction: z.string().describe('Identified jurisdiction for the document'),
    processingRequirements: z.array(z.string()).describe('Required processing steps'),
    applicableLaws: z.array(z.string()).describe('Applicable labor laws and regulations'),
    specialHandling: z.array(z.string()).optional().describe('Special handling requirements'),
  }),
});

// Specialized agent for data extraction validation
export const dataValidationAgent = new ToolLoopAgent({
  model: getModel('advanced'),
  instructions: `You are a data validation specialist focused on employment and payroll documents. Your role is to:
1. Validate extracted numerical data for mathematical correctness
2. Cross-reference related fields for consistency
3. Identify logical inconsistencies in the data
4. Verify compliance with formatting and content requirements
5. Flag potential data entry errors or omissions
6. Calculate derived values and validate against reported values

Pay attention to:
- Wage calculations (hours × rates = pay amounts)
- Tax withholding percentages and amounts
- Deduction totals and net pay calculations
- Overtime rate calculations (1.5x or 2x regular rate)
- Minimum wage compliance
- Pay period consistency`,
  tools: {
    processOCR: ocrProcessorTool,
  },
  output: 'object',
  outputSchema: z.object({
    validationResults: z.array(z.object({
      field: z.string(),
      status: z.enum(['valid', 'invalid', 'warning', 'unverifiable']),
      expectedValue: z.any().optional(),
      actualValue: z.any(),
      explanation: z.string(),
    })).describe('Validation results for each field'),
    calculationChecks: z.array(z.object({
      calculation: z.string(),
      components: z.array(z.string()),
      result: z.boolean(),
      explanation: z.string(),
    })).describe('Mathematical calculation verifications'),
    complianceIssues: z.array(z.object({
      type: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      description: z.string(),
    })).describe('Potential compliance issues identified'),
    overallScore: z.number().describe('Overall data validation score'),
  }),
});

// Export all document processing related agents
export const documentProcessingAgents = {
  documentProcessor: documentProcessingAgent,
  qualityController: ocrQualityAgent,
  classifier: documentClassifierAgent,
  validator: dataValidationAgent,
} as const;
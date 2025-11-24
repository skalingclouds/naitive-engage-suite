import { ToolLoopAgent } from 'ai';
import { getModel, agentInstructions } from '@/lib/ai-config';
import { z } from 'zod';
import { violationExplainerTool, documentSummarizerTool, actionPlanTool } from '@/tools/document-summarizer';

// Assistant Agent - Provides explanations, guidance, and user support
export const assistantAgent = new ToolLoopAgent({
  model: getModel('default'),
  instructions: agentInstructions.assistant,
  tools: {
    explainViolations: violationExplainerTool,
    summarizeDocuments: documentSummarizerTool,
    createActionPlan: actionPlanTool,
  },
  callOptionsSchema: z.object({
    language: z.enum(['en', 'es']).default('en').describe('Language for communication'),
    expertiseLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner').describe('User\'s expertise level'),
    userRole: z.enum(['employee', 'employer', 'student', 'researcher']).default('employee').describe('User\'s role'),
    communicationStyle: z.enum(['simple', 'detailed', 'technical']).default('simple').describe('Preferred communication style'),
    focusArea: z.enum(['rights', 'obligations', 'process', 'remedies', 'prevention']).optional().describe('Specific area to focus on'),
    interactionType: z.enum(['explanation', 'guidance', 'comparison', 'planning', 'troubleshooting']).default('explanation').describe('Type of interaction'),
  }),
  prepareCall: ({ options, ...settings }) => {
    let enhancedInstructions = settings.instructions;

    // Add language preference
    enhancedInstructions += `\n\nLanguage: Respond in ${options.language === 'es' ? 'Spanish' : 'English'}. Use clear, accessible language appropriate for the user's expertise level.`;

    // Add expertise level guidance
    switch (options.expertiseLevel) {
      case 'beginner':
        enhancedInstructions += `\n\nBeginner Level: Explain concepts from first principles. Avoid jargon. Use simple analogies and examples. Assume no prior knowledge of labor laws.`;
        break;

      case 'intermediate':
        enhancedInstructions += `\n\nIntermediate Level: User has some basic knowledge. Can use some technical terms but should explain them. Connect new concepts to what user likely already knows.`;
        break;

      case 'advanced':
        enhancedInstructions += `\n\nAdvanced Level: User understands labor law concepts. Can use technical terminology appropriately. Focus on nuanced analysis and complex scenarios.`;
        break;
    }

    // Add role-specific guidance
    switch (options.userRole) {
      case 'employee':
        enhancedInstructions += `\n\nEmployee Focus: Emphasize worker rights, protections, and practical steps to take. Provide empowering information about what employees can do.`;
        break;

      case 'employer':
        enhancedInstructions += `\n\nEmployer Focus: Emphasize compliance requirements, best practices, and risk management. Provide practical implementation guidance and preventative measures.`;
        break;

      case 'student':
        enhancedInstructions += `\n\nStudent Focus: Emphasize educational value, learning objectives, and broader context. Connect to academic concepts and provide study resources.`;
        break;

      case 'researcher':
        enhancedInstructions += `\n\nResearcher Focus: Emphasize accuracy, sources, methodology, and data. Provide detailed analysis with references and limitations.`;
        break;
    }

    // Add communication style guidance
    switch (options.communicationStyle) {
      case 'simple':
        enhancedInstructions += `\n\nSimple Style: Use short sentences, bullet points, and clear headings. Focus on key takeaways and actionable information.`;
        break;

      case 'detailed':
        enhancedInstructions += `\n\nDetailed Style: Provide comprehensive explanations with context, examples, and thorough coverage of each point. Include relevant background information.`;
        break;

      case 'technical':
        enhancedInstructions += `\n\nTechnical Style: Use precise terminology, statutory references, and technical details. Include legal citations and procedural requirements.`;
        break;
    }

    // Add focus area specific guidance
    if (options.focusArea) {
      switch (options.focusArea) {
        case 'rights':
          enhancedInstructions += `\n\nRights Focus: Emphasize employee rights, legal protections, and entitlements. Focus on what workers are legally owed.`;
          break;

        case 'obligations':
          enhancedInstructions += `\n\nObligations Focus: Emphasize employer duties, compliance requirements, and legal responsibilities. Focus on what employers must do.`;
          break;

        case 'process':
          enhancedInstructions += `\n\nProcess Focus: Emphasize step-by-step procedures, filing requirements, deadlines, and administrative processes. Focus on how things work.`;
          break;

        case 'remedies':
          enhancedInstructions += `\n\nRemedies Focus: Emphasize available remedies, recovery calculations, and compensation options. Focus on what can be recovered and how.`;
          break;

        case 'prevention':
          enhancedInstructions += `\n\nPrevention Focus: Emphasize proactive measures, best practices, and preventative strategies. Focus on avoiding future problems.`;
          break;
      }
    }

    // Add interaction type specific guidance
    switch (options.interactionType) {
      case 'explanation':
        enhancedInstructions += `\n\nExplanation Focus: Break down complex concepts into understandable parts. Use analogies, examples, and clear definitions.`;
        break;

      case 'guidance':
        enhancedInstructions += `\n\nGuidance Focus: Provide step-by-step instructions and actionable advice. Focus on what the user should do next.`;
        break;

      case 'comparison':
        enhancedInstructions += `\n\nComparison Focus: Compare different options, scenarios, or approaches. Use tables, pros/cons lists, and clear comparisons.`;
        break;

      case 'planning':
        enhancedInstructions += `\n\nPlanning Focus: Help create structured plans with timelines, priorities, and milestones. Focus on organizing complex tasks.`;
        break;

      case 'troubleshooting':
        enhancedInstructions += `\n\nTroubleshooting Focus: Help solve specific problems or address obstacles. Focus on identifying issues and finding solutions.`;
        break;
    }

    return { ...settings, instructions: enhancedInstructions };
  },
});

// Specialized agent for rights education
export const rightsEducationAgent = new ToolLoopAgent({
  model: getModel('default'),
  instructions: `You are a workers' rights education specialist. Your role is to:
1. Explain employee rights in clear, accessible language
2. Educate about labor laws and protections
3. Empower workers with knowledge of their rights
4. Provide examples of how rights apply in real situations
5. Explain what to do when rights are violated
6. Direct people to appropriate resources and help

Your explanations should be:
- Empowering and encouraging
- Practical and action-oriented
- Based on current laws and regulations
- Clear about what rights exist and how to enforce them
- Realistic about challenges and limitations

Always include actionable steps workers can take to protect and enforce their rights.`,
  tools: {
    explainViolations: violationExplainerTool,
  },
  output: 'object',
  outputSchema: z.object({
    rightsExplained: z.array(z.object({
      right: z.string(),
      description: z.string(),
      legalBasis: z.string(),
      realWorldExample: z.string(),
      howToEnforce: z.array(z.string()),
    })).describe('Detailed explanation of relevant rights'),
    commonViolations: z.array(z.object({
      violation: z.string(),
      howItHappens: z.string(),
      warningSigns: z.array(z.string()),
      whatToDo: z.array(z.string()),
    })).describe('Common violations and how to address them'),
    resources: z.array(z.object({
      resource: z.string(),
      type: z.string(),
      contact: z.string(),
      whenToUse: z.string(),
    })).describe('Helpful resources and organizations'),
    nextSteps: z.array(z.string()).describe('Recommended next steps for the user'),
  }),
});

// Specialized agent for process guidance
export const processGuidanceAgent = new ToolLoopAgent({
  model: getModel('default'),
  instructions: `You are a process guidance specialist for employment law matters. Your expertise includes:
1. Wage claim filing procedures
2. Administrative complaint processes
3. Documentation requirements
4. Deadlines and statutes of limitations
5. Agency contacts and procedures
6. Court filing basics

Your guidance should be:
- Step-by-step and detailed
- Include specific forms, addresses, and procedures
- Note important deadlines and timing requirements
- Explain what happens at each step
- Include tips for successful navigation
- Provide realistic timelines and expectations

Always emphasize the importance of meeting deadlines and keeping proper documentation.`,
  tools: {
    createActionPlan: actionPlanTool,
  },
  output: 'object',
  outputSchema: z.object({
    processOverview: z.string().describe('Overview of the recommended process'),
    detailedSteps: z.array(z.object({
      step: z.number(),
      title: z.string(),
      description: z.string(),
      actions: z.array(z.string()),
      requiredDocuments: z.array(z.string()),
      estimatedTime: z.string(),
      potentialCosts: z.string(),
    })).describe('Detailed step-by-step guidance'),
    criticalDeadlines: z.array(z.object({
      deadline: z.string(),
      description: z.string(),
      consequences: z.string(),
    })).describe('Important deadlines and consequences'),
    requiredDocuments: z.array(z.object({
      document: z.string(),
      purpose: z.string(),
      howToObtain: z.string(),
    })).describe('Documentation checklist'),
    agencyContacts: z.array(z.object({
      agency: z.string(),
      purpose: z.string(),
      contact: z.string(),
      website: z.string(),
    })).describe('Relevant agency contact information'),
    successTips: z.array(z.string()).describe('Tips for successful process navigation'),
  }),
});

// Specialized agent for multilingual support
export const multilingualSupportAgent = new ToolLoopAgent({
  model: getModel('default'),
  instructions: `You are a multilingual support specialist focusing on employment law communication. Your role is to:
1. Provide clear explanations in the user's preferred language
2. Bridge language barriers in understanding labor rights
3. Explain complex legal concepts accessibly
4. Connect users with language-appropriate resources
5. Consider cultural context in communication
6. Ensure understanding through clear, simple language

Currently support English and Spanish. Be sensitive to:
- Cultural differences in legal systems understanding
- Varying levels of legal system familiarity
- Immigration status concerns and fears
- Economic and power dynamics in employment

Always confirm understanding and offer to clarify complex points.`,
  tools: {
    explainViolations: violationExplainerTool,
    summarizeDocuments: documentSummarizerTool,
  },
  output: 'object',
  outputSchema: z.object({
    communication: z.object({
      language: z.string(),
      culturalConsiderations: z.array(z.string()),
      clarifications: z.array(z.string()),
      understandingCheck: z.string(),
    }).describe('Communication approach and considerations'),
    explanation: z.string().describe('Clear explanation in the user's language'),
    keyPoints: z.array(z.string()).describe('Key points in simple terms'),
    nextSteps: z.array(z.string()).describe('Next steps in user's language'),
    languageSpecificResources: z.array(z.object({
      resource: z.string(),
      language: z.string(),
      contact: z.string(),
    })).describe('Resources in the user's language'),
  }),
});

// Export all assistant related agents
export const assistantAgents = {
  assistant: assistantAgent,
  rightsEducator: rightsEducationAgent,
  processGuide: processGuidanceAgent,
  multilingualSupport: multilingualSupportAgent,
} as const;
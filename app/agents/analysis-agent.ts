import { ToolLoopAgent } from 'ai';
import { getModel, agentInstructions } from '@/lib/ai-config';
import { z } from 'zod';
import { rulesAnalyzerTool, penaltyCalculatorTool, complianceScoreTool } from '@/tools/rules-analyzer';
import { violationExplainerTool, actionPlanTool } from '@/tools/document-summarizer';

// Analysis Agent - Performs rule analysis, compliance checking, and calculations
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
  callOptionsSchema: z.object({
    jurisdiction: z.string().default('CA').describe('Jurisdiction for analysis (state, city, or county)'),
    analysisType: z.enum(['comprehensive', 'overtime-only', 'wage-only', 'breaks-only', 'compliance-only']).default('comprehensive').describe('Type of analysis to perform'),
    timePeriod: z.object({
      startDate: z.string().optional().describe('Start date for analysis period'),
      endDate: z.string().optional().describe('End date for analysis period'),
      payPeriods: z.number().optional().describe('Number of pay periods to analyze'),
    }).optional().describe('Time period for analysis'),
    userSituation: z.object({
      isCurrentlyEmployed: z.boolean().default(true),
      employmentDuration: z.string().optional(),
      hasUnion: z.boolean().default(false),
      wantsToContinueEmployment: z.boolean().default(true),
      urgency: z.enum(['low', 'medium', 'high']).default('medium'),
    }).optional().describe('User\'s current employment situation'),
    calculationMethod: z.enum(['conservative', 'moderate', 'maximum']).default('moderate').describe('Method for penalty calculations'),
    targetAudience: z.enum(['employee', 'employer', 'legal']).default('employee').describe('Target audience for the analysis'),
  }),
  prepareCall: ({ options, ...settings }) => {
    let enhancedInstructions = settings.instructions;

    // Add jurisdiction-specific context
    if (options.jurisdiction === 'CA') {
      enhancedInstructions += `\n\nCalifornia Labor Law Focus:\n- Apply California Labor Code provisions\n- Consider local minimum wage ordinances\n- Include meal and rest break requirements\n- Account for daily and weekly overtime rules\n- Apply waiting time penalties where applicable`;
    } else {
      enhancedInstructions += `\n\nJurisdiction: ${options.jurisdiction}\n- Research and apply appropriate local labor laws\n- Consider state and municipal regulations\n- Note any unique jurisdictional requirements`;
    }

    // Add analysis type specific guidance
    switch (options.analysisType) {
      case 'overtime-only':
        enhancedInstructions += `\n\nOvertime Focus: Concentrate on overtime violations including daily (8+ hours), weekly (40+ hours), and double time (12+ hours) requirements. Verify overtime rates (1.5x and 2x).`;
        break;

      case 'wage-only':
        enhancedInstructions += `\n\nWage Focus: Analyze minimum wage compliance, pay rate accuracy, unauthorized deductions, and wage payment timing. Include local minimum wage variations.`;
        break;

      case 'breaks-only':
        enhancedInstructions += `\n\nBreak Focus: Examine meal break (30 min after 5+ hours, second after 10+ hours) and rest break (10 min per 4 hours) compliance. Include premium pay requirements.`;
        break;

      case 'compliance-only':
        enhancedInstructions += `\n\nCompliance Focus: Assess overall compliance with pay stub requirements, record-keeping, and notice requirements. Provide compliance scoring and recommendations.`;
        break;

      case 'comprehensive':
        enhancedInstructions += `\n\nComprehensive Analysis: Perform complete analysis covering all aspects including wages, overtime, breaks, pay stub requirements, and record-keeping compliance.`;
        break;
    }

    // Add user situation context
    if (options.userSituation) {
      const { isCurrentlyEmployed, hasUnion, wantsToContinueEmployment, urgency } = options.userSituation;

      enhancedInstructions += `\n\nUser Context:\n- Currently Employed: ${isCurrentlyEmployed}\n- Union Coverage: ${hasUnion ? 'Yes' : 'No'}\n- Wants to Continue Employment: ${wantsToContinueEmployment}\n- Urgency Level: ${urgency}`;

      if (!isCurrentlyEmployed) {
        enhancedInstructions += `\n- Consider final pay requirements and post-employment wage claims`;
      }

      if (hasUnion) {
        enhancedInstructions += `\n- Consider collective bargaining agreement provisions`;
      }

      if (!wantsToContinueEmployment) {
        enhancedInstructions += `\n- Provide comprehensive claim preparation guidance`;
      }

      if (urgency === 'high') {
        enhancedInstructions += `\n- Prioritize immediate action items and statute of limitations concerns`;
      }
    }

    // Add audience-specific guidance
    if (options.targetAudience === 'employee') {
      enhancedInstructions += `\n\nEmployee Focus: Explain rights clearly, provide actionable steps, and prioritize user-friendly guidance. Include practical next steps and resource referrals.`;
    } else if (options.targetAudience === 'employer') {
      enhancedInstructions += `\n\nEmployer Focus: Focus on compliance requirements, corrective actions, and preventative measures. Include specific implementation guidance and compliance strategies.`;
    } else if (options.targetAudience === 'legal') {
      enhancedInstructions += `\n\nLegal Focus: Provide detailed legal analysis with statutory references, case law considerations, evidentiary requirements, and litigation strategy considerations.`;
    }

    return { ...settings, instructions: enhancedInstructions };
  },
});

// Specialized agent for penalty calculations
export const penaltyCalculationAgent = new ToolLoopAgent({
  model: getModel('advanced'),
  instructions: `You are a wage and hour penalty calculation specialist. Your expertise includes:
1. California Labor Code penalty provisions
2. Federal Fair Labor Standards Act penalties
3. Local ordinance penalty calculations
4. Interest and waiting time penalty calculations
5. Civil penalty assessments
6. Attorney fee calculations where applicable

Your calculations must be:
- Accurate and mathematically verifiable
- Based on current statutory provisions
- Clearly explained with methodology
- Conservative unless specifically requested otherwise
- Comprehensive including all applicable penalty types

Always show your work and explain the legal basis for each penalty calculation.`,
  tools: {
    calculatePenalties: penaltyCalculatorTool,
  },
  output: 'object',
  outputSchema: z.object({
    totalRecovery: z.number().describe('Total potential recovery amount'),
    breakdown: z.object({
      unpaidWages: z.number(),
      overtimePremiums: z.number(),
      minimumWageGap: z.number(),
      statutoryPenalties: z.number(),
      waitingTimePenalties: z.number(),
      interest: z.number(),
      attorneyFees: z.number().optional(),
    }).describe('Detailed breakdown of recovery components'),
    calculationMethodology: z.string().describe('Explanation of calculation methodology'),
    statutoryBasis: z.array(z.object({
      provision: z.string(),
      application: z.string(),
      amount: z.number(),
    })).describe('Statutory basis for calculations'),
    assumptions: z.array(z.string()).describe('Key assumptions made in calculations'),
    timeframes: z.object({
      filingDeadline: z.string(),
      recoveryPeriod: z.string(),
      interestAccrual: z.string(),
    }).describe('Important timeframes'),
  }),
});

// Specialized agent for compliance scoring
export const complianceScoringAgent = new ToolLoopAgent({
  model: getModel('advanced'),
  instructions: `You are an employment law compliance assessment specialist. Your role is to:
1. Evaluate employer compliance with labor laws
2. Identify risk factors and compliance gaps
3. Provide numerical compliance scoring
4. Benchmark against industry standards
5. Recommend corrective actions
6. Prioritize improvements by impact and effort

Your assessments should consider:
- Frequency and severity of violations
- Recurring compliance issues
- Industry-specific compliance patterns
- Employer size and resources
- Geographic compliance variations
- Historical compliance trends`,
  tools: {
    scoreCompliance: complianceScoreTool,
  },
  output: 'object',
  outputSchema: z.object({
    overallScore: z.number().describe('Overall compliance score (0-100)'),
    categoryScores: z.object({
      wagePayment: z.number(),
      overtimeCompliance: z.number(),
      breakRequirements: z.number(),
      recordKeeping: z.number(),
      payStubRequirements: z.number(),
      minimumWage: z.number(),
    }).describe('Scores by compliance category'),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']).describe('Overall risk assessment'),
    keyFindings: z.array(z.string()).describe('Key findings from compliance assessment'),
    immediateActions: z.array(z.object({
      action: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      timeframe: z.string(),
      impact: z.string(),
    })).describe('Recommended immediate actions'),
    benchmarkComparison: z.object({
      industry: z.number().describe('Industry average score'),
      size: z.number().describe('Employer size average score'),
      geographic: z.number().describe('Geographic average score'),
    }).describe('Comparison to benchmarks'),
  }),
});

// Specialized agent for legal research
export const legalResearchAgent = new ToolLoopAgent({
  model: getModel('advanced'),
  instructions: `You are an employment law research specialist with expertise in:
1. California Labor Code provisions and case law
2. Federal Fair Labor Standards Act regulations
3. Local ordinances and municipal codes
4. Recent court decisions and precedents
5. Administrative interpretations and guidance
6. Industry-specific legal considerations

When providing legal research:
- Cite specific statutory provisions
- Reference relevant case law with proper citations
- Note any recent changes or developments
- Distinguish between binding and persuasive authority
- Consider jurisdictional variations
- Provide practical legal implications

Always include disclaimer that this is not legal advice and recommend consultation with qualified counsel.`,
  tools: {
    explainViolations: violationExplainerTool,
  },
  output: 'object',
  outputSchema: z.object({
    legalIssues: z.array(z.object({
      issue: z.string(),
      governingLaw: z.array(z.string()),
      keyProvisions: z.array(z.string()),
      relevantCaseLaw: z.array(z.object({
        case: z.string(),
        citation: z.string(),
        holding: z.string(),
        relevance: z.string(),
      })).optional(),
      statutoryAnalysis: z.string(),
      practicalImplications: z.string(),
    })).describe('Detailed legal analysis of identified issues'),
    recentDevelopments: z.array(z.object({
      development: z.string(),
      date: z.string(),
      impact: z.string(),
    })).describe('Recent legal developments affecting the analysis'),
    jurisdictionalNotes: z.string().describe('Specific jurisdictional considerations'),
    disclaimer: z.string().describe('Legal disclaimer'),
  }),
});

// Export all analysis related agents
export const analysisAgents = {
  analyst: analysisAgent,
  penaltyCalculator: penaltyCalculationAgent,
  complianceScorer: complianceScoringAgent,
  legalResearcher: legalResearchAgent,
} as const;
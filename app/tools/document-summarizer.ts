import { tool } from 'ai';
import { z } from 'zod';

// Document Summarizer Tool - Wraps the LLM summarization service
export const documentSummarizerTool = tool({
  description: 'Generate plain-language summaries of pay stub analysis results, including violation explanations and recommendations. This tool makes complex legal and financial information easy to understand.',
  inputSchema: z.object({
    violations: z.array(z.object({
      type: z.string(),
      description: z.string(),
      confidence: z.number(),
      severity: z.enum(['low', 'medium', 'high']),
      laborCode: z.string().optional(),
    })).describe('Array of detected violations'),
    extractedData: z.any().optional().describe('Extracted OCR data from the document'),
    language: z.enum(['en', 'es']).default('en').describe('Language for the summary (English or Spanish)'),
    confidence: z.number().optional().describe('Overall confidence in the analysis'),
    documentType: z.enum(['paystub', 'w2', '1099', 'other']).default('paystub').describe('Type of document analyzed'),
    targetAudience: z.enum(['employee', 'employer', 'legal']).default('employee').describe('Target audience for the summary'),
  }),
  execute: async ({ violations, extractedData, language = 'en', confidence = 0.8, documentType = 'paystub', targetAudience = 'employee' }) => {
    try {
      console.log('Generating document summary:', {
        violationsCount: violations.length,
        language,
        documentType,
        targetAudience
      });

      // Call the LLM summarize API
      const summarizeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/llm/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          violations: violations.map(v => ({
            type: v.type,
            description: v.description,
            confidence: v.confidence,
            severity: v.severity,
            laborCode: v.laborCode,
          })),
          extractedData,
          language,
          confidence,
        }),
      });

      if (!summarizeResponse.ok) {
        throw new Error(`Summary generation failed: ${summarizeResponse.statusText}`);
      }

      const summaryData = await summarizeResponse.json();

      // Enhance the summary with additional context based on target audience
      const enhancedSummary = enhanceSummaryForAudience(
        summaryData.summary,
        targetAudience,
        documentType,
        language
      );

      return {
        success: true,
        summary: enhancedSummary,
        language,
        documentType,
        targetAudience,
        violationsCount: violations.length,
        hasViolations: violations.length > 0,
        severityBreakdown: {
          high: violations.filter(v => v.severity === 'high').length,
          medium: violations.filter(v => v.severity === 'medium').length,
          low: violations.filter(v => v.severity === 'low').length,
        },
        generatedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Document summarization error:', error);

      // Fallback summary generation
      const fallbackSummary = generateFallbackSummary(violations, language, targetAudience);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Summarization error',
        summary: fallbackSummary,
        language,
        documentType,
        targetAudience,
        isFallback: true,
      };
    }
  },
});

// Explanation Tool - Provides detailed explanations of specific violations
export const violationExplainerTool = tool({
  description: 'Provide detailed explanations of specific labor law violations, including what they mean, why they matter, and what actions to take. This tool helps users understand their rights and options.',
  inputSchema: z.object({
    violationType: z.string().describe('The type of violation to explain'),
    laborCode: z.string().optional().describe('The relevant labor code section'),
    severity: z.enum(['low', 'medium', 'high']).describe('Severity level of the violation'),
    context: z.string().optional().describe('Additional context about the specific violation'),
    language: z.enum(['en', 'es']).default('en').describe('Language for the explanation'),
    jurisdiction: z.string().default('CA').describe('State jurisdiction for the violation'),
  }),
  execute: async ({ violationType, laborCode, severity, context, language = 'en', jurisdiction = 'CA' }) => {
    try {
      console.log('Generating violation explanation:', { violationType, laborCode, severity, language });

      // Generate detailed explanation based on violation type
      const explanation = generateViolationExplanation({
        violationType,
        laborCode,
        severity,
        context,
        language,
        jurisdiction,
      });

      return {
        success: true,
        explanation,
        violationType,
        laborCode,
        severity,
        language,
        jurisdiction,
        relatedResources: getRelatedResources(violationType, jurisdiction),
        nextSteps: getNextSteps(severity, violationType),
        generatedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Violation explanation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Explanation error',
        violationType,
        language,
      };
    }
  },
});

// Action Plan Generator Tool - Creates personalized action plans
export const actionPlanTool = tool({
  description: 'Generate personalized action plans based on detected violations. This tool creates step-by-step guidance for addressing specific issues.',
  inputSchema: z.object({
    violations: z.array(z.object({
      type: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      description: z.string(),
    })).describe('List of violations to create action plan for'),
    userSituation: z.object({
      isCurrentlyEmployed: z.boolean().default(true),
      employmentDuration: z.string().optional().describe('How long the user has been employed'),
      hasUnion: z.boolean().default(false),
      wantsToContinueEmployment: z.boolean().default(true),
      urgency: z.enum(['low', 'medium', 'high']).default('medium'),
    }).optional().describe('User\'s employment situation'),
    language: z.enum(['en', 'es']).default('en').describe('Language for the action plan'),
    timeline: z.enum(['immediate', 'short-term', 'long-term']).default('short-term').describe('Desired timeline for action'),
  }),
  execute: async ({ violations, userSituation, language = 'en', timeline = 'short-term' }) => {
    try {
      console.log('Generating action plan:', {
        violationsCount: violations.length,
        userSituation,
        timeline
      });

      const actionPlan = generateActionPlan(violations, userSituation || {}, language, timeline);

      return {
        success: true,
        actionPlan,
        violationsCount: violations.length,
        userSituation,
        timeline,
        language,
        estimatedCompletionTime: actionPlan.estimatedDuration,
        resources: actionPlan.resources,
        generatedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Action plan generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Action plan error',
        violationsCount: violations.length,
        language,
      };
    }
  },
});

// Helper functions for enhanced functionality
function enhanceSummaryForAudience(summary: any, audience: string, documentType: string, language: string) {
  const enhancements = { ...summary };

  switch (audience) {
    case 'employee':
      enhancements.additionalGuidance = language === 'en'
        ? 'This analysis is provided for your information. Consider consulting with an employment attorney for legal advice specific to your situation.'
        : 'Este análisis se proporciona para su información. Considere consultar con un abogado laboral para asesoramiento legal específico de su situación.';
      break;

    case 'employer':
      enhancements.additionalGuidance = language === 'en'
        ? 'This analysis identifies areas for compliance improvement. Consider reviewing your payroll practices and consulting with employment law counsel.'
        : 'Este análisis identifica áreas de mejora de cumplimiento. Considere revisar sus prácticas de nóminas y consultar con abogados de derecho laboral.';
      break;

    case 'legal':
      enhancements.technicalNotes = language === 'en'
        ? 'This summary is based on California labor laws as of the analysis date. Verify current applicable statutes and case law.'
        : 'Este resumen se basa en las leyes laborales de California a la fecha del análisis. Verifique las leyes y jurisprudencia aplicables actuales.';
      break;
  }

  return enhancements;
}

function generateFallbackSummary(violations: any[], language: string, targetAudience: string) {
  const hasHighSeverity = violations.some(v => v.severity === 'high');
  const hasMediumSeverity = violations.some(v => v.severity === 'medium');

  if (violations.length === 0) {
    return language === 'en' ? {
      overall_summary: "No violations were detected in the document analysis.",
      key_findings: ["Document appears to comply with relevant requirements"],
      recommended_actions: ["Continue monitoring compliance", "Keep records for future reference"],
    } : {
      overall_summary: "No se detectaron violaciones en el análisis del documento.",
      key_findings: ["El documento parece cumplir con los requisitos relevantes"],
      recommended_actions: ["Continuar monitoreando el cumplimiento", "Mantener registros para referencia futura"],
    };
  }

  return language === 'en' ? {
    overall_summary: `Analysis found ${violations.length} potential violation(s) that require attention.`,
    key_findings: violations.map(v => v.description),
    recommended_actions: hasHighSeverity
      ? ["Seek legal advice immediately", "Document all relevant information"]
      : ["Review the identified issues", "Consider consulting with HR or legal counsel"],
  } : {
    overall_summary: `El análisis encontró ${violations.length} posible(s) violación(es) que requieren atención.`,
    key_findings: violations.map(v => v.description),
    recommended_actions: hasHighSeverity
      ? ["Busque asesoramiento legal inmediatamente", "Documente toda la información relevante"]
      : ["Revise los problemas identificados", "Considere consultar con RRHH o asesoramiento legal"],
  };
}

function generateViolationExplanation({ violationType, laborCode, severity, context, language, jurisdiction }: any) {
  const explanations: Record<string, any> = {
    'Daily Overtime Violation': {
      en: {
        title: 'Daily Overtime Violation',
        explanation: 'California law requires employers to pay overtime at 1.5 times the regular rate for hours worked over 8 in a single day.',
        whyItMatters: 'This violation means you may be owed unpaid wages for overtime hours worked.',
        whatItMeans: 'If you worked more than 8 hours in a day, you should have received overtime pay.',
        legalBasis: 'California Labor Code § 510',
      },
      es: {
        title: 'Violación de Horas Extras Diarias',
        explanation: 'Las leyes de California requieren que los empleadores paguen horas extras a 1.5 veces la tarifa regular por horas trabajadas más de 8 en un solo día.',
        whyItMatters: 'Esta violación significa que podrían deberle salarios no pagados por horas extras trabajadas.',
        whatItMeans: 'Si trabajó más de 8 horas en un día, debería haber recibido pago de horas extras.',
        legalBasis: 'Código Laboral de California § 510',
      },
    },
    'Minimum Wage Violation': {
      en: {
        title: 'Minimum Wage Violation',
        explanation: 'California law sets minimum wage requirements that all employers must follow.',
        whyItMatters: 'You are entitled to receive at least the minimum wage for all hours worked.',
        whatItMeans: 'Your hourly rate is below the legal minimum wage requirement.',
        legalBasis: 'California Labor Code § 1182.12',
      },
      es: {
        title: 'Violación del Salario Mínimo',
        explanation: 'Las leyes de California establecen requisitos de salario mínimo que todos los empleadores deben seguir.',
        whyItMatters: 'Tiene derecho a recibir al menos el salario mínimo por todas las horas trabajadas.',
        whatItMeans: 'Su tarifa por hora está por debajo del requisito legal de salario mínimo.',
        legalBasis: 'Código Laboral de California § 1182.12',
      },
    },
    // Add more violation types as needed
  };

  return explanations[violationType]?.[language] || {
    title: violationType,
    explanation: language === 'en' ? 'This violation requires attention and may impact your rights and compensation.' : 'Esta violación requiere atención y puede afectar sus derechos y compensación.',
    whyItMatters: language === 'en' ? 'This violation affects your legal rights and potential compensation.' : 'Esta violación afecta sus derechos legales y compensación potencial.',
    whatItMeans: language === 'en' ? 'You should take action to address this violation.' : 'Debería tomar medidas para abordar esta violación.',
    legalBasis: laborCode || 'Applicable labor laws',
  };
}

function getRelatedResources(violationType: string, jurisdiction: string) {
  const resources = [
    {
      title: 'California Labor Commissioner',
      url: 'https://www.dir.ca.gov/dlse/',
      description: 'Official resource for California labor law enforcement',
    },
    {
      title: 'United States Department of Labor',
      url: 'https://www.dol.gov/',
      description: 'Federal labor law information and resources',
    },
  ];

  return resources;
}

function getNextSteps(severity: string, violationType: string) {
  const baseSteps = [
    'Gather and organize all relevant documents',
    'Document dates, hours worked, and pay received',
    'Keep a timeline of events',
  ];

  const severitySpecific = {
    high: [
      'Consider consulting with an employment attorney immediately',
      'Document current working conditions',
      'Avoid working overtime until issues are resolved',
    ],
    medium: [
      'Schedule a meeting with HR or management',
      'Prepare a written summary of concerns',
      'Consider seeking legal advice',
    ],
    low: [
      'Review pay stubs regularly going forward',
      'Address any unclear deductions with payroll',
      'Monitor for recurring issues',
    ],
  };

  return [...baseSteps, ...(severitySpecific[severity as keyof typeof severitySpecific] || [])];
}

function generateActionPlan(violations: any[], userSituation: any, language: string, timeline: string) {
  const hasHighSeverity = violations.some(v => v.severity === 'high');
  const hasMediumSeverity = violations.some(v => v.severity === 'medium');

  const basePlan = {
    title: language === 'en' ? 'Action Plan for Addressing Violations' : 'Plan de Acción para Abordar Violaciones',
    estimatedDuration: hasHighSeverity ? '2-4 weeks' : '1-2 weeks',
    phases: [],
    resources: [],
  };

  // Phase 1: Documentation
  basePlan.phases.push({
    title: language === 'en' ? 'Documentation Phase' : 'Fase de Documentación',
    timeline: language === 'en' ? '1-3 days' : '1-3 días',
    steps: [
      language === 'en' ? 'Gather all recent pay stubs' : 'Reunir todos los talones de pago recientes',
      language === 'en' ? 'Document work hours and schedules' : 'Documentar horas de trabajo y horarios',
      language === 'en' ? 'Save any relevant communications' : 'Guardar cualquier comunicación relevante',
    ],
  });

  // Phase 2: Resolution based on severity
  if (hasHighSeverity) {
    basePlan.phases.push({
      title: language === 'en' ? 'Legal Consultation Phase' : 'Fase de Consulta Legal',
      timeline: language === 'en' ? '3-7 days' : '3-7 días',
      steps: [
        language === 'en' ? 'Consult with employment attorney' : 'Consultar con abogado laboral',
        language === 'en' ? 'File wage claim if recommended' : 'Presentar reclamación salarial si se recomienda',
        language === 'en' ? 'Preserve all evidence' : 'Preservar toda la evidencia',
      ],
    });
  } else if (hasMediumSeverity) {
    basePlan.phases.push({
      title: language === 'en' ? 'Resolution Phase' : 'Fase de Resolución',
      timeline: language === 'en' ? '1-2 weeks' : '1-2 semanas',
      steps: [
        language === 'en' ? 'Schedule meeting with HR/management' : 'Programar reunión con RRHH/gerencia',
        language === 'en' ? 'Present documented concerns' : 'Presentar preocupaciones documentadas',
        language === 'en' ? 'Follow up in writing' : 'Hacer seguimiento por escrito',
      ],
    });
  }

  return basePlan;
}
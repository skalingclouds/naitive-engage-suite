import { NextRequest, NextResponse } from 'next/server';

interface SummaryRequest {
  violations: Array<{
    type: string;
    description: string;
    confidence: number;
    severity: "low" | "medium" | "high";
    laborCode?: string;
  }>;
  confidence: number;
  extractedData?: any;
  language: "en" | "es";
}

interface SummaryResponse {
  summary: {
    overall_summary: string;
    key_findings: string[];
    recommended_actions: string[];
    next_steps: string[];
    legal_rights_summary: string;
    confidence_level: string;
    disclaimer: string;
  };
}

// Mock LLM service - in production this would use Azure OpenAI Service (GPT-5-mini)
class LLMSummarizer {
  generateSummary(request: SummaryRequest): SummaryResponse {
    const { violations, confidence, extractedData, language } = request;
    
    const templates = {
      en: {
        noViolations: {
          overall_summary: "Good news! Our analysis found no violations in your pay stub. Your employer appears to be following California labor laws correctly.",
          key_findings: [
            "All required pay stub information is present and accurate",
            "Overtime calculations are correct",
            "Pay rates meet or exceed minimum wage requirements",
            "Proper deductions and tax withholdings are applied"
          ],
          recommended_actions: [
            "Continue keeping records of your pay stubs",
            "Monitor hours worked each pay period",
            "Review your pay stubs regularly for accuracy"
          ],
          next_steps: [
            "No immediate action required",
            "Consider setting up a system to track work hours",
            "Keep this analysis for your records"
          ]
        },
        lowSeverity: {
          overall_summary: "Our analysis identified a few minor issues that you should monitor. While these don't appear to be serious violations, it's worth keeping an eye on them.",
          key_findings: violations.map(v => v.description),
          recommended_actions: [
            "Clarify any unclear deductions with your employer",
            "Ensure all hours worked are properly recorded",
            "Request clarification on any confusing pay stub entries"
          ],
          next_steps: [
            "Talk to your HR department about the identified issues",
            "Document your work hours for the next few pay periods",
            "Follow up to ensure the issues are resolved"
          ]
        },
        mediumSeverity: {
          overall_summary: "Our analysis found some potential violations that may require attention. These issues could affect your pay and should be addressed.",
          key_findings: violations.map(v => v.description),
          recommended_actions: [
            "Document all hours worked including overtime",
            "Keep copies of your pay stubs and time records",
            "Calculate what you believe you're owed based on California law",
            "Consider consulting with an employment lawyer"
          ],
          next_steps: [
            "Gather additional pay stubs from the past 3-4 years",
            "Create a timeline of when these violations occurred",
            "Write down specific questions about the violations",
            "Schedule a consultation with an employment attorney"
          ]
        },
        highSeverity: {
          overall_summary: "Our analysis identified serious violations that may significantly impact your earnings. These violations require immediate attention.",
          key_findings: violations.map(v => v.description),
          recommended_actions: [
            "Stop working overtime until pay issues are resolved",
            "Document everything: hours, pay, conversations with management",
            "Calculate total amount of unpaid wages and penalties",
            "Contact an employment lawyer immediately"
          ],
          next_steps: [
            "Seek legal representation before discussing issues with employer",
            "File a wage claim with the California Labor Commissioner",
            "Preserve all evidence including emails, texts, and pay records",
            "Consider if you want to continue working for this employer"
          ]
        }
      },
      es: {
        noViolations: {
          overall_summary: "¡Buenas noticias! Nuestro análisis no encontró violaciones en su talón de pago. Su empleador parece estar siguiendo correctamente las leyes laborales de California.",
          key_findings: [
            "Toda la información requerida en el talón de pago está presente y es precisa",
            "Los cálculos de horas extras son correctos",
            "Las tasas de pago cumplen o exceden los requisitos del salario mínimo",
            "Se aplican deducciones y retenciones de impuestos apropiadas"
          ],
          recommended_actions: [
            "Continúe guardando registros de sus talones de pago",
            "Monitoree las horas trabajadas cada período de pago",
            "Revise sus talones de pago regularmente para verificar precisión"
          ],
          next_steps: [
            "No se requiere acción inmediata",
            "Considere establecer un sistema para rastrear horas de trabajo",
            "Guarde este análisis para sus registros"
          ]
        },
        lowSeverity: {
          overall_summary: "Nuestro análisis identificó algunos problemas menores que debe monitorear. Aunque no parecen ser violaciones serias, vale la pena estar atento a ellas.",
          key_findings: violations.map(v => v.description),
          recommended_actions: [
            "Aclare cualquier deducción poco clara con su empleador",
            "Asegúrese de que todas las horas trabajadas estén registradas correctamente",
            "Solicite aclaración sobre cualquier entrada confusa en el talón de pago"
          ],
          next_steps: [
            "Hable con su departamento de RRHH sobre los problemas identificados",
            "Documente sus horas de trabajo durante los próximos períodos de pago",
            "Haga seguimiento para asegurarse de que los problemas se resuelvan"
          ]
        },
        mediumSeverity: {
          overall_summary: "Nuestro análisis encontró algunas violaciones potenciales que pueden requerir atención. Estos problemas podrían afectar su pago y deben ser abordados.",
          key_findings: violations.map(v => v.description),
          recommended_actions: [
            "Documente todas las horas trabajadas incluyendo horas extras",
            "Guarde copias de sus talones de pago y registros de tiempo",
            "Calcule lo que cree que le deben según la ley de California",
            "Considere consultar con un abogado laboral"
          ],
          next_steps: [
            "Reúna talones de pago adicionales de los últimos 3-4 años",
            "Cree una línea de tiempo de cuándo ocurrieron estas violaciones",
            "Escriba preguntas específicas sobre las violaciones",
            "Programe una consulta con un abogado laboral"
          ]
        },
        highSeverity: {
          overall_summary: "Nuestro análisis identificó violaciones serias que pueden afectar significativamente sus ganancias. Estas violaciones requieren atención inmediata.",
          key_findings: violations.map(v => v.description),
          recommended_actions: [
            "Deje de trabajar horas extras hasta que se resuelvan los problemas de pago",
            "Documente todo: horas, pago, conversaciones con la gerencia",
            "Calcule el monto total de salarios no pagados y penalizaciones",
            "Contacte a un abogado laboral inmediatamente"
          ],
          next_steps: [
            "Busque representación legal antes de discutir problemas con su empleador",
            "Presente una reclamación salarial con el Comisionado Laboral de California",
            "Guarde toda la evidencia incluyendo correos, textos y registros de pago",
            "Considere si desea continuar trabajando para este empleador"
          ]
        }
      }
    };

    // Determine severity level
    const hasHighSeverity = violations.some(v => v.severity === 'high');
    const hasMediumSeverity = violations.some(v => v.severity === 'medium');
    const hasLowSeverity = violations.some(v => v.severity === 'low');

    let templateKey;
    if (violations.length === 0) {
      templateKey = 'noViolations';
    } else if (hasHighSeverity) {
      templateKey = 'highSeverity';
    } else if (hasMediumSeverity) {
      templateKey = 'mediumSeverity';
    } else {
      templateKey = 'lowSeverity';
    }

    const template = templates[language][templateKey as keyof typeof templates[typeof language]];

    // Extract specific values from OCR data for personalization
    const employeeName = extractedData?.employeeName?.value || "the employee";
    const employerName = extractedData?.employerName?.value || "your employer";
    const hourlyRate = extractedData?.hourlyRate?.value || 0;
    const overtimeHours = extractedData?.overtimeHours?.value || 0;

    // Personalize the summary
    const personalizedSummary = {
      ...template,
      overall_summary: template.overall_summary.replace(/{employeeName}/g, employeeName),
      key_findings: template.key_findings.map(finding => 
        finding
          .replace(/{employeeName}/g, employeeName)
          .replace(/{employerName}/g, employerName)
          .replace(/{hourlyRate}/g, `$${hourlyRate}`)
          .replace(/{overtimeHours}/g, overtimeHours.toString())
      ),
      legal_rights_summary: language === "en" 
        ? `California law provides strong protections for workers. You have the right to receive proper overtime pay (1.5x for hours over 8/day or 40/week, 2x for hours over 12/day), meal breaks (30 minutes for shifts over 5 hours, second break for shifts over 10 hours), rest breaks (10 minutes for every 4 hours), and detailed pay statements.`
        : `Las leyes de California proporcionan protecciones fuertes para los trabajadores. Tiene derecho a recibir pago de horas extras apropiado (1.5x para horas sobre 8/día o 40/semana, 2x para horas sobre 12/día), descansos para comidas (30 minutos para turnos sobre 5 horas, segundo descanso para turnos sobre 10 horas), descansos de descanso (10 minutos por cada 4 horas) y estados de pago detallados.`,
      confidence_level: `${Math.round(confidence * 100)}%`,
      disclaimer: language === "en"
        ? "This analysis is for informational purposes only and does not constitute legal advice. The confidence scores indicate the reliability of our OCR extraction and violation detection. Please consult with a qualified employment attorney for legal guidance specific to your situation."
        : "Este análisis es solo para fines informativos y no constituye asesoramiento legal. Los puntajes de confianza indican la confiabilidad de nuestra extracción OCR y detección de violaciones. Por favor consulte con un abogado laboral calificado para orientación legal específica de su situación."
    };

    return {
      summary: personalizedSummary
    };
  }
}

const summarizer = new LLMSummarizer();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SummaryRequest;
    
    if (!body.violations || !body.language) {
      return NextResponse.json(
        { error: 'Violations and language are required' },
        { status: 400 }
      );
    }

    // Generate summary
    const result = summarizer.generateSummary(body);
    
    console.log('LLM summary generated:', {
      violationsCount: body.violations.length,
      confidence: body.confidence,
      language: body.language
    });

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error generating LLM summary:', error);
    return NextResponse.json(
      { error: 'Internal server error during summary generation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return service information
    const serviceInfo = {
      service: 'LLM Summarizer',
      version: '1.0.0',
      description: 'AI-powered plain-language summaries for pay stub violation analysis',
      supportedLanguages: ['en', 'es'],
      model: 'GPT-5-mini (via Azure OpenAI Service)',
      capabilities: [
        'Plain-language violation explanations',
        'Personalized recommendations based on violation severity',
        'Legal rights summaries (California-specific)',
        'Actionable next steps',
        'Bilingual support (English/Spanish)'
      ],
      confidenceThresholds: {
        high: 0.9,
        medium: 0.7,
        low: 0.5
      }
    };
    
    return NextResponse.json(serviceInfo);
    
  } catch (error) {
    console.error('Error getting LLM service info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
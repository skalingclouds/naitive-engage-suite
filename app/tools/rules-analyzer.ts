import { tool } from 'ai';
import { z } from 'zod';

// Rules Analysis Tool - Wraps the rules analysis service
export const rulesAnalyzerTool = tool({
  description: 'Analyze document data against labor laws and regulations to detect potential violations. This tool applies specific rules to identify compliance issues and calculate potential penalties.',
  inputSchema: z.object({
    ocrData: z.object({
      employeeName: z.object({ value: z.string(), confidence: z.number() }).optional(),
      employerName: z.object({ value: z.string(), confidence: z.number() }).optional(),
      payPeriod: z.object({ value: z.string(), confidence: z.number() }).optional(),
      grossPay: z.object({ value: z.number(), confidence: z.number() }).optional(),
      netPay: z.object({ value: z.number(), confidence: z.number() }).optional(),
      regularHours: z.object({ value: z.number(), confidence: z.number() }).optional(),
      overtimeHours: z.object({ value: z.number(), confidence: z.number() }).optional(),
      doubleTimeHours: z.object({ value: z.number(), confidence: z.number() }).optional(),
      hourlyRate: z.object({ value: z.number(), confidence: z.number() }).optional(),
      overtimeRate: z.object({ value: z.number(), confidence: z.number() }).optional(),
      doubleTimeRate: z.object({ value: z.number(), confidence: z.number() }).optional(),
      federalTax: z.object({ value: z.number(), confidence: z.number() }).optional(),
      stateTax: z.object({ value: z.number(), confidence: z.number() }).optional(),
      socialSecurity: z.object({ value: z.number(), confidence: z.number() }).optional(),
      medicare: z.object({ value: z.number(), confidence: z.number() }).optional(),
    }).optional().describe('Extracted OCR data from the document'),
    locationInfo: z.object({
      city: z.string().optional(),
      state: z.string().default('CA'),
      zipCode: z.string().optional(),
    }).optional().describe('Location information for jurisdiction-specific rules'),
    documentType: z.enum(['paystub', 'w2', '1099', 'other']).default('paystub').describe('Type of document being analyzed'),
    analysisType: z.enum(['comprehensive', 'overtime-only', 'wage-only', 'breaks-only']).default('comprehensive').describe('Type of analysis to perform'),
    timePeriod: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      payPeriod: z.string().optional(),
    }).optional().describe('Time period for the analysis'),
  }),
  execute: async ({ ocrData, locationInfo, documentType = 'paystub', analysisType = 'comprehensive', timePeriod }) => {
    try {
      console.log('Performing rules analysis:', {
        documentType,
        analysisType,
        location: locationInfo?.city || 'Unknown',
        state: locationInfo?.state || 'CA'
      });

      // Call the rules analyze API
      const analyzeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/rules/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ocrData: ocrData || {},
          locationInfo,
        }),
      });

      if (!analyzeResponse.ok) {
        throw new Error(`Rules analysis failed: ${analyzeResponse.statusText}`);
      }

      const analysisData = await analyzeResponse.json();

      // Enhance the analysis with additional calculations and context
      const enhancedAnalysis = enhanceRulesAnalysis(
        analysisData,
        documentType,
        analysisType,
        locationInfo
      );

      return {
        success: true,
        analysis: enhancedAnalysis,
        documentType,
        analysisType,
        locationInfo,
        timePeriod,
        analyzedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Rules analysis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rules analysis error',
        documentType,
        analysisType,
        locationInfo,
      };
    }
  },
});

// Penalty Calculator Tool - Calculates potential penalties and interest
export const penaltyCalculatorTool = tool({
  description: 'Calculate potential penalties, interest, and waiting time penalties for wage violations. This tool helps estimate the total amount that may be owed.',
  inputSchema: z.object({
    violations: z.array(z.object({
      type: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      actualValue: z.number().optional(),
      expectedValue: z.number().optional(),
      laborCode: z.string().optional(),
    })).describe('List of violations to calculate penalties for'),
    wageData: z.object({
      regularHourlyRate: z.number().optional(),
      overtimeHours: z.number().optional(),
      regularHours: z.number().optional(),
      payPeriods: z.number().optional(),
      timePeriod: z.string().optional(),
    }).optional().describe('Wage data for calculations'),
    violationPeriod: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      durationMonths: z.number().optional(),
    }).optional().describe('Period over which violations occurred'),
    jurisdiction: z.string().default('CA').describe('Jurisdiction for penalty calculations'),
    calculationType: z.enum(['conservative', 'moderate', 'maximum']).default('moderate').describe('Approach to penalty calculation'),
  }),
  execute: async ({ violations, wageData, violationPeriod, jurisdiction = 'CA', calculationType = 'moderate' }) => {
    try {
      console.log('Calculating penalties:', {
        violationsCount: violations.length,
        jurisdiction,
        calculationType
      });

      const penaltyCalculation = calculatePenalties(
        violations,
        wageData || {},
        violationPeriod || {},
        jurisdiction,
        calculationType
      );

      return {
        success: true,
        calculation: penaltyCalculation,
        violationsCount: violations.length,
        jurisdiction,
        calculationType,
        calculatedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Penalty calculation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Penalty calculation error',
        violationsCount: violations.length,
        jurisdiction,
      };
    }
  },
});

// Compliance Score Tool - Calculate overall compliance score
export const complianceScoreTool = tool({
  description: 'Calculate an overall compliance score for the employer based on the analysis results. This helps assess the overall compliance level.',
  inputSchema: z.object({
    violations: z.array(z.object({
      severity: z.enum(['low', 'medium', 'high']),
      confidence: z.number(),
      type: z.string(),
    })).describe('List of violations found'),
    documentQuality: z.object({
      overallConfidence: z.number(),
      completeness: z.number(),
      readability: z.number(),
    }).optional().describe('Quality metrics for the document'),
    employerSize: z.enum(['small', 'medium', 'large', 'enterprise']).default('medium').describe('Size of the employer'),
    industry: z.string().optional().describe('Industry of the employer'),
    historicalCompliance: z.number().optional().describe('Historical compliance score (0-100)'),
  }),
  execute: async ({ violations, documentQuality, employerSize = 'medium', industry, historicalCompliance = 75 }) => {
    try {
      console.log('Calculating compliance score:', {
        violationsCount: violations.length,
        employerSize,
        industry
      });

      const complianceScore = calculateComplianceScore(
        violations,
        documentQuality,
        employerSize,
        industry,
        historicalCompliance
      );

      return {
        success: true,
        complianceScore,
        recommendations: getComplianceRecommendations(complianceScore.score, violations),
        benchmark: getEmployerBenchmark(employerSize, industry),
        calculatedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Compliance score calculation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compliance score error',
      };
    }
  },
});

// Helper functions for enhanced functionality
function enhanceRulesAnalysis(analysis: any, documentType: string, analysisType: string, locationInfo?: any) {
  const enhanced = { ...analysis };

  // Add financial impact calculations
  if (analysis.violations && analysis.violations.length > 0) {
    enhanced.financialImpact = calculateFinancialImpact(analysis.violations);
    enhanced.riskAssessment = assessRiskLevel(analysis.violations);
    enhanced.urgencyLevel = determineUrgency(analysis.violations);
  }

  // Add jurisdiction-specific information
  if (locationInfo?.city) {
    enhanced.jurisdictionalDetails = {
      city: locationInfo.city,
      county: getCountyForCity(locationInfo.city),
      localMinimumWage: getLocalMinimumWage(locationInfo.city),
      additionalProtections: getAdditionalLocalProtections(locationInfo.city),
    };
  }

  // Add document completeness score
  enhanced.documentCompleteness = calculateDocumentCompleteness(analysis, documentType);

  // Add next step recommendations
  enhanced.recommendedActions = generateRecommendedActions(analysis.violations, analysisType);

  return enhanced;
}

function calculateFinancialImpact(violations: any[]) {
  let totalUnpaidWages = 0;
  let totalPenalties = 0;
  let totalInterest = 0;

  violations.forEach(violation => {
    switch (violation.violationType) {
      case 'Daily Overtime Violation':
      case 'Weekly Overtime Violation':
        if (violation.actualValue !== undefined && violation.expectedValue !== undefined) {
          const missedHours = (violation.expectedValue || 0) - (violation.actualValue || 0);
          const hourlyRate = 25; // Estimated average hourly rate
          totalUnpaidWages += missedHours * hourlyRate * 0.5; // 0.5x additional for overtime
        }
        break;

      case 'Minimum Wage Violation':
        if (violation.actualValue !== undefined && violation.expectedValue !== undefined) {
          const hourlyDifference = (violation.expectedValue || 0) - (violation.actualValue || 0);
          totalUnpaidWages += hourlyDifference * 160; // Assuming 160 hours per month
        }
        break;

      case 'Meal Break Violation':
        totalPenalties += 50; // Meal break penalty per violation
        break;

      case 'Rest Break Violation':
        totalPenalties += 25; // Rest break penalty per violation
        break;
    }
  });

  // Add waiting time penalties (typically 1 day's wages for 30 days of violation)
  const waitingTimePenalties = totalUnpaidWages * 0.1;
  totalPenalties += waitingTimePenalties;

  // Add interest (typically 10% per annum)
  totalInterest = (totalUnpaidWages + totalPenalties) * 0.1;

  return {
    totalUnpaidWages: Math.round(totalUnpaidWages * 100) / 100,
    totalPenalties: Math.round(totalPenalties * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalRecovery: Math.round((totalUnpaidWages + totalPenalties + totalInterest) * 100) / 100,
    breakdown: {
      unpaidWages: totalUnpaidWages,
      statutoryPenalties: totalPenalties - waitingTimePenalties,
      waitingTimePenalties,
      interest: totalInterest,
    },
  };
}

function assessRiskLevel(violations: any[]) {
  const highSeverityCount = violations.filter(v => v.severity === 'high').length;
  const totalViolations = violations.length;

  if (highSeverityCount >= 3 || totalViolations >= 8) {
    return { level: 'High', score: 85, description: 'Multiple serious violations requiring immediate attention' };
  } else if (highSeverityCount >= 1 || totalViolations >= 4) {
    return { level: 'Medium', score: 65, description: 'Significant violations that should be addressed promptly' };
  } else if (totalViolations >= 1) {
    return { level: 'Low', score: 35, description: 'Minor violations that should be corrected' };
  } else {
    return { level: 'Minimal', score: 5, description: 'No significant violations detected' };
  }
}

function determineUrgency(violations: any[]) {
  const hasHighSeverity = violations.some(v => v.severity === 'high');
  const hasWageViolations = violations.some(v =>
    v.violationType.includes('Overtime') ||
    v.violationType.includes('Minimum Wage')
  );

  if (hasHighSeverity && hasWageViolations) {
    return { level: 'Immediate', timeframe: '1-3 days', reason: 'Wage violations require immediate action' };
  } else if (hasHighSeverity) {
    return { level: 'Urgent', timeframe: '1 week', reason: 'Serious violations need prompt attention' };
  } else if (violations.length > 0) {
    return { level: 'Moderate', timeframe: '2-4 weeks', reason: 'Corrective action recommended' };
  } else {
    return { level: 'Low', timeframe: 'Ongoing', reason: 'Continue monitoring' };
  }
}

function calculateDocumentCompleteness(analysis: any, documentType: string) {
  let score = 100;
  const issues = [];

  if (analysis.violations) {
    const missingInfoViolation = analysis.violations.find((v: any) =>
      v.violationType === 'Pay Stub Requirements Violation'
    );

    if (missingInfoViolation) {
      score -= 30;
      issues.push('Missing required information');
    }
  }

  // Check confidence levels
  if (analysis.summary?.averageConfidence) {
    const avgConfidence = analysis.summary.averageConfidence;
    if (avgConfidence < 0.8) {
      score -= (0.8 - avgConfidence) * 100;
      issues.push('Low extraction confidence');
    }
  }

  return {
    score: Math.max(0, Math.round(score)),
    grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
    issues,
    recommendations: issues.length > 0 ? ['Improve document quality', 'Ensure all required fields are present'] : [],
  };
}

function generateRecommendedActions(violations: any[], analysisType: string) {
  const actions = [];

  if (violations.length === 0) {
    actions.push({
      priority: 'Low',
      action: 'Continue regular monitoring',
      timeframe: 'Ongoing',
      description: 'Maintain current compliance practices',
    });
    return actions;
  }

  const highSeverityViolations = violations.filter(v => v.severity === 'high');
  const mediumSeverityViolations = violations.filter(v => v.severity === 'medium');

  if (highSeverityViolations.length > 0) {
    actions.push({
      priority: 'Critical',
      action: 'Immediate legal consultation',
      timeframe: '1-3 days',
      description: 'Consult with employment attorney due to serious violations',
    });

    actions.push({
      priority: 'High',
      action: 'Document all evidence',
      timeframe: 'Immediate',
      description: 'Preserve all relevant documents and communications',
    });
  }

  if (mediumSeverityViolations.length > 0) {
    actions.push({
      priority: 'Medium',
      action: 'Schedule discussion with employer',
      timeframe: '1-2 weeks',
      description: 'Address compliance issues through proper channels',
    });
  }

  actions.push({
    priority: 'Medium',
    action: 'File wage claim if necessary',
    timeframe: '30 days',
    description: 'Consider filing with Labor Commissioner if issues not resolved',
  });

  return actions;
}

function calculatePenalties(violations: any[], wageData: any, violationPeriod: any, jurisdiction: string, calculationType: string) {
  const basePenalties = {
    conservative: 0.8,
    moderate: 1.0,
    maximum: 1.5,
  };

  const multiplier = basePenalties[calculationType as keyof typeof basePenalties];

  let totalPenalties = 0;
  const breakdown = [];

  violations.forEach(violation => {
    let penalty = 0;

    switch (violation.type) {
      case 'Minimum Wage Violation':
        if (wageData.regularHourlyRate && wageData.regularHours) {
          const currentWage = wageData.regularHourlyRate;
          const minWage = getMinimumWageForJurisdiction(jurisdiction);
          const wageGap = Math.max(0, minWage - currentWage);
          penalty = wageGap * wageData.regularHours * 30; // 30 days period
        }
        break;

      case 'Overtime Violation':
        if (wageData.overtimeHours && wageData.regularHourlyRate) {
          penalty = wageData.overtimeHours * wageData.regularHourlyRate * 0.5; // Additional 0.5x for overtime
        }
        break;

      case 'Meal Break Violation':
        penalty = 50 * (violationPeriod.durationMonths || 1); // $50 per violation per month
        break;

      case 'Rest Break Violation':
        penalty = 25 * (violationPeriod.durationMonths || 1); // $25 per violation per month
        break;

      default:
        penalty = 100; // Base penalty for other violations
    }

    penalty *= multiplier;
    totalPenalties += penalty;

    breakdown.push({
      violationType: violation.type,
      basePenalty: penalty / multiplier,
      calculatedPenalty: penalty,
      multiplier: multiplier,
    });
  });

  // Add waiting time penalties (typically 1 day's wages per 30 days of violation)
  const waitingTimePenalty = (wageData.regularHourlyRate || 25) * 8 * (violationPeriod.durationMonths || 1) * 0.1;
  totalPenalties += waitingTimePenalty;

  // Add interest (typically 10% per annum, prorated)
  const monthlyInterestRate = 0.10 / 12;
  const interest = totalPenalties * monthlyInterestRate * (violationPeriod.durationMonths || 1);
  totalPenalties += interest;

  return {
    totalPenalties: Math.round(totalPenalties * 100) / 100,
    breakdown,
    waitingTimePenalty: Math.round(waitingTimePenalty * 100) / 100,
    interest: Math.round(interest * 100) / 100,
    calculationMethod: calculationType,
    jurisdiction,
  };
}

function calculateComplianceScore(violations: any[], documentQuality?: any, employerSize: string, industry?: string, historicalCompliance: number = 75) {
  let score = historicalCompliance;

  // Deduct points for violations
  violations.forEach(violation => {
    switch (violation.severity) {
      case 'high':
        score -= 20;
        break;
      case 'medium':
        score -= 10;
        break;
      case 'low':
        score -= 5;
        break;
    }
  });

  // Adjust for document quality
  if (documentQuality) {
    const qualityScore = (documentQuality.overallConfidence + documentQuality.completeness + documentQuality.readability) / 3;
    score = score * 0.7 + qualityScore * 30; // 70% historical, 30% current quality
  }

  // Apply employer size adjustments
  const sizeAdjustments: Record<string, number> = {
    small: -5,   // Small businesses may have fewer resources
    medium: 0,   // Baseline
    large: 5,    // Large businesses should have better compliance
    enterprise: 10, // Enterprise should have excellent compliance
  };

  score += sizeAdjustments[employerSize] || 0;

  // Apply industry adjustments
  if (industry) {
    const industryAdjustments: Record<string, number> = {
      'restaurant': -10,  // High violation industry
      'retail': -5,
      'construction': -8,
      'healthcare': 3,
      'technology': 5,
      'government': 8,
    };

    score += industryAdjustments[industry.toLowerCase()] || 0;
  }

  score = Math.max(0, Math.min(100, score)); // Clamp between 0-100

  return {
    score: Math.round(score),
    grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
    level: score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : 'Poor',
    factors: {
      violations: violations.length,
      documentQuality: documentQuality ? Math.round((documentQuality.overallConfidence + documentQuality.completeness + documentQuality.readability) / 3 * 100) : 0,
      employerSize,
      industry,
    },
  };
}

function getComplianceRecommendations(score: number, violations: any[]) {
  const recommendations = [];

  if (score < 60) {
    recommendations.push({
      priority: 'Critical',
      category: 'Immediate Action',
      recommendation: 'Implement comprehensive compliance review and corrective action plan',
    });
  } else if (score < 80) {
    recommendations.push({
      priority: 'High',
      category: 'Process Improvement',
      recommendation: 'Review and strengthen compliance procedures',
    });
  }

  const violationTypes = [...new Set(violations.map(v => v.type))];
  violationTypes.forEach(type => {
    recommendations.push({
      priority: 'Medium',
      category: 'Violation-Specific',
      recommendation: `Address ${type} with targeted corrective measures`,
    });
  });

  recommendations.push({
    priority: 'Ongoing',
    category: 'Prevention',
    recommendation: 'Implement regular compliance monitoring and training',
  });

  return recommendations;
}

function getEmployerBenchmark(employerSize: string, industry?: string) {
  const benchmarks: Record<string, any> = {
    small: { average: 72, median: 75, topQuartile: 85 },
    medium: { average: 78, median: 80, topQuartile: 90 },
    large: { average: 85, median: 88, topQuartile: 95 },
    enterprise: { average: 90, median: 92, topQuartile: 98 },
  };

  const industryBenchmarks: Record<string, any> = {
    'restaurant': { average: 65, median: 68, topQuartile: 80 },
    'retail': { average: 72, median: 75, topQuartile: 85 },
    'construction': { average: 70, median: 73, topQuartile: 83 },
    'healthcare': { average: 82, median: 85, topQuartile: 92 },
    'technology': { average: 88, median: 90, topQuartile: 96 },
    'government': { average: 92, median: 94, topQuartile: 98 },
  };

  return {
    employerSize: benchmarks[employerSize] || benchmarks.medium,
    industry: industry ? industryBenchmarks[industry.toLowerCase()] : null,
  };
}

// Utility functions
function getCountyForCity(city: string): string {
  const cityToCounty: Record<string, string> = {
    'Los Angeles': 'Los Angeles County',
    'San Francisco': 'San Francisco County',
    'San Diego': 'San Diego County',
    'Santa Clara': 'Santa Clara County',
    'Oakland': 'Alameda County',
  };

  return cityToCounty[city] || 'Unknown County';
}

function getLocalMinimumWage(city: string): number {
  const localWages: Record<string, number> = {
    'Los Angeles': 16.78,
    'San Francisco': 18.07,
    'San Diego': 16.30,
    'Santa Clara': 17.20,
    'Oakland': 16.94,
  };

  return localWages[city] || 16.00; // California state minimum
}

function getAdditionalLocalProtections(city: string): string[] {
  const protections: Record<string, string[]> = {
    'Los Angeles': [
      'Fair Workweek Ordinance',
      'Retaliation Protection Ordinance',
      'Hotel Worker Protection',
    ],
    'San Francisco': [
      'Paid Sick Leave Ordinance',
      'Family Friendly Workplace Ordinance',
      'Retail Worker Bill of Rights',
    ],
  };

  return protections[city] || [];
}

function getMinimumWageForJurisdiction(jurisdiction: string): number {
  const minWages: Record<string, number> = {
    'CA': 16.00,
    'LOS_ANGELES': 16.78,
    'SAN_FRANCISCO': 18.07,
    'SAN_DIEGO': 16.30,
    'SANTA_CLARA': 17.20,
    'OAKLAND': 16.94,
  };

  return minWages[jurisdiction.toUpperCase()] || 16.00;
}
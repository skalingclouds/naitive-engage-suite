import { NextRequest, NextResponse } from 'next/server';

interface OCRData {
  employeeName?: { value: string; confidence: number };
  employerName?: { value: string; confidence: number };
  payPeriod?: { value: string; confidence: number };
  grossPay?: { value: number; confidence: number };
  netPay?: { value: number; confidence: number };
  regularHours?: { value: number; confidence: number };
  overtimeHours?: { value: number; confidence: number };
  doubleTimeHours?: { value: number; confidence: number };
  hourlyRate?: { value: number; confidence: number };
  overtimeRate?: { value: number; confidence: number };
  doubleTimeRate?: { value: number; confidence: number };
  federalTax?: { value: number; confidence: number };
  stateTax?: { value: number; confidence: number };
  socialSecurity?: { value: number; confidence: number };
  medicare?: { value: number; confidence: number };
}

interface LocationInfo {
  city?: string;
  state?: string;
  zipCode?: string;
}

interface RulesAnalysisRequest {
  ocrData: OCRData;
  locationInfo?: LocationInfo;
}

interface RulesAnalysisResponse {
  violations: Array<{
    violationType: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    confidence: number;
    laborCode: string;
    actualValue?: number;
    expectedValue?: number;
    recommendation?: string;
  }>;
  summary: {
    totalViolations: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    averageConfidence: number;
  };
  analysisTimestamp: string;
  rulesEngineVersion: string;
}

// Mock rules engine implementation
// In production, this would call the Azure Function
class CaliforniaLaborRulesEngine {
  analyzePayStub(ocrData: OCRData, locationInfo?: LocationInfo): RulesAnalysisResponse {
    const violations = [];
    
    // Extract values from OCR data
    const getValue = (field: string, defaultValue = 0) => {
      const data = ocrData[field as keyof OCRData] as any;
      return data?.value || defaultValue;
    };
    
    const regularHours = getValue('regularHours', 0);
    const overtimeHours = getValue('overtimeHours', 0);
    const doubleTimeHours = getValue('doubleTimeHours', 0);
    const hourlyRate = getValue('hourlyRate', 0);
    const overtimeRate = getValue('overtimeRate', 0);
    const doubleTimeRate = getValue('doubleTimeRate', 0);
    const grossPay = getValue('grossPay', 0);
    
    const totalHours = regularHours + overtimeHours + doubleTimeHours;
    
    // Overtime violations
    if (totalHours > 40) {
      const expectedWeeklyOT = totalHours - 40;
      if (overtimeHours < expectedWeeklyOT) {
        violations.push({
          violationType: "Weekly Overtime Violation",
          description: `Employee worked ${totalHours} hours in the week but was only paid for ${overtimeHours} overtime hours. California law requires 1.5x regular rate for hours over 40 per week.`,
          severity: "high" as const,
          confidence: 0.90,
          laborCode: "CA Labor Code § 510",
          actualValue: overtimeHours,
          expectedValue: expectedWeeklyOT,
          recommendation: "Pay overtime for all hours worked over 40 hours per week at 1.5x regular rate"
        });
      }
    }
    
    if (totalHours > 8) {
      const expectedDailyOT = totalHours - 8;
      if (overtimeHours < expectedDailyOT) {
        violations.push({
          violationType: "Daily Overtime Violation",
          description: `Employee worked ${totalHours} hours but was only paid for ${overtimeHours} overtime hours. California law requires 1.5x regular rate for hours over 8 per day.`,
          severity: "high" as const,
          confidence: 0.95,
          laborCode: "CA Labor Code § 510",
          actualValue: overtimeHours,
          expectedValue: expectedDailyOT,
          recommendation: "Pay overtime for all hours worked over 8 hours per day at 1.5x regular rate"
        });
      }
    }
    
    if (totalHours > 12) {
      const expectedDoubleTime = totalHours - 12;
      if (doubleTimeHours < expectedDoubleTime) {
        violations.push({
          violationType: "Double Time Violation",
          description: `Employee worked ${totalHours} hours but was only paid for ${doubleTimeHours} double time hours. California law requires 2x regular rate for hours over 12 per day.`,
          severity: "high" as const,
          confidence: 0.88,
          laborCode: "CA Labor Code § 510",
          actualValue: doubleTimeHours,
          expectedValue: expectedDoubleTime,
          recommendation: "Pay double time for all hours worked over 12 hours per day at 2x regular rate"
        });
      }
    }
    
    // Overtime rate check
    const expectedOvertimeRate = hourlyRate * 1.5;
    if (overtimeRate > 0 && overtimeRate < expectedOvertimeRate) {
      violations.push({
        violationType: "Overtime Rate Violation",
        description: `Overtime rate of $${overtimeRate}/hr is below California requirement of $${expectedOvertimeRate.toFixed(2)}/hr (1.5x regular rate).`,
        severity: "high" as const,
        confidence: 0.95,
        laborCode: "CA Labor Code § 510",
        actualValue: overtimeRate,
        expectedValue: expectedOvertimeRate,
        recommendation: "Pay proper overtime rate of 1.5x regular hourly rate"
      });
    }
    
    // Meal break violations
    if (totalHours >= 5 && totalHours < 10) {
      violations.push({
        violationType: "Meal Break Violation",
        description: `Employee worked ${totalHours} hours but may not have received the required 30-minute meal break. California law requires meal breaks for shifts over 5 hours.`,
        severity: "medium" as const,
        confidence: 0.85,
        laborCode: "CA Labor Code § 512",
        recommendation: "Provide 30-minute meal breaks for shifts over 5 hours or pay meal break premium of 1 hour of pay"
      });
    }
    
    if (totalHours >= 10) {
      violations.push({
        violationType: "Second Meal Break Violation",
        description: `Employee worked ${totalHours} hours but may not have received the required second meal break. California law requires second meal break for shifts over 10 hours.`,
        severity: "medium" as const,
        confidence: 0.90,
        laborCode: "CA Labor Code § 512",
        recommendation: "Provide second 30-minute meal break for shifts over 10 hours or pay additional meal break premium"
      });
    }
    
    // Rest break violations
    if (totalHours >= 4) {
      const requiredBreaks = Math.floor(totalHours / 4);
      if (requiredBreaks > 0) {
        violations.push({
          violationType: "Rest Break Violation",
          description: `Employee worked ${totalHours} hours and should receive ${requiredBreaks} rest breaks. Rest breaks must be paid.`,
          severity: "medium" as const,
          confidence: 0.80,
          laborCode: "CA Labor Code § 226",
          recommendation: "Provide paid 10-minute rest breaks for every 4 hours worked"
        });
      }
    }
    
    // Minimum wage violations
    const minWageRates: Record<string, number> = {
      'CA': 16.00,
      'LOS_ANGELES': 16.78,
      'SAN_FRANCISCO': 18.07,
      'SAN_DIEGO': 16.30
    };
    
    let applicableMinWage = minWageRates.CA;
    if (locationInfo?.city) {
      const city = locationInfo.city.toUpperCase().replace(' ', '_');
      if (minWageRates[city]) {
        applicableMinWage = minWageRates[city];
      }
    }
    
    if (hourlyRate > 0 && hourlyRate < applicableMinWage) {
      violations.push({
        violationType: "Minimum Wage Violation",
        description: `Hourly rate of $${hourlyRate}/hr is below the applicable minimum wage of $${applicableMinWage}/hr.`,
        severity: "high" as const,
        confidence: 0.98,
        laborCode: "CA Labor Code § 1182.12",
        actualValue: hourlyRate,
        expectedValue: applicableMinWage,
        recommendation: `Increase hourly rate to meet minimum wage of $${applicableMinWage}/hr`
      });
    }
    
    // Pay stub requirements
    const requiredFields = ['employeeName', 'employerName', 'payPeriod', 'grossPay', 'regularHours', 'hourlyRate'];
    const missingFields = [];
    const lowConfidenceFields = [];
    
    for (const field of requiredFields) {
      const fieldData = ocrData[field as keyof OCRData] as any;
      if (!fieldData || !fieldData.value) {
        missingFields.push(field.replace(/([A-Z])/g, ' $1').toLowerCase());
      } else if (fieldData.confidence < 0.70) {
        lowConfidenceFields.push(field.replace(/([A-Z])/g, ' $1').toLowerCase());
      }
    }
    
    if (missingFields.length > 0) {
      violations.push({
        violationType: "Pay Stub Requirements Violation",
        description: `Missing required information on pay stub: ${missingFields.join(', ')}. California law requires specific itemized wage statements.`,
        severity: "medium" as const,
        confidence: 0.95,
        laborCode: "CA Labor Code § 226",
        recommendation: "Include all required information on pay stubs"
      });
    }
    
    if (lowConfidenceFields.length > 0) {
      violations.push({
        violationType: "Pay Stub Readability Issue",
        description: `Low confidence extraction for: ${lowConfidenceFields.join(', ')}. Pay stub may be unclear or missing required information.`,
        severity: "low" as const,
        confidence: 0.75,
        laborCode: "CA Labor Code § 226",
        recommendation: "Ensure pay stub information is clearly legible and complete"
      });
    }
    
    // Sort violations by severity and confidence
    violations.sort((a, b) => {
      const severityRank = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityRank[b.severity] - severityRank[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });
    
    return {
      violations,
      summary: {
        totalViolations: violations.length,
        highSeverity: violations.filter(v => v.severity === 'high').length,
        mediumSeverity: violations.filter(v => v.severity === 'medium').length,
        lowSeverity: violations.filter(v => v.severity === 'low').length,
        averageConfidence: violations.length > 0 
          ? violations.reduce((sum, v) => sum + v.confidence, 0) / violations.length 
          : 0.0
      },
      analysisTimestamp: new Date().toISOString(),
      rulesEngineVersion: '1.0.0'
    };
  }
}

const rulesEngine = new CaliforniaLaborRulesEngine();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RulesAnalysisRequest;
    
    if (!body.ocrData) {
      return NextResponse.json(
        { error: 'OCR data is required' },
        { status: 400 }
      );
    }
    
    // Analyze pay stub data
    const result = rulesEngine.analyzePayStub(body.ocrData, body.locationInfo);
    
    console.log('Rules engine analysis completed:', {
      totalViolations: result.summary.totalViolations,
      highSeverity: result.summary.highSeverity,
      averageConfidence: result.summary.averageConfidence
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in rules analysis:', error);
    return NextResponse.json(
      { error: 'Internal server error during rules analysis' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return rules engine information
    const rulesInfo = {
      rulesEngine: {
        name: 'California Labor Code Rules Engine',
        version: '1.0.0',
        description: 'Tier 1 California labor law violation detection'
      },
      supportedViolations: [
        {
          type: 'Daily Overtime Violation',
          description: 'Overtime pay for hours over 8 per day',
          laborCode: 'CA Labor Code § 510',
          severity: 'high'
        },
        {
          type: 'Weekly Overtime Violation',
          description: 'Overtime pay for hours over 40 per week',
          laborCode: 'CA Labor Code § 510',
          severity: 'high'
        },
        {
          type: 'Double Time Violation',
          description: 'Double time pay for hours over 12 per day',
          laborCode: 'CA Labor Code § 510',
          severity: 'high'
        },
        {
          type: 'Meal Break Violation',
          description: 'Required meal breaks for shifts over 5 hours',
          laborCode: 'CA Labor Code § 512',
          severity: 'medium'
        },
        {
          type: 'Rest Break Violation',
          description: 'Paid rest breaks for every 4 hours worked',
          laborCode: 'CA Labor Code § 226',
          severity: 'medium'
        },
        {
          type: 'Minimum Wage Violation',
          description: 'Hourly rate below applicable minimum wage',
          laborCode: 'CA Labor Code § 1182.12',
          severity: 'high'
        },
        {
          type: 'Pay Stub Requirements Violation',
          description: 'Missing required information on pay stub',
          laborCode: 'CA Labor Code § 226',
          severity: 'medium'
        }
      ],
      minimumWageRates: {
        'State': '16.00',
        'Los Angeles': '16.78',
        'San Francisco': '18.07',
        'San Diego': '16.30',
        'Santa Clara': '17.20',
        'Oakland': '16.94'
      },
      constants: {
        dailyOvertimeThreshold: '8.0 hours',
        weeklyOvertimeThreshold: '40.0 hours',
        dailyDoubleTimeThreshold: '12.0 hours',
        overtimeMultiplier: '1.5x',
        doubleTimeMultiplier: '2.0x',
        mealBreakThreshold: '5.0 hours',
        secondMealBreakThreshold: '10.0 hours',
        restBreakInterval: '4.0 hours'
      }
    };
    
    return NextResponse.json(rulesInfo);
    
  } catch (error) {
    console.error('Error getting rules info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
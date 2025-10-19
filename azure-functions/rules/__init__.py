import logging
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import azure.functions as func

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = func.FunctionApp()

@dataclass
class WorkData:
    """Structured work data from OCR processing"""
    regular_hours: Decimal
    overtime_hours: Decimal
    double_time_hours: Decimal
    hourly_rate: Decimal
    overtime_rate: Decimal
    double_time_rate: Decimal
    gross_pay: Decimal
    net_pay: Decimal
    pay_period_start: Optional[datetime] = None
    pay_period_end: Optional[datetime] = None
    employee_name: str = ""
    employer_name: str = ""

@dataclass
class Violation:
    """Represents a detected labor law violation"""
    violation_type: str
    description: str
    severity: str  # 'low', 'medium', 'high'
    confidence: float
    labor_code: str
    actual_value: Optional[Decimal] = None
    expected_value: Optional[Decimal] = None
    recommendation: Optional[str] = None

class CaliforniaLaborRulesEngine:
    """
    California Labor Code Rules Engine
    
    Implements Tier 1 California labor law violations:
    - Overtime calculations (daily and weekly)
    - Meal break premiums (LC §512)
    - Rest break premiums
    - Pay stub requirements (LC §226)
    """
    
    def __init__(self):
        # California labor constants
        self.daily_overtime_threshold = Decimal('8.0')
        self.weekly_overtime_threshold = Decimal('40.0')
        self.daily_double_time_threshold = Decimal('12.0')
        self.overtime_multiplier = Decimal('1.5')
        self.double_time_multiplier = Decimal('2.0')
        
        # Meal break requirements
        self.meal_break_threshold = Decimal('5.0')  # 5 hours
        self.second_meal_break_threshold = Decimal('10.0')  # 10 hours
        self.meal_break_duration = Decimal('0.5')  # 30 minutes
        self.meal_break_premium_rate = Decimal('1.0')  # 1 hour of pay
        
        # Rest break requirements
        self.rest_break_interval = Decimal('4.0')  # Every 4 hours
        self.rest_break_duration = Decimal('10')  # 10 minutes in minutes
        
        # Minimum wage (will be updated based on location)
        self.min_wage_rates = {
            'CA': Decimal('16.00'),  # 2024 California minimum wage
            'LOS_ANGELES': Decimal('16.78'),
            'SAN_FRANCISCO': Decimal('18.07'),
            'SAN_DIEGO': Decimal('16.30'),
            'SANTA_CLARA': Decimal('17.20'),
            'OAKLAND': Decimal('16.94')
        }
    
    def analyze_pay_stub(self, ocr_data: Dict[str, Any], location_info: Dict[str, str] = None) -> List[Violation]:
        """
        Analyze pay stub data for California labor law violations
        
        Args:
            ocr_data: Extracted data from OCR processing
            location_info: Worker location (city, state) for minimum wage calculations
            
        Returns:
            List of detected violations
        """
        violations = []
        
        try:
            # Parse OCR data into WorkData object
            work_data = self._parse_ocr_data(ocr_data)
            
            # Run all rule checks
            violations.extend(self._check_overtime_violations(work_data))
            violations.extend(self._check_meal_break_violations(work_data))
            violations.extend(self._check_rest_break_violations(work_data))
            violations.extend(self._check_minimum_wage_violations(work_data, location_info))
            violations.extend(self._check_pay_stub_requirements(ocr_data))
            violations.extend(self._check_pay_rate_calculations(work_data))
            
            # Sort violations by severity and confidence
            violations.sort(key=lambda v: (self._severity_rank(v.severity), v.confidence), reverse=True)
            
            logger.info(f"Analysis complete. Found {len(violations)} violations.")
            
        except Exception as e:
            logger.error(f"Error analyzing pay stub: {str(e)}")
            violations.append(Violation(
                violation_type="Processing Error",
                description=f"Error during analysis: {str(e)}",
                severity="low",
                confidence=1.0,
                labor_code="N/A"
            ))
        
        return violations
    
    def _parse_ocr_data(self, ocr_data: Dict[str, Any]) -> WorkData:
        """Parse OCR data into structured WorkData object"""
        
        def safe_decimal(value: Any, default: Decimal = Decimal('0')) -> Decimal:
            """Safely convert value to Decimal"""
            if isinstance(value, dict) and 'value' in value:
                value = value['value']
            
            try:
                if value is None or value == "":
                    return default
                return Decimal(str(value).replace('$', '').replace(',', ''))
            except (ValueError, TypeError):
                return default
        
        def safe_string(value: Any, default: str = "") -> str:
            """Safely convert value to string"""
            if isinstance(value, dict) and 'value' in value:
                value = value['value']
            return str(value) if value else default
        
        # Parse dates
        pay_period_start = None
        pay_period_end = None
        pay_period_str = safe_string(ocr_data.get('payPeriod', ''))
        
        if ' - ' in pay_period_str:
            try:
                start_str, end_str = pay_period_str.split(' - ')
                # Parse various date formats
                for fmt in ['%m/%d/%Y', '%m-%d-%Y', '%Y-%m-%d']:
                    try:
                        pay_period_start = datetime.strptime(start_str.strip(), fmt)
                        pay_period_end = datetime.strptime(end_str.strip(), fmt)
                        break
                    except ValueError:
                        continue
            except Exception:
                pass
        
        return WorkData(
            regular_hours=safe_decimal(ocr_data.get('regularHours')),
            overtime_hours=safe_decimal(ocr_data.get('overtimeHours')),
            double_time_hours=safe_decimal(ocr_data.get('doubleTimeHours')),
            hourly_rate=safe_decimal(ocr_data.get('hourlyRate')),
            overtime_rate=safe_decimal(ocr_data.get('overtimeRate')),
            double_time_rate=safe_decimal(ocr_data.get('doubleTimeRate')),
            gross_pay=safe_decimal(ocr_data.get('grossPay')),
            net_pay=safe_decimal(ocr_data.get('netPay')),
            pay_period_start=pay_period_start,
            pay_period_end=pay_period_end,
            employee_name=safe_string(ocr_data.get('employeeName')),
            employer_name=safe_string(ocr_data.get('employerName'))
        )
    
    def _check_overtime_violations(self, work_data: WorkData) -> List[Violation]:
        """Check for overtime violations"""
        violations = []
        
        total_hours = work_data.regular_hours + work_data.overtime_hours + work_data.double_time_hours
        
        # Daily overtime check (if we have daily breakdown)
        if total_hours > self.daily_overtime_threshold:
            # Calculate expected overtime hours
            expected_daily_ot = max(Decimal('0'), total_hours - self.daily_overtime_threshold)
            
            if work_data.overtime_hours < expected_daily_ot:
                violation = Violation(
                    violation_type="Daily Overtime Violation",
                    description=f"Employee worked {total_hours} hours but was only paid for {work_data.overtime_hours} overtime hours. California law requires 1.5x regular rate for hours over 8 per day.",
                    severity="high",
                    confidence=0.95,
                    labor_code="CA Labor Code § 510",
                    actual_value=work_data.overtime_hours,
                    expected_value=expected_daily_ot,
                    recommendation="Pay overtime for all hours worked over 8 hours per day at 1.5x regular rate"
                )
                violations.append(violation)
        
        # Weekly overtime check
        if total_hours > self.weekly_overtime_threshold:
            expected_weekly_ot = max(Decimal('0'), total_hours - self.weekly_overtime_threshold)
            
            if work_data.overtime_hours < expected_weekly_ot:
                violation = Violation(
                    violation_type="Weekly Overtime Violation",
                    description=f"Employee worked {total_hours} hours in the week but was only paid for {work_data.overtime_hours} overtime hours. California law requires 1.5x regular rate for hours over 40 per week.",
                    severity="high",
                    confidence=0.90,
                    labor_code="CA Labor Code § 510",
                    actual_value=work_data.overtime_hours,
                    expected_value=expected_weekly_ot,
                    recommendation="Pay overtime for all hours worked over 40 hours per week at 1.5x regular rate"
                )
                violations.append(violation)
        
        # Double time check
        if total_hours > self.daily_double_time_threshold:
            expected_double_time = max(Decimal('0'), total_hours - self.daily_double_time_threshold)
            
            if work_data.double_time_hours < expected_double_time:
                violation = Violation(
                    violation_type="Double Time Violation",
                    description=f"Employee worked {total_hours} hours but was only paid for {work_data.double_time_hours} double time hours. California law requires 2x regular rate for hours over 12 per day.",
                    severity="high",
                    confidence=0.88,
                    labor_code="CA Labor Code § 510",
                    actual_value=work_data.double_time_hours,
                    expected_value=expected_double_time,
                    recommendation="Pay double time for all hours worked over 12 hours per day at 2x regular rate"
                )
                violations.append(violation)
        
        # Overtime rate check
        expected_overtime_rate = (work_data.hourly_rate * self.overtime_multiplier).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if work_data.overtime_rate > 0 and work_data.overtime_rate < expected_overtime_rate:
            violation = Violation(
                violation_type="Overtime Rate Violation",
                description=f"Overtime rate of ${work_data.overtime_rate}/hr is below California requirement of ${expected_overtime_rate}/hr (1.5x regular rate).",
                severity="high",
                confidence=0.95,
                labor_code="CA Labor Code § 510",
                actual_value=work_data.overtime_rate,
                expected_value=expected_overtime_rate,
                recommendation="Pay proper overtime rate of 1.5x regular hourly rate"
            )
            violations.append(violation)
        
        return violations
    
    def _check_meal_break_violations(self, work_data: WorkData) -> List[Violation]:
        """Check for meal break violations"""
        violations = []
        
        total_hours = work_data.regular_hours + work_data.overtime_hours + work_data.double_time_hours
        
        # First meal break (5+ hours)
        if total_hours >= self.meal_break_threshold:
            # Check if meal break premium was paid
            expected_premium = self.meal_break_premium_rate * work_data.hourly_rate
            
            # For POC, we assume no meal break premium was paid if overtime hours exceed threshold
            if total_hours >= self.meal_break_threshold and total_hours < self.second_meal_break_threshold:
                violation = Violation(
                    violation_type="Meal Break Violation",
                    description=f"Employee worked {total_hours} hours but may not have received the required 30-minute meal break. California law requires meal breaks for shifts over 5 hours.",
                    severity="medium",
                    confidence=0.85,
                    labor_code="CA Labor Code § 512",
                    recommendation="Provide 30-minute meal breaks for shifts over 5 hours or pay meal break premium of 1 hour of pay"
                )
                violations.append(violation)
        
        # Second meal break (10+ hours)
        if total_hours >= self.second_meal_break_threshold:
            violation = Violation(
                violation_type="Second Meal Break Violation",
                description=f"Employee worked {total_hours} hours but may not have received the required second meal break. California law requires second meal break for shifts over 10 hours.",
                severity="medium",
                confidence=0.90,
                labor_code="CA Labor Code § 512",
                recommendation="Provide second 30-minute meal break for shifts over 10 hours or pay additional meal break premium"
            )
            violations.append(violation)
        
        return violations
    
    def _check_rest_break_violations(self, work_data: WorkData) -> List[Violation]:
        """Check for rest break violations"""
        violations = []
        
        total_hours = work_data.regular_hours + work_data.overtime_hours + work_data.double_time_hours
        
        # Calculate required rest breaks
        if total_hours >= self.rest_break_interval:
            required_breaks = int(total_hours / self.rest_break_interval)
            
            # For POC, we assume rest breaks weren't properly compensated
            if required_breaks > 0:
                total_break_time = required_breaks * self.rest_break_duration
                break_pay = (total_break_time / Decimal('60')) * work_data.hourly_rate
                
                violation = Violation(
                    violation_type="Rest Break Violation",
                    description=f"Employee worked {total_hours} hours and should receive {required_breaks} rest breaks totaling {total_break_time} minutes. Rest breaks must be paid.",
                    severity="medium",
                    confidence=0.80,
                    labor_code="CA Labor Code § 226",
                    actual_value=Decimal('0'),
                    expected_value=break_pay,
                    recommendation="Provide paid 10-minute rest breaks for every 4 hours worked"
                )
                violations.append(violation)
        
        return violations
    
    def _check_minimum_wage_violations(self, work_data: WorkData, location_info: Dict[str, str] = None) -> List[Violation]:
        """Check for minimum wage violations"""
        violations = []
        
        # Determine applicable minimum wage
        min_wage = self.min_wage_rates['CA']  # Default to state minimum
        
        if location_info:
            city = location_info.get('city', '').upper()
            for location, rate in self.min_wage_rates.items():
                if location != 'CA' and location.replace('_', ' ') in city.replace(' ', '_'):
                    min_wage = rate
                    break
        
        # Check if hourly rate meets minimum wage
        if work_data.hourly_rate > 0 and work_data.hourly_rate < min_wage:
            violation = Violation(
                violation_type="Minimum Wage Violation",
                description=f"Hourly rate of ${work_data.hourly_rate}/hr is below the applicable minimum wage of ${min_wage}/hr.",
                severity="high",
                confidence=0.98,
                labor_code="CA Labor Code § 1182.12",
                actual_value=work_data.hourly_rate,
                expected_value=min_wage,
                recommendation=f"Increase hourly rate to meet minimum wage of ${min_wage}/hr"
            )
            violations.append(violation)
        
        return violations
    
    def _check_pay_stub_requirements(self, ocr_data: Dict[str, Any]) -> List[Violation]:
        """Check for pay stub requirements violations (LC §226)"""
        violations = []
        
        # Required fields on California pay stubs
        required_fields = {
            'employeeName': 'Employee name',
            'employerName': 'Employer name',
            'payPeriod': 'Pay period dates',
            'grossPay': 'Gross wages earned',
            'netPay': 'Net wages earned',
            'regularHours': 'Hours worked',
            'hourlyRate': 'Hourly rate of pay'
        }
        
        missing_fields = []
        low_confidence_fields = []
        
        for field, description in required_fields.items():
            field_data = ocr_data.get(field)
            
            if not field_data:
                missing_fields.append(description)
            elif isinstance(field_data, dict) and field_data.get('confidence', 0) < 0.70:
                low_confidence_fields.append(description)
        
        if missing_fields:
            violation = Violation(
                violation_type="Pay Stub Requirements Violation",
                description=f"Missing required information on pay stub: {', '.join(missing_fields)}. California law requires specific itemized wage statements.",
                severity="medium",
                confidence=0.95,
                labor_code="CA Labor Code § 226",
                recommendation="Include all required information on pay stubs"
            )
            violations.append(violation)
        
        if low_confidence_fields:
            violation = Violation(
                violation_type="Pay Stub Readability Issue",
                description=f"Low confidence extraction for: {', '.join(low_confidence_fields)}. Pay stub may be unclear or missing required information.",
                severity="low",
                confidence=0.75,
                labor_code="CA Labor Code § 226",
                recommendation="Ensure pay stub information is clearly legible and complete"
            )
            violations.append(violation)
        
        return violations
    
    def _check_pay_rate_calculations(self, work_data: WorkData) -> List[Violation]:
        """Check for calculation inconsistencies in pay rates"""
        violations = []
        
        # Check if gross pay matches calculated amount
        if work_data.regular_hours > 0 and work_data.hourly_rate > 0:
            calculated_regular_pay = work_data.regular_hours * work_data.hourly_rate
            calculated_overtime_pay = work_data.overtime_hours * work_data.overtime_rate
            calculated_double_pay = work_data.double_time_hours * work_data.double_time_rate
            total_calculated = calculated_regular_pay + calculated_overtime_pay + calculated_double_pay
            
            # Allow for some tolerance due to rounding
            tolerance = total_calculated * Decimal('0.05')  # 5% tolerance
            
            if abs(work_data.gross_pay - total_calculated) > tolerance:
                violation = Violation(
                    violation_type="Pay Calculation Discrepancy",
                    description=f"Gross pay (${work_data.gross_pay}) doesn't match calculated amount (${total_calculated:.2f}). There may be an error in pay calculations.",
                    severity="medium",
                    confidence=0.85,
                    labor_code="CA Labor Code § 226",
                    actual_value=work_data.gross_pay,
                    expected_value=total_calculated,
                    recommendation="Review and correct pay calculations to ensure accuracy"
                )
                violations.append(violation)
        
        return violations
    
    def _severity_rank(self, severity: str) -> int:
        """Helper method to sort violations by severity"""
        severity_ranks = {'high': 3, 'medium': 2, 'low': 1}
        return severity_ranks.get(severity, 0)

# Initialize rules engine
rules_engine = CaliforniaLaborRulesEngine()

@app.route(route="rules/analyze", auth_level=func.AuthLevel.FUNCTION)
async def analyze_labor_violations(req: func.HttpRequest) -> func.HttpResponse:
    """Main endpoint for labor law violation analysis"""
    try:
        req_body = req.get_json()
        
        # Extract OCR data and location info
        ocr_data = req_body.get('ocrData', {})
        location_info = req_body.get('locationInfo', {})
        
        if not ocr_data:
            return func.HttpResponse(
                json.dumps({"error": "OCR data is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Analyze for violations
        violations = rules_engine.analyze_pay_stub(ocr_data, location_info)
        
        # Convert violations to serializable format
        violations_json = []
        for violation in violations:
            violations_json.append({
                'violationType': violation.violation_type,
                'description': violation.description,
                'severity': violation.severity,
                'confidence': violation.confidence,
                'laborCode': violation.labor_code,
                'actualValue': float(violation.actual_value) if violation.actual_value else None,
                'expectedValue': float(violation.expected_value) if violation.expected_value else None,
                'recommendation': violation.recommendation
            })
        
        result = {
            'violations': violations_json,
            'summary': {
                'totalViolations': len(violations),
                'highSeverity': len([v for v in violations if v.severity == 'high']),
                'mediumSeverity': len([v for v in violations if v.severity == 'medium']),
                'lowSeverity': len([v for v in violations if v.severity == 'low']),
                'averageConfidence': sum(v.confidence for v in violations) / len(violations) if violations else 0.0
            },
            'analysisTimestamp': datetime.now().isoformat(),
            'rulesEngineVersion': '1.0.0'
        }
        
        logger.info(f"Analysis completed successfully. Found {len(violations)} violations.")
        
        return func.HttpResponse(
            json.dumps(result),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logger.error(f"Error in labor violation analysis: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

@app.route(route="rules/info", auth_level=func.AuthLevel.FUNCTION)
async def get_rules_info(req: func.HttpRequest) -> func.HttpResponse:
    """Get information about supported rules and labor codes"""
    try:
        rules_info = {
            'rulesEngine': {
                'name': 'California Labor Code Rules Engine',
                'version': '1.0.0',
                'description': 'Tier 1 California labor law violation detection'
            },
            'supportedViolations': [
                {
                    'type': 'Daily Overtime Violation',
                    'description': 'Overtime pay for hours over 8 per day',
                    'laborCode': 'CA Labor Code § 510',
                    'severity': 'high'
                },
                {
                    'type': 'Weekly Overtime Violation', 
                    'description': 'Overtime pay for hours over 40 per week',
                    'laborCode': 'CA Labor Code § 510',
                    'severity': 'high'
                },
                {
                    'type': 'Double Time Violation',
                    'description': 'Double time pay for hours over 12 per day',
                    'laborCode': 'CA Labor Code § 510',
                    'severity': 'high'
                },
                {
                    'type': 'Meal Break Violation',
                    'description': 'Required meal breaks for shifts over 5 hours',
                    'laborCode': 'CA Labor Code § 512',
                    'severity': 'medium'
                },
                {
                    'type': 'Rest Break Violation',
                    'description': 'Paid rest breaks for every 4 hours worked',
                    'laborCode': 'CA Labor Code § 226',
                    'severity': 'medium'
                },
                {
                    'type': 'Minimum Wage Violation',
                    'description': 'Hourly rate below applicable minimum wage',
                    'laborCode': 'CA Labor Code § 1182.12',
                    'severity': 'high'
                },
                {
                    'type': 'Pay Stub Requirements Violation',
                    'description': 'Missing required information on pay stub',
                    'laborCode': 'CA Labor Code § 226',
                    'severity': 'medium'
                }
            ],
            'minimumWageRates': {
                'State': '16.00',
                'Los Angeles': '16.78',
                'San Francisco': '18.07',
                'San Diego': '16.30',
                'Santa Clara': '17.20',
                'Oakland': '16.94'
            },
            'constants': {
                'dailyOvertimeThreshold': '8.0 hours',
                'weeklyOvertimeThreshold': '40.0 hours',
                'dailyDoubleTimeThreshold': '12.0 hours',
                'overtimeMultiplier': '1.5x',
                'doubleTimeMultiplier': '2.0x',
                'mealBreakThreshold': '5.0 hours',
                'secondMealBreakThreshold': '10.0 hours',
                'restBreakInterval': '4.0 hours'
            }
        }
        
        return func.HttpResponse(
            json.dumps(rules_info),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logger.error(f"Error getting rules info: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
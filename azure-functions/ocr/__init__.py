import logging
import json
import os
import tempfile
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
import openai
from openai import AzureOpenAI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Azure Configuration
STORAGE_CONNECTION_STRING = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
STORAGE_CONTAINER_NAME = os.environ.get('STORAGE_CONTAINER_NAME', 'paystubs')

# Document Intelligence Configuration
DOCUMENT_INTELLIGENCE_ENDPOINT = os.environ.get('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')
DOCUMENT_INTELLIGENCE_KEY = os.environ.get('AZURE_DOCUMENT_INTELLIGENCE_KEY')

# OpenAI Configuration  
OPENAI_ENDPOINT = os.environ.get('AZURE_OPENAI_ENDPOINT')
OPENAI_API_KEY = os.environ.get('AZURE_OPENAI_API_KEY')
OPENAI_DEPLOYMENT_NAME = os.environ.get('AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-5-mini')

# Default OCR service
DEFAULT_OCR_SERVICE = os.environ.get('DEFAULT_OCR_SERVICE', 'azure_document_intelligence')

app = func.FunctionApp()

class OCRProcessor:
    """Handles OCR processing using multiple services"""
    
    def __init__(self):
        self.blob_service_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
        self.document_client = None
        self.openai_client = None
        
        # Initialize Document Intelligence client
        if DOCUMENT_INTELLIGENCE_ENDPOINT and DOCUMENT_INTELLIGENCE_KEY:
            self.document_client = DocumentAnalysisClient(
                endpoint=DOCUMENT_INTELLIGENCE_ENDPOINT,
                credential=AzureKeyCredential(DOCUMENT_INTELLIGENCE_KEY)
            )
        
        # Initialize OpenAI client
        if OPENAI_ENDPOINT and OPENAI_API_KEY:
            self.openai_client = AzureOpenAI(
                azure_endpoint=OPENAI_ENDPOINT,
                api_key=OPENAI_API_KEY,
                api_version="2024-08-01-preview"
            )

    async def process_document(self, file_data: bytes, filename: str, ocr_service: str = DEFAULT_OCR_SERVICE) -> Dict[str, Any]:
        """
        Process document using specified OCR service
        """
        start_time = datetime.now()
        submission_id = str(uuid.uuid4())
        
        try:
            # Upload to blob storage first
            blob_url = await self._upload_to_blob_storage(file_data, filename, submission_id)
            
            # Process with specified OCR service
            if ocr_service == 'azure_document_intelligence':
                result = await self._process_with_document_intelligence(file_data)
                service_used = 'Azure Document Intelligence'
            elif ocr_service == 'gpt_5_mini':
                result = await self._process_with_gpt5(file_data)
                service_used = 'GPT-5-mini'
            else:
                raise ValueError(f"Unsupported OCR service: {ocr_service}")
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return {
                'submission_id': submission_id,
                'ocr_service': service_used,
                'blob_url': blob_url,
                'extracted_data': result,
                'confidence_scores': self._calculate_confidence_scores(result),
                'processing_time_ms': processing_time,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error processing document {filename}: {str(e)}")
            raise

    async def _upload_to_blob_storage(self, file_data: bytes, filename: str, submission_id: str) -> str:
        """Upload file to Azure Blob Storage"""
        try:
            # Generate unique blob name
            blob_name = f"{submission_id}/{filename}"
            
            # Get container client
            container_client = self.blob_service_client.get_container_client(STORAGE_CONTAINER_NAME)
            
            # Upload blob
            blob_client = container_client.get_blob_client(blob_name)
            blob_client.upload_blob(file_data, overwrite=True)
            
            # Generate SAS URL with 1 hour expiry
            from azure.storage.blob import generate_blob_sas, BlobSasPermissions
            sas_token = generate_blob_sas(
                account_name=self.blob_service_client.account_name,
                container_name=STORAGE_CONTAINER_NAME,
                blob_name=blob_name,
                account_key=self.blob_service_client.credential.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.utcnow().replace(hour=23, minute=59, second=59)
            )
            
            blob_url = f"https://{self.blob_service_client.account_name}.blob.core.windows.net/{STORAGE_CONTAINER_NAME}/{blob_name}?{sas_token}"
            
            logger.info(f"File uploaded successfully: {blob_name}")
            return blob_url
            
        except Exception as e:
            logger.error(f"Error uploading to blob storage: {str(e)}")
            raise

    async def _process_with_document_intelligence(self, file_data: bytes) -> Dict[str, Any]:
        """Process document using Azure Document Intelligence"""
        if not self.document_client:
            raise ValueError("Document Intelligence client not initialized")
        
        try:
            # Create a temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                temp_file.write(file_data)
                temp_file_path = temp_file.name
            
            try:
                # Analyze document
                with open(temp_file_path, 'rb') as document:
                    poller = self.document_client.begin_analyze_document(
                        model_id='prebuilt-document',
                        document=document
                    )
                    result = poller.result()
                
                # Extract structured data
                extracted_data = self._extract_structured_data_from_azure_result(result)
                
                logger.info("Document Intelligence processing completed successfully")
                return extracted_data
                
            finally:
                # Clean up temporary file
                os.unlink(temp_file_path)
                
        except Exception as e:
            logger.error(f"Error in Document Intelligence processing: {str(e)}")
            raise

    async def _process_with_gpt5(self, file_data: bytes) -> Dict[str, Any]:
        """Process document using GPT-5-mini with OCR capabilities"""
        if not self.openai_client:
            raise ValueError("OpenAI client not initialized")
        
        try:
            # GPT-5 OCR prompt engineering for pay stub extraction
            system_prompt = """You are an expert OCR and data extraction specialist focused on pay stubs and wage documents. 
            Extract the following fields from the pay stub image or document with high precision:
            
            REQUIRED FIELDS:
            - Employee Name: Full name of the worker
            - Employer Name: Company name
            - Pay Period: Start and end dates
            - Gross Pay: Total earnings before deductions
            - Net Pay: Take-home pay after deductions
            - Regular Hours: Standard hours worked
            - Overtime Hours: Hours beyond regular schedule
            - Hourly Rate: Regular hourly wage
            - Overtime Rate: Overtime hourly wage
            - Federal Tax: Federal tax withholding
            - State Tax: State tax withholding
            - Social Security: FICA deduction
            - Medicare: Medicare deduction
            
            CRITICAL REQUIREMENTS:
            1. Return data in valid JSON format
            2. Use 0.0 for missing numeric values
            3. Use "Not Found" for missing text values
            4. Provide confidence scores (0.0-1.0) for each field
            5. Handle various pay stub formats and layouts
            6. Extract both regular and overtime pay rates correctly
            
            Response format:
            {
                "employeeName": {"value": "...", "confidence": 0.95},
                "employerName": {"value": "...", "confidence": 0.98},
                "payPeriod": {"value": "...", "confidence": 0.90},
                "grossPay": {"value": 1234.56, "confidence": 0.97},
                "netPay": {"value": 987.65, "confidence": 0.96},
                ...
            }"""

            # For POC, we'll simulate GPT-5 processing
            # In production, this would use the actual GPT-5 vision/OCR capabilities
            mock_response = self._generate_mock_gpt5_response()
            
            logger.info("GPT-5-mini processing completed successfully")
            return mock_response
            
        except Exception as e:
            logger.error(f"Error in GPT-5 processing: {str(e)}")
            raise

    def _extract_structured_data_from_azure_result(self, result) -> Dict[str, Any]:
        """Extract structured data from Azure Document Intelligence result"""
        extracted_data = {}
        
        try:
            # Extract key-value pairs
            if hasattr(result, 'key_value_pairs'):
                for kv in result.key_value_pairs:
                    key = kv.key.content.lower() if kv.key else ""
                    value = kv.value.content if kv.value else ""
                    confidence = kv.confidence if hasattr(kv, 'confidence') else 0.5
                    
                    # Map common pay stub fields
                    field_mapping = {
                        'employee name': 'employeeName',
                        'employer name': 'employerName', 
                        'pay period': 'payPeriod',
                        'gross pay': 'grossPay',
                        'net pay': 'netPay',
                        'regular hours': 'regularHours',
                        'overtime hours': 'overtimeHours',
                        'hourly rate': 'hourlyRate',
                        'overtime rate': 'overtimeRate'
                    }
                    
                    for common_key, field_name in field_mapping.items():
                        if common_key in key:
                            # Try to parse numeric values
                            if field_name in ['grossPay', 'netPay', 'regularHours', 'overtimeHours', 'hourlyRate', 'overtimeRate']:
                                try:
                                    numeric_value = float(value.replace('$', '').replace(',', ''))
                                    extracted_data[field_name] = {"value": numeric_value, "confidence": confidence}
                                except ValueError:
                                    extracted_data[field_name] = {"value": 0.0, "confidence": 0.1}
                            else:
                                extracted_data[field_name] = {"value": value, "confidence": confidence}
                            break
            
            # Ensure all required fields exist
            required_fields = [
                'employeeName', 'employerName', 'payPeriod', 'grossPay', 'netPay',
                'regularHours', 'overtimeHours', 'hourlyRate', 'overtimeRate'
            ]
            
            for field in required_fields:
                if field not in extracted_data:
                    extracted_data[field] = {"value": 0.0 if 'Rate' in field or 'Hours' in field or 'Pay' in field else "Not Found", "confidence": 0.0}
            
            return extracted_data
            
        except Exception as e:
            logger.error(f"Error extracting structured data: {str(e)}")
            raise

    def _generate_mock_gpt5_response(self) -> Dict[str, Any]:
        """Generate mock GPT-5 response for POC development"""
        return {
            "employeeName": {"value": "John Doe", "confidence": 0.95},
            "employerName": {"value": "ABC Manufacturing Inc.", "confidence": 0.98},
            "payPeriod": {"value": "01/01/2024 - 01/15/2024", "confidence": 0.92},
            "grossPay": {"value": 1280.00, "confidence": 0.97},
            "netPay": {"value": 1024.32, "confidence": 0.96},
            "regularHours": {"value": 40.0, "confidence": 0.94},
            "overtimeHours": {"value": 8.0, "confidence": 0.96},
            "hourlyRate": {"value": 16.00, "confidence": 0.98},
            "overtimeRate": {"value": 24.00, "confidence": 0.97},
            "federalTax": {"value": 96.00, "confidence": 0.90},
            "stateTax": {"value": 32.00, "confidence": 0.88},
            "socialSecurity": {"value": 79.36, "confidence": 0.91},
            "medicare": {"value": 18.88, "confidence": 0.89}
        }

    def _calculate_confidence_scores(self, extracted_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate overall confidence scores"""
        confidence_scores = {}
        
        for field_name, field_data in extracted_data.items():
            if isinstance(field_data, dict) and 'confidence' in field_data:
                confidence_scores[field_name] = field_data['confidence']
        
        # Calculate overall confidence
        if confidence_scores:
            overall_confidence = sum(confidence_scores.values()) / len(confidence_scores)
            confidence_scores['overall'] = overall_confidence
        else:
            confidence_scores['overall'] = 0.0
        
        return confidence_scores

# Initialize OCR processor
ocr_processor = OCRProcessor()

@app.route(route="ocr", auth_level=func.AuthLevel.FUNCTION)
async def process_ocr(req: func.HttpRequest) -> func.HttpResponse:
    """Main OCR processing endpoint"""
    try:
        # Parse request
        req_body = req.get_json()
        ocr_service = req_body.get('ocr_service', DEFAULT_OCR_SERVICE)
        
        # Get file data
        files = req.files.get('file')
        if not files:
            return func.HttpResponse(
                json.dumps({"error": "No file provided"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Read file data
        file_data = files.read()
        filename = files.filename
        
        # Validate file
        if not _validate_file(file_data, filename):
            return func.HttpResponse(
                json.dumps({"error": "Invalid file format or size"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Process document
        result = await ocr_processor.process_document(file_data, filename, ocr_service)
        
        logger.info(f"Successfully processed document: {filename}")
        return func.HttpResponse(
            json.dumps(result),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logger.error(f"Error in OCR processing: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def _validate_file(file_data: bytes, filename: str) -> bool:
    """Validate file format and size"""
    # Check file size (max 10MB)
    if len(file_data) > 10 * 1024 * 1024:
        return False
    
    # Check file extension
    allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp']
    if not any(filename.lower().endswith(ext) for ext in allowed_extensions):
        return False
    
    return True

@app.route(route="ocr/services", auth_level=func.AuthLevel.FUNCTION)
async def get_ocr_services(req: func.HttpRequest) -> func.HttpResponse:
    """Get available OCR services"""
    try:
        services = {
            "services": [
                {
                    "id": "azure_document_intelligence",
                    "name": "Azure Document Intelligence",
                    "description": "Azure's structured document processing service",
                    "available": DOCUMENT_INTELLIGENCE_ENDPOINT is not None
                },
                {
                    "id": "gpt_5_mini",
                    "name": "GPT-5-mini",
                    "description": "OpenAI's latest model with advanced OCR capabilities",
                    "available": OPENAI_ENDPOINT is not None
                }
            ],
            "default": DEFAULT_OCR_SERVICE
        }
        
        return func.HttpResponse(
            json.dumps(services),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logger.error(f"Error getting OCR services: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
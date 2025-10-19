# Pay Stub Wage Violation Detection POC

A proof-of-concept system for detecting California labor law violations in pay stubs using Azure services and AI-powered analysis.

## 🎯 POC Goals

This POC demonstrates an end-to-end pipeline for:
- **Pay Stub Capture**: Mobile-first web interface with bilingual support (EN/ES)
- **OCR Processing**: Dual extraction using Azure Document Intelligence and GPT-5-mini
- **Violation Detection**: California Labor Code rules engine
- **Results Display**: Plain-language summaries with confidence scoring
- **Internal QA Portal**: Review and validation interface

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Docker & Docker Compose
- Azure account (for production deployment)

### Development Setup

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository>
   cd naitive-engage-suite
   npm install
   ```

2. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start PostgreSQL**
   ```bash
   npm run db:dev
   ```

4. **Generate Database Schema**
   ```bash
   npm run db:generate
   npm run db:push
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Access the Application**
   - Main App: http://localhost:3000
   - Pay Stub Capture: http://localhost:3000/paystub
   - Internal Portal: http://localhost:3000/internal

## 🏗️ Architecture

### Frontend Stack
- **Next.js 15+** with App Router
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling
- **Radix UI** components
- **Lucide React** icons
- **PWA** capabilities for mobile

### Backend Services
- **Azure Functions** (Python runtime) for OCR and rules engine
- **Azure Document Intelligence** for structured document processing
- **Azure OpenAI Service** (GPT-5-mini) for OCR and summarization
- **Azure Blob Storage** for secure file storage
- **Azure Database for PostgreSQL** for data persistence

### Key Features

#### 📱 Mobile Pay Stub Capture
- HTML5 Camera API integration
- File upload support (images/PDF)
- Client-side quality checks
- Bilingual interface (English/Spanish)
- Consent flow with TCPA compliance notes

#### 🔍 OCR Processing Pipeline
- **Dual Service Architecture**: Azure Document Intelligence + GPT-5-mini
- Configurable service selection via admin panel
- ≥95% accuracy target on critical fields
- Confidence scoring for each extracted field
- Processing time optimization (<3 seconds end-to-end)

#### ⚖️ California Labor Code Rules Engine
- **Tier 1 Violations**:
  - Overtime calculations (daily/weekly)
  - Meal break premiums (LC §512)
  - Rest break premiums
  - Pay stub requirements (LC §226)
- Modular rule definitions
- Confidence scoring per violation
- Labor code citations

#### 📊 Results & QA Portal
- Internal review interface with MFA authentication
- Violation confidence scoring and severity levels
- Plain-language summaries (6th-grade reading level)
- QA workflow (TP/FP/FN marking)
- Feedback loop analysis

## 📋 API Endpoints

### Pay Stub Processing
- `POST /api/paystub/process` - Upload and process pay stub
- `GET /api/paystub/submissions` - Retrieve submissions list
- `GET /api/paystub/submissions?id={id}` - Get specific submission
- `POST /api/paystub/submissions` - Submit QA review

### Response Format
```typescript
interface ProcessingResult {
  id: string;
  violations: Array<{
    type: string;
    description: string;
    confidence: number;
    severity: "low" | "medium" | "high";
    laborCode?: string;
  }>;
  confidence: number;
  processingTime: number;
  metadata: {
    ocrService: string;
    processingTimestamp: string;
  };
}
```

## 🗄️ Database Schema

### Core Tables
- `pay_stub_submissions` - Main submission records
- `pay_stub_violations` - Detected violations
- `qa_reviews` - Quality assurance reviews
- `ocr_processing_logs` - Processing metrics
- `system_config` - Configuration management

### Key Relationships
- Submissions → Violations (1:N)
- Submissions → QA Reviews (1:1)
- Submissions → OCR Logs (1:N)

## 🔧 Configuration

### Azure Services Setup

1. **Azure Storage Account**
   ```bash
   AZURE_STORAGE_ACCOUNT_NAME=your_account
   AZURE_STORAGE_ACCOUNT_KEY=your_key
   AZURE_STORAGE_CONNECTION_STRING=your_connection_string
   ```

2. **Azure Document Intelligence**
   ```bash
   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
   AZURE_DOCUMENT_INTELLIGENCE_KEY=your_key
   ```

3. **Azure OpenAI Service**
   ```bash
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
   AZURE_OPENAI_API_KEY=your_key
   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-mini
   ```

### Application Settings
```bash
# OCR Configuration
OCR_SERVICE_DEFAULT=azure_document_intelligence
ENABLE_GPT5_OCR=false
MAX_FILE_SIZE_MB=10
SUPPORTED_FORMATS=jpeg,png,webp,pdf

# Performance Targets
MAX_PROCESSING_TIME_MS=3000
MIN_CONFIDENCE_THRESHOLD=0.90
```

## 📊 Performance Metrics

### Success Criteria
- **Detection Accuracy**: ≥90% on Gold Set violations
- **Processing Latency**: <3 seconds (95th percentile)
- **OCR Accuracy**: ≥95% on critical fields
- **Rules Coverage**: 100% of Tier 1 CA rules

### Monitoring
- End-to-end processing time tracking
- OCR service performance comparison
- Violation detection accuracy metrics
- User engagement analytics

## 🔒 Security & Compliance

### Data Protection
- Azure Key Vault for secret management
- Encrypted blob storage (AES-256)
- TLS 1.3 for all communications
- Role-based access control (RBAC)
- Multi-factor authentication (MFA) required

### Privacy by Design
- Data minimization principles
- No PII logging in AI prompts
- Consent management workflow
- Secure file handling and cleanup

### Compliance Notes
- TCPA compliance framework (SMS consent)
- California labor law focus
- SOC 2-compliant managed services
- Data isolation guarantees

## 🌐 Localization

### Supported Languages
- **English (EN)** - Primary interface
- **Spanish (ES)** - Complete translation

### Translation Files
Translations are maintained in the component files with easy extension capability for additional languages.

## 🧪 Testing

### Gold Set Testing
```bash
# Run accuracy tests against gold standard
npm run test:accuracy

# Performance tests
npm run test:performance

# End-to-end integration tests
npm run test:e2e
```

### QA Workflow
1. Upload test pay stubs
2. Review violations in internal portal
3. Mark as TP/FP/FN
4. Analyze accuracy metrics
5. Iterate on rules/prompting

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run start
```

### Docker Deployment
```bash
docker-compose up -d
```

## 📝 Development Notes

### Code Architecture
- Modular component design
- Type-safe development with TypeScript
- Separation of concerns (UI/Logic/Services)
- Extensible rules engine
- Service abstraction for cloud providers

### Performance Optimizations
- Asynchronous OCR processing
- Image optimization and compression
- Lazy loading for large datasets
- Progressive Web App capabilities
- Server-side rendering where appropriate

## 🔮 Future Enhancements

### Phase 2 Features
- Additional state labor law support
- Advanced fraud detection
- Document watermarking
- Batch processing capabilities
- Advanced analytics dashboard

### Infrastructure Improvements
- Azure Front Door integration
- Application Insights monitoring
- Auto-scaling for OCR processing
- Multi-region deployment
- Enhanced security scanning

## 📞 Support

### Documentation
- Project requirements: `/documentation/project_requirements_document.md`
- Backend structure: `/documentation/backend_structure_document.md`
- Frontend guidelines: `/documentation/frontend_guidelines_document.md`
- Security guidelines: `/documentation/security_guideline_document.md`

### Issue Tracking
Submit bugs and feature requests via GitHub Issues with the appropriate labels.

## 📄 License

This project is proprietary and confidential. All rights reserved.
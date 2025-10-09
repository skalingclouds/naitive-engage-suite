// Azure Services Configuration
// In production, these would be loaded from Azure Key Vault
export const azureConfig = {
  // Azure Storage Account
  storage: {
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    containerName: 'paystubs'
  },

  // Azure Document Intelligence (Form Recognizer)
  documentIntelligence: {
    endpoint: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || '',
    apiKey: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY || '',
    modelId: process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID || 'prebuilt-receipt'
  },

  // Azure OpenAI Service
  openai: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5-mini',
    apiVersion: '2024-08-01-preview'
  },

  // Azure Functions
  functions: {
    baseUrl: process.env.AZURE_FUNCTIONS_BASE_URL || 'http://localhost:7071',
    functionKey: process.env.AZURE_FUNCTIONS_FUNCTION_KEY || ''
  },

  // Azure Database for PostgreSQL
  postgresql: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'wage_violation_db',
    username: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  }
};

// Helper function to generate Azure Blob Storage SAS tokens
export function generateBlobSasToken(blobName: string, permissions: string = 'r', expiryMinutes: number = 60): string {
  // In production, this would use Azure Storage SDK to generate proper SAS tokens
  // For POC, we'll return a mock token
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + expiryMinutes);
  
  return `sp=${permissions}&st=${new Date().toISOString()}&se=${expiry.toISOString()}&spr=https&sv=2022-11-02&sr=b&sig=mock_signature`;
}

// Helper function to get Azure Blob Storage URL
export function getBlobUrl(blobName: string, sasToken?: string): string {
  const { accountName, containerName } = azureConfig.storage;
  const baseUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}`;
  
  if (sasToken) {
    return `${baseUrl}?${sasToken}`;
  }
  
  return baseUrl;
}

// Helper function to upload to Azure Blob Storage
export async function uploadToBlobStorage(file: File, blobName: string): Promise<string> {
  // In production, this would use Azure Storage Blob SDK
  // For POC, we'll simulate the upload
  
  console.log('Uploading file to Azure Blob Storage:', {
    fileName: file.name,
    blobName,
    fileSize: file.size,
    fileType: file.type,
    container: azureConfig.storage.containerName
  });

  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Return mock blob URL
  const sasToken = generateBlobSasToken(blobName, 'r', 60 * 24); // Read access for 24 hours
  return getBlobUrl(blobName, sasToken);
}

// OCR Service configuration
export const ocrServices = {
  AZURE_DOCUMENT_INTELLIGENCE: 'azure_document_intelligence',
  GPT_5_MINI: 'gpt_5_mini'
} as const;

export type OCRService = typeof ocrServices[keyof typeof ocrServices];

// Default OCR service selection
export const defaultOCRService: OCRService = ocrServices.AZURE_DOCUMENT_INTELLIGENCE;
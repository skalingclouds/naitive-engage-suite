import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface MonitoringConfig {
  namespace: string;
  serviceName: string;
  environment: string;
}

export class LambdaUtils {
  private cloudWatchClient: CloudWatchClient;
  private sqsClient: SQSClient;
  private dynamoClient: DynamoDBClient;
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.cloudWatchClient = new CloudWatchClient({});
    this.sqsClient = new SQSClient({});
    this.dynamoClient = new DynamoDBClient({});
    this.config = config;
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryConfig: RetryConfig,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        console.log(`[${context}] Attempt ${attempt}/${retryConfig.maxAttempts}`);
        const result = await fn();
        
        if (attempt > 1) {
          await this.putMetric('SuccessfulRetries', 'Count', 1, {
            context,
            totalAttempts: attempt.toString(),
          });
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const isRetryable = this.isRetryableError(lastError, retryConfig.retryableErrors);
        
        if (attempt === retryConfig.maxAttempts || !isRetryable) {
          await this.putMetric('FailedOperations', 'Count', 1, {
            context,
            errorType: lastError.constructor.name,
            isRetryable: isRetryable.toString(),
          });
          throw lastError;
        }

        const delayMs = Math.min(
          retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelayMs
        );

        console.warn(`[${context}] Attempt ${attempt} failed, retrying in ${delayMs}ms: ${lastError.message}`);
        
        await this.putMetric('RetryAttempts', 'Count', 1, {
          context,
          attempt: attempt.toString(),
          delayMs: delayMs.toString(),
        });

        await this.sleep(delayMs);
      }
    }

    throw lastError!;
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    context: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Send message to Dead Letter Queue
   */
  async sendToDLQ(message: any, dlqUrl: string, error: Error, context: string): Promise<void> {
    try {
      const dlqMessage = {
        originalMessage: message,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        context,
        timestamp: new Date().toISOString(),
        service: this.config.serviceName,
      };

      const command = new SendMessageCommand({
        QueueUrl: dlqUrl,
        MessageBody: JSON.stringify(dlqMessage),
        MessageAttributes: {
          service: { DataType: 'String', StringValue: this.config.serviceName },
          errorType: { DataType: 'String', StringValue: error.constructor.name },
          context: { DataType: 'String', StringValue: context },
        },
      });

      await this.sqsClient.send(command);
      
      await this.putMetric('DLQMessages', 'Count', 1, {
        context,
        errorType: error.constructor.name,
      });
      
      console.log(`[DLQ] Sent message to DLQ for ${context}: ${error.message}`);
    } catch (dlqError) {
      console.error(`[DLQ] Failed to send to DLQ for ${context}:`, dlqError);
      throw dlqError;
    }
  }

  /**
   * Log error to CloudWatch
   */
  async logError(error: Error, context: string, additionalData?: any): Promise<void> {
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      service: this.config.serviceName,
      environment: this.config.environment,
      timestamp: new Date().toISOString(),
      additionalData,
    };

    console.error(`[ERROR] ${context}:`, JSON.stringify(errorData, null, 2));

    await this.putMetric('Errors', 'Count', 1, {
      context,
      errorType: error.constructor.name,
    });

    // Store error in DynamoDB for analysis
    await this.storeErrorLog(errorData);
  }

  /**
   * Put custom metric to CloudWatch
   */
  async putMetric(
    metricName: string,
    unit: 'Count' | 'Seconds' | 'Percent' | 'Bytes',
    value: number,
    dimensions?: Record<string, string>
  ): Promise<void> {
    try {
      const metricData = {
        Namespace: this.config.namespace,
        MetricData: [
          {
            MetricName: metricName,
            Unit: unit,
            Value: value,
            Timestamp: new Date(),
            Dimensions: [
              {
                Name: 'ServiceName',
                Value: this.config.serviceName,
              },
              {
                Name: 'Environment',
                Value: this.config.environment,
              },
              ...(dimensions
                ? Object.entries(dimensions).map(([key, value]) => ({
                    Name: key,
                    Value: value,
                  }))
                : []),
            ],
          },
        ],
      };

      const command = new PutMetricDataCommand(metricData);
      await this.cloudWatchClient.send(command);
    } catch (error) {
      console.error(`[METRICS] Failed to put metric ${metricName}:`, error);
      // Don't throw here to avoid breaking main flow
    }
  }

  /**
   * Record operation duration
   */
  async recordDuration<T>(
    operation: () => Promise<T>,
    metricName: string,
    context: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      await this.putMetric(metricName, 'Seconds', duration / 1000, {
        context,
        success: 'true',
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await this.putMetric(metricName, 'Seconds', duration / 1000, {
        context,
        success: 'false',
      });
      
      throw error;
    }
  }

  /**
   * Validate input data
   */
  validateInput(data: any, requiredFields: string[], context: string): void {
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw new Error(
        `Missing required fields for ${context}: ${missingFields.join(', ')}`
      );
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.constructor.name.toLowerCase();
    
    return retryableErrors.some(pattern => 
      errorMessage.includes(pattern.toLowerCase()) || 
      errorName.includes(pattern.toLowerCase())
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Store error log in DynamoDB
   */
  private async storeErrorLog(errorData: any): Promise<void> {
    try {
      const tableName = process.env.ERROR_LOG_TABLE;
      if (!tableName) return;

      const command = new PutItemCommand({
        TableName: tableName,
        Item: {
          errorId: { S: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` },
          timestamp: { S: errorData.timestamp },
          serviceName: { S: errorData.service },
          context: { S: errorData.context },
          errorMessage: { S: errorData.message },
          errorType: { S: errorData.name },
          stackTrace: { S: errorData.stack || '' },
          environment: { S: errorData.environment },
          additionalData: { S: JSON.stringify(errorData.additionalData || {}) },
        },
      });

      await this.dynamoClient.send(command);
    } catch (error) {
      console.error('[ERROR_LOG] Failed to store error log:', error);
      // Don't throw here to avoid breaking main flow
    }
  }
}

/**
 * Default retry configurations
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'TimeoutError',
    'NetworkError',
    'RequestTimeout',
    'ServiceUnavailable',
    'ThrottlingException',
    'TooManyRequestsException',
    'InternalServiceError',
    'ServiceError',
  ],
};

/**
 * Default monitoring configuration
 */
export function createMonitoringConfig(serviceName: string): MonitoringConfig {
  return {
    namespace: 'PayStubOCR',
    serviceName,
    environment: process.env.ENVIRONMENT || 'development',
  };
}
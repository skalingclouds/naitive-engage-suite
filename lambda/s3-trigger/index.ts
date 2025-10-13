import { S3Event, S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { Readable } from 'stream';

// Initialize AWS clients
const s3Client = new S3Client({});
const sqsClient = new SQSClient({});
const dynamoClient = new DynamoDBClient({});

// Environment variables
const OCR_QUEUE_URL = process.env.OCR_QUEUE_URL!;
const ANALYSIS_TABLE = process.env.ANALYSIS_TABLE!;
const REGION = process.env.AWS_REGION!;

export const handler: S3Handler = async (event: S3Event) => {
  console.log('S3 trigger event received:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      
      console.log(`Processing file: s3://${bucket}/${key}`);

      // Extract analysis ID from the S3 key
      const keyParts = key.split('/');
      const analysisId = keyParts[keyParts.length - 1].split('.')[0];
      
      // Get file metadata from S3
      const headCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const s3Object = await s3Client.send(headCommand);
      
      const fileMetadata = {
        analysisId,
        bucket,
        key,
        size: s3Object.ContentLength || 0,
        lastModified: s3Object.LastModified?.toISOString() || new Date().toISOString(),
        contentType: s3Object.ContentType || 'application/octet-stream',
        region: REGION,
      };

      // Store initial analysis record in DynamoDB
      await storeAnalysisRecord(fileMetadata);

      // Send message to OCR processing queue
      await sendToOCRQueue(fileMetadata);

      console.log(`Successfully queued OCR processing for analysisId: ${analysisId}`);

    } catch (error) {
      console.error('Error processing S3 event record:', error);
      
      // TODO: Implement dead-letter queue or error handling
      throw error;
    }
  }
};

async function storeAnalysisRecord(metadata: any) {
  const dynamoParams = {
    TableName: ANALYSIS_TABLE,
    Item: {
      analysisId: { S: metadata.analysisId },
      s3Bucket: { S: metadata.bucket },
      s3Key: { S: metadata.key },
      fileSize: { N: metadata.size.toString() },
      contentType: { S: metadata.contentType },
      status: { S: 'uploaded' },
      createdAt: { S: new Date().toISOString() },
      updatedAt: { S: new Date().toISOString() },
      region: { S: metadata.region },
    },
  };

  await dynamoClient.send(new PutItemCommand(dynamoParams));
  console.log(`Stored analysis record for ${metadata.analysisId}`);
}

async function sendToOCRQueue(metadata: any) {
  const queueMessage = {
    analysisId: metadata.analysisId,
    bucket: metadata.bucket,
    key: metadata.key,
    contentType: metadata.contentType,
    timestamp: new Date().toISOString(),
  };

  const sqsParams = {
    QueueUrl: OCR_QUEUE_URL,
    MessageBody: JSON.stringify(queueMessage),
    MessageAttributes: {
      contentType: {
        DataType: 'String',
        StringValue: metadata.contentType,
      },
      analysisId: {
        DataType: 'String',
        StringValue: metadata.analysisId,
      },
    },
  };

  await sqsClient.send(new SendMessageCommand(sqsParams));
  console.log(`Sent OCR processing message to queue for ${metadata.analysisId}`);
}
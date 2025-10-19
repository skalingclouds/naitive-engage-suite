import { SQSHandler, SQSEvent } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import sharp from 'sharp';
import cv from 'opencv4nodejs' or require('@techstark/opencv4nodejs');

// Initialize AWS clients
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Environment variables
const PROCESSED_BUCKET = process.env.PROCESSED_BUCKET!;
const ANALYSIS_TABLE = process.env.ANALYSIS_TABLE!;
const PREPROCESSING_TABLE = process.env.PREPROCESSING_TABLE!;

interface ProcessingJob {
  analysisId: string;
  bucket: string;
  key: string;
  contentType: string;
  timestamp: string;
}

interface ProcessingResult {
  analysisId: string;
  success: boolean;
  processedKey?: string;
  qualityScore?: number;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  noise?: number;
  processingLog: string[];
  error?: string;
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('Image preprocessing SQS event received:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const job: ProcessingJob = JSON.parse(record.body);
      console.log(`Processing image for analysisId: ${job.analysisId}`);

      const result = await processImage(job);
      await updateAnalysisStatus(result);
      await storeProcessingResult(result);

      console.log(`Successfully processed image for ${job.analysisId}`);

    } catch (error) {
      console.error('Error processing SQS record:', error);
      
      // Store error result
      const job: ProcessingJob = JSON.parse(record.body);
      await updateAnalysisStatus({
        analysisId: job.analysisId,
        success: false,
        processingLog: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      });
    }
  }
};

async function processImage(job: ProcessingJob): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    analysisId: job.analysisId,
    success: false,
    processingLog: [],
  };

  try {
    // Download image from S3
    const imageBuffer = await downloadImage(job.bucket, job.key);
    result.processingLog.push(`Downloaded image: ${imageBuffer.length} bytes`);

    // Check if it's a PDF or image
    if (job.contentType === 'application/pdf') {
      // For PDFs, we'll just pass them through without preprocessing
      // In a real implementation, you'd use a PDF library to extract images
      result.success = true;
      result.processedKey = job.key;
      result.qualityScore = 100;
      result.processingLog.push('PDF file detected - passing through without preprocessing');
      return result;
    }

    // Image preprocessing pipeline
    let processedImage = sharp(imageBuffer);
    const metadata = await processedImage.metadata();
    
    result.processingLog.push(`Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

    // 1. Convert to grayscale for analysis
    const grayscaleBuffer = await processedImage
      .clone()
      .greyscale()
      .raw()
      .toBuffer();

    // 2. Analyze image quality using OpenCV
    const cvImage = new cv.Mat(
      metadata.height!,
      metadata.width!,
      cv.CV_8UC1,
      grayscaleBuffer
    );

    // Calculate image quality metrics
    const qualityMetrics = analyzeImageQuality(cvImage, metadata);
    result.qualityScore = qualityMetrics.overallScore;
    result.brightness = qualityMetrics.brightness;
    result.contrast = qualityMetrics.contrast;
    result.noise = qualityMetrics.noise;
    result.processingLog.push(`Quality analysis - Score: ${qualityMetrics.overallScore.toFixed(1)}, Brightness: ${qualityMetrics.brightness.toFixed(1)}, Contrast: ${qualityMetrics.contrast.toFixed(1)}`);

    // 3. Detect rotation angle
    const rotationAngle = detectRotation(cvImage);
    if (Math.abs(rotationAngle) > 1) {
      processedImage = processedImage.rotate(rotationAngle);
      result.rotation = rotationAngle;
      result.processingLog.push(`Corrected rotation: ${rotationAngle.toFixed(1)}°`);
    }

    // 4. Apply enhancement based on quality metrics
    if (qualityMetrics.overallScore < 70) {
      processedImage = enhanceImage(processedImage, qualityMetrics);
      result.processingLog.push('Applied image enhancement');
    }

    // 5. Noise reduction if needed
    if (qualityMetrics.noise > 50) {
      // Apply median filter for noise reduction
      processedImage = processedImage.median(3);
      result.processingLog.push('Applied noise reduction');
    }

    // 6. Optimize for OCR processing
    processedImage = optimizeForOCR(processedImage);
    result.processingLog.push('Optimized for OCR processing');

    // 7. Convert back to original format or JPEG for consistency
    const finalBuffer = await processedImage
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    // 8. Upload processed image to S3
    const processedKey = `processed/${job.analysisId}.jpg`;
    await uploadProcessedImage(finalBuffer, processedKey);
    
    result.success = true;
    result.processedKey = processedKey;
    result.processingLog.push(`Uploaded processed image: ${finalBuffer.length} bytes`);

    // Cleanup
    cvImage.delete();

    return result;

  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.processingLog.push(`Processing failed: ${result.error}`);
    return result;
  }
}

function analyzeImageQuality(cvImage: cv.Mat, metadata: any) {
  // Calculate brightness (mean intensity)
  const mean = cv.mean(cvImage)[0];
  const brightness = mean / 255 * 100;

  // Calculate contrast (standard deviation)
  const stdDev = cv.meanStdDev(cvImage);
  const contrast = stdDev.stddev[0] / 255 * 100;

  // Calculate noise (using Laplacian variance)
  const laplacian = cv.Laplacian(cvImage, cv.CV_64F);
  const noise = cv.meanStdDev(laplacian).stddev[0];

  // Sharpness detection (using edge detection)
  const edges = cv.Canny(cvImage, 50, 150);
  const edgeCount = cv.countNonZero(edges);
  const totalPixels = cvImage.rows * cvImage.cols;
  const sharpness = (edgeCount / totalPixels) * 100;

  // Calculate overall quality score
  let score = 100;
  
  // Penalize poor brightness (ideal: 40-60%)
  if (brightness < 40 || brightness > 60) {
    score -= Math.abs(brightness - 50) * 0.5;
  }
  
  // Penalize low contrast
  if (contrast < 20) {
    score -= (20 - contrast) * 1.5;
  }
  
  // Penalize high noise
  if (noise > 30) {
    score -= (noise - 30) * 0.8;
  }
  
  // Penalize low sharpness
  if (sharpness < 5) {
    score -= (5 - sharpness) * 2;
  }

  return {
    overallScore: Math.max(0, Math.min(100, score)),
    brightness,
    contrast,
    noise: noise / 255 * 100,
    sharpness,
  };
}

function detectRotation(cvImage: cv.Mat): number {
  // Use Hough Transform to detect text lines and calculate rotation
  const edges = cv.Canny(cvImage, 50, 150, 3, false);
  const lines = cv.HoughLines(edges, 1, Math.PI / 180, 100, 0, 0, Math.PI);

  if (lines.rows === 0) {
    return 0;
  }

  // Analyze line angles to detect rotation
  const angles = lines.getData32F();
  const angleHistogram = new Array(18).fill(0); // 10-degree bins from -90 to +90

  for (let i = 0; i < angles.length; i += 2) {
    const angle = angles[i + 1] * 180 / Math.PI;
    const normalizedAngle = angle < 0 ? angle + 180 : angle;
    const bin = Math.floor(normalizedAngle / 10);
    if (bin >= 0 && bin < 18) {
      angleHistogram[bin]++;
    }
  }

  // Find the dominant angle
  let maxCount = 0;
  let dominantBin = 0;
  for (let i = 0; i < angleHistogram.length; i++) {
    if (angleHistogram[i] > maxCount) {
      maxCount = angleHistogram[i];
      dominantBin = i;
    }
  }

  // Convert bin back to angle
  const dominantAngle = dominantBin * 10;
  const rotation = dominantAngle > 90 ? dominantAngle - 180 : dominantAngle;

  // Return rotation angle to correct the image
  return -rotation;
}

function enhanceImage(imagePipeline: any, qualityMetrics: any) {
  let pipeline = imagePipeline;

  // Adjust brightness if too dark or too bright
  if (qualityMetrics.brightness < 30) {
    pipeline = pipeline.modulate({ brightness: 1.2 });
  } else if (qualityMetrics.brightness > 70) {
    pipeline = pipeline.modulate({ brightness: 0.9 });
  }

  // Adjust contrast if too low
  if (qualityMetrics.contrast < 30) {
    pipeline = pipeline.linear(1.2, 0);
  }

  // Apply sharpening if image is soft
  if (qualityMetrics.sharpness < 3) {
    pipeline = pipeline.sharpen({ sigma: 1, flat: 1, jagged: 2 });
  }

  return pipeline;
}

function optimizeForOCR(imagePipeline: any) {
  return imagePipeline
    .resize(null, { height: 2000, withoutEnlargement: true }) // Standardize height
    .normalize() // Normalize histogram
    .threshold(128); // Binarize for better OCR
}

async function downloadImage(bucket: string, key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);
  
  if (response.Body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  
  throw new Error('Unable to download image from S3');
}

async function uploadProcessedImage(buffer: Buffer, key: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: PROCESSED_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
    Metadata: {
      processedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);
}

async function updateAnalysisStatus(result: ProcessingResult): Promise<void> {
  const updateParams = {
    TableName: ANALYSIS_TABLE,
    Key: { analysisId: { S: result.analysisId } },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #preprocessingResult = :preprocessingResult',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
      '#preprocessingResult': 'preprocessingResult',
    },
    ExpressionAttributeValues: {
      ':status': { S: result.success ? 'preprocessed' : 'preprocessing_failed' },
      ':updatedAt': { S: new Date().toISOString() },
      ':preprocessingResult': { S: JSON.stringify(result) },
    },
  };

  await dynamoClient.send(new UpdateItemCommand(updateParams));
}

async function storeProcessingResult(result: ProcessingResult): Promise<void> {
  const command = new PutCommand({
    TableName: PREPROCESSING_TABLE,
    Item: {
      analysisId: result.analysisId,
      success: result.success,
      qualityScore: result.qualityScore,
      rotation: result.rotation,
      brightness: result.brightness,
      contrast: result.contrast,
      noise: result.noise,
      processedKey: result.processedKey,
      processingLog: result.processingLog,
      error: result.error,
      timestamp: new Date().toISOString(),
    },
  });

  await docClient.send(command);
}
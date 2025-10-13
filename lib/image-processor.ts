export interface ImageProcessingResult {
  processedFile: File;
  wasProcessed: boolean;
  processingLog: string[];
  quality: number;
  rotation: number;
}

export class ImageProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to get 2D context from canvas');
    }
    this.ctx = ctx;
  }

  /**
   * Detect if an image is blurry using Laplacian variance
   */
  private async detectBlur(imageData: ImageData): Promise<number> {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Convert to grayscale
    const gray = new Float32Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Apply Laplacian kernel
    const laplacian = [
      0, -1, 0,
      -1, 4, -1,
      0, -1, 0
    ];

    let variance = 0;
    const mean = this.calculateMean(gray);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            sum += gray[idx] * laplacian[kernelIdx];
          }
        }
        variance += Math.pow(sum - mean, 2);
      }
    }

    return variance / ((width - 2) * (height - 2));
  }

  private calculateMean(arr: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    return sum / arr.length;
  }

  /**
   * Detect image orientation using EXIF data or content analysis
   */
  private detectOrientation(imageData: ImageData): number {
    // Simple edge detection to determine orientation
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    let horizontalEdges = 0;
    let verticalEdges = 0;
    
    // Sample edges at regular intervals
    for (let y = 1; y < height - 1; y += 10) {
      for (let x = 1; x < width - 1; x += 10) {
        const idx = (y * width + x) * 4;
        
        // Calculate horizontal gradient
        const hGradient = Math.abs(
          data[idx + 4] - data[idx - 4] +
          data[idx + 5] - data[idx - 5] +
          data[idx + 6] - data[idx - 6]
        );
        
        // Calculate vertical gradient
        const vGradient = Math.abs(
          data[(y + 1) * width * 4 + idx] - data[(y - 1) * width * 4 + idx] +
          data[(y + 1) * width * 4 + idx + 1] - data[(y - 1) * width * 4 + idx + 1] +
          data[(y + 1) * width * 4 + idx + 2] - data[(y - 1) * width * 4 + idx + 2]
        );
        
        horizontalEdges += hGradient;
        verticalEdges += vGradient;
      }
    }
    
    // If vertical edges are significantly more common, image might need rotation
    if (verticalEdges > horizontalEdges * 1.5) {
      return 90;
    }
    
    return 0;
  }

  /**
   * Apply deskewing to straighten text
   */
  private async deskew(imageData: ImageData): Promise<number> {
    // Hough transform implementation for line detection
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Convert to grayscale and edge detection
    const edges = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      edges[i / 4] = gray > 128 ? 255 : 0;
    }

    // Simple angle detection (would use full Hough transform in production)
    const angles = [-5, -3, -1, 0, 1, 3, 5];
    let maxScore = 0;
    let bestAngle = 0;

    for (const angle of angles) {
      const score = this.calculateSkewScore(edges, width, height, angle);
      if (score > maxScore) {
        maxScore = score;
        bestAngle = angle;
      }
    }

    return bestAngle;
  }

  private calculateSkewScore(edges: Uint8Array, width: number, height: number, angle: number): number {
    const radians = (angle * Math.PI) / 180;
    let score = 0;

    for (let y = 0; y < height; y += 10) {
      let rowSum = 0;
      for (let x = 0; x < width; x++) {
        const rotatedY = Math.round(y + x * Math.tan(radians));
        if (rotatedY >= 0 && rotatedY < height) {
          rowSum += edges[rotatedY * width + x];
        }
      }
      score += rowSum;
    }

    return score;
  }

  /**
   * Enhance image quality
   */
  private enhanceImage(imageData: ImageData): ImageData {
    const data = imageData.data;
    
    // Apply contrast enhancement
    const factor = 1.2;
    for (let i = 0; i < data.length; i += 4) {
      // RGB channels
      for (let j = 0; j < 3; j++) {
        const value = data[i + j];
        data[i + j] = Math.max(0, Math.min(255, factor * (value - 128) + 128));
      }
    }

    return imageData;
  }

  /**
   * Rotate canvas by given angle
   */
  private rotateCanvas(angle: number): void {
    if (angle === 0) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const radians = (angle * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));

    tempCanvas.width = this.canvas.width * cos + this.canvas.height * sin;
    tempCanvas.height = this.canvas.width * sin + this.canvas.height * cos;

    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate(radians);
    tempCtx.drawImage(this.canvas, -this.canvas.width / 2, -this.canvas.height / 2);

    this.canvas.width = tempCanvas.width;
    this.canvas.height = tempCanvas.height;
    this.ctx.drawImage(tempCanvas, 0, 0);
  }

  /**
   * Process an image file with blur detection, rotation, and enhancement
   */
  async processImage(file: File): Promise<ImageProcessingResult> {
    const processingLog: string[] = [];
    let wasProcessed = false;
    let finalRotation = 0;

    try {
      processingLog.push("Starting image processing...");
      
      // Create image element
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      // Set canvas size
      this.canvas.width = img.width;
      this.canvas.height = img.height;
      this.ctx.drawImage(img, 0, 0);

      // Get image data
      let imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

      // Detect blur
      const blurScore = await this.detectBlur(imageData);
      processingLog.push(`Blur detection score: ${blurScore.toFixed(2)}`);
      
      const isBlurry = blurScore < 100; // Threshold for blur detection
      if (isBlurry) {
        processingLog.push("Image appears to be blurry, applying enhancement...");
        imageData = this.enhanceImage(imageData);
        this.ctx.putImageData(imageData, 0, 0);
        wasProcessed = true;
      } else {
        processingLog.push("Image sharpness is acceptable");
      }

      // Detect orientation
      const rotation = this.detectOrientation(imageData);
      processingLog.push(`Detected rotation: ${rotation}°`);
      
      if (rotation !== 0) {
        processingLog.push(`Applying rotation correction: ${rotation}°`);
        this.rotateCanvas(rotation);
        finalRotation = rotation;
        wasProcessed = true;
      }

      // Detect and correct skew
      const skewAngle = await this.deskew(imageData);
      processingLog.push(`Detected skew: ${skewAngle}°`);
      
      if (Math.abs(skewAngle) > 1) {
        processingLog.push(`Applying skew correction: ${skewAngle}°`);
        this.rotateCanvas(skewAngle);
        finalRotation += skewAngle;
        wasProcessed = true;
      }

      // Final enhancement
      if (wasProcessed) {
        const finalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const enhancedImageData = this.enhanceImage(finalImageData);
        this.ctx.putImageData(enhancedImageData, 0, 0);
        processingLog.push("Applied final image enhancement");
      }

      // Convert back to blob
      const blob = await new Promise<Blob>((resolve) => {
        this.canvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/jpeg', 0.9);
      });

      // Create new file
      const processedFile = new File([blob], file.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      processingLog.push("Image processing completed successfully");

      // Calculate quality score
      const quality = Math.max(0, Math.min(100, (blurScore / 200) * 100));

      URL.revokeObjectURL(img.src);

      return {
        processedFile,
        wasProcessed,
        processingLog,
        quality,
        rotation: finalRotation,
      };

    } catch (error) {
      processingLog.push(`Error during processing: ${error}`);
      throw new Error(`Image processing failed: ${error}`);
    }
  }

  /**
   * Process PDF file (pass-through for now, would add PDF processing in production)
   */
  async processPDF(file: File): Promise<ImageProcessingResult> {
    return {
      processedFile: file,
      wasProcessed: false,
      processingLog: ["PDF file detected - no processing applied"],
      quality: 100,
      rotation: 0,
    };
  }

  /**
   * Main processing method that handles both images and PDFs
   */
  async processFile(file: File): Promise<ImageProcessingResult> {
    if (file.type.startsWith('image/')) {
      return this.processImage(file);
    } else if (file.type === 'application/pdf') {
      return this.processPDF(file);
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
  }
}
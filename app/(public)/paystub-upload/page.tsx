"use client";

import { FileUpload } from "@/components/file-upload";
import { MultiStepForm, FormData } from "@/components/multi-step-form";
import { useState } from "react";
import { ImageProcessor } from "@/lib/image-processor";
import { toast } from "sonner";

export default function PaystubUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (file: File) => {
    try {
      setIsProcessing(true);
      
      const processor = new ImageProcessor();
      const result = await processor.processFile(file);
      
      if (result.wasProcessed) {
        toast.success("Image enhanced automatically", {
          description: `Quality score: ${result.quality.toFixed(0)}%`,
        });
      }
      
      setSelectedFile(result.processedFile);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('File processing error:', error);
      toast.error("Failed to process file");
      setIsProcessing(false);
    }
  };

  const handleFormSubmit = async (formData: FormData) => {
    // Implementation would go here
    console.log("Form submitted:", { formData, file: selectedFile });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        <FileUpload 
          onFileSelect={handleFileSelect} 
          isProcessing={isProcessing}
        />
        
        {selectedFile && (
          <MultiStepForm 
            onSubmit={handleFormSubmit}
            isSubmitting={isProcessing}
          />
        )}
      </div>
    </div>
  );
}
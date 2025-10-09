"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { FileUpload } from "@/components/file-upload";
import { MultiStepForm, FormData } from "@/components/multi-step-form";
import { 
  Shield, 
  CheckCircle2, 
  Clock, 
  FileText,
  Phone,
  Users,
  Scale
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { ImageProcessor, ImageProcessingResult } from "@/lib/image-processor";
import { toast } from "sonner";

type Violation = {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
};

type AnalysisResults = {
  analysisId: string;
  violationsFound: boolean;
  confidence: number;
  violations: Violation[];
  summary: string;
};

export default function Home() {
  const { t, language, setLanguage } = useLanguage();
  const [currentStep, setCurrentStep] = useState<'upload' | 'form' | 'processing' | 'results'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);

  const handleFileSelect = async (file: File) => {
    try {
      setIsProcessing(true);
      
      // Process the image client-side
      const processor = new ImageProcessor();
      const result: ImageProcessingResult = await processor.processFile(file);
      
      if (result.wasProcessed) {
        toast.success("Image enhanced automatically", {
          description: `Quality score: ${result.quality.toFixed(0)}%`,
        });
      }
      
      setSelectedFile(result.processedFile);
      
      // Auto-advance to form step
      setTimeout(() => {
        setCurrentStep('form');
        setIsProcessing(false);
      }, 500);
      
    } catch (error) {
      console.error('File processing error:', error);
      toast.error("Failed to process file", {
        description: "Please try a different file or format.",
      });
      setIsProcessing(false);
    }
  };

const handleFormSubmit = async (_formData: FormData) => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    try {
      setIsProcessing(true);
      setCurrentStep('processing');

      // Get pre-signed URL from our API
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { data: uploadData } = await uploadResponse.json();

      // Upload file to S3 (in a real implementation)
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate upload

      // Trigger analysis
      const analysisResponse = await fetch('/api/upload', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId: uploadData.uploadId,
          s3Key: uploadData.s3Key,
          analysisId: uploadData.analysisId,
        }),
      });

      if (!analysisResponse.ok) {
        throw new Error('Failed to start analysis');
      }

      // Simulate analysis process
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Mock results for demo
const mockResults: AnalysisResults = {
        analysisId: uploadData.analysisId,
        violationsFound: true,
        confidence: 0.87,
        violations: [
          {
            type: "Minimum Wage",
            description: "Potential minimum wage violation detected",
            severity: "high",
            confidence: 0.92,
          },
          {
            type: "Overtime Pay",
            description: "Missing overtime compensation",
            severity: "medium", 
            confidence: 0.78,
          },
        ],
        summary: "Our analysis found potential violations in your pay stub. An attorney will review your case.",
      };

      setAnalysisResults(mockResults);
      setCurrentStep('results');
      setIsProcessing(false);
      
      toast.success("Analysis complete!", {
        description: "Potential violations were detected in your pay stub.",
      });

    } catch (error) {
      console.error('Submission error:', error);
      toast.error("Analysis failed", {
        description: "Please try again or contact support.",
      });
      setIsProcessing(false);
      setCurrentStep('form');
    }
  };

  const resetFlow = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setAnalysisResults(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-lg">WageViolation.ai</span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Language Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    language === 'en' 
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('es')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    language === 'es' 
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  ES
                </button>
              </div>
              
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-6">
            <Scale className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-blue-500 to-green-500 bg-clip-text text-transparent">
            {t("title")}
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            {t("subtitle")}
          </p>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className={`flex items-center gap-2 ${
              currentStep === 'upload' || currentStep === 'form' || currentStep === 'processing' || currentStep === 'results' 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-gray-400'
            }`}>
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">Upload</span>
            </div>
            
            <div className={`w-8 h-0.5 ${
              currentStep === 'form' || currentStep === 'processing' || currentStep === 'results' 
                ? 'bg-blue-600 dark:bg-blue-400' 
                : 'bg-gray-300 dark:bg-gray-600'
            }`} />
            
            <div className={`flex items-center gap-2 ${
              currentStep === 'form' || currentStep === 'processing' || currentStep === 'results' 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-gray-400'
            }`}>
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Information</span>
            </div>
            
            <div className={`w-8 h-0.5 ${
              currentStep === 'processing' || currentStep === 'results' 
                ? 'bg-blue-600 dark:bg-blue-400' 
                : 'bg-gray-300 dark:bg-gray-600'
            }`} />
            
            <div className={`flex items-center gap-2 ${
              currentStep === 'processing' || currentStep === 'results' 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-gray-400'
            }`}>
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Analysis</span>
            </div>
            
            <div className={`w-8 h-0.5 ${
              currentStep === 'results' 
                ? 'bg-blue-600 dark:bg-blue-400' 
                : 'bg-gray-300 dark:bg-gray-600'
            }`} />
            
            <div className={`flex items-center gap-2 ${
              currentStep === 'results' 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-gray-400'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Results</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <FileUpload 
                onFileSelect={handleFileSelect} 
                isProcessing={isProcessing}
              />
              
              {/* Trust Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                <Card className="p-4 text-center">
                  <Shield className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Secure & Private</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Your data is encrypted and protected
                  </p>
                </Card>
                
                <Card className="p-4 text-center">
                  <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Fast Analysis</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Results in under 60 seconds
                  </p>
                </Card>
                
                <Card className="p-4 text-center">
                  <Scale className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Legal Experts</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Reviewed by employment attorneys
                  </p>
                </Card>
              </div>
            </div>
          )}

          {currentStep === 'form' && (
            <MultiStepForm 
              onSubmit={handleFormSubmit}
              isSubmitting={isProcessing}
            />
          )}

          {currentStep === 'processing' && (
            <Card className="p-8 text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-semibold mb-2">{t("processingTitle")}</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{t("processingSubtitle")}</p>
              
              <div className="space-y-3 max-w-md mx-auto">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm">{t("uploading")}</span>
                </div>
                <div className="flex items-center gap-3 text-left">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-sm">{t("processing")}</span>
                </div>
                <div className="flex items-center gap-3 text-left">
                  <div className="w-2 h-2 bg-gray-300 rounded-full" />
                  <span className="text-sm text-gray-500">{t("analyzing")}</span>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 'results' && analysisResults && (
            <div className="space-y-6">
              <Card className={`p-6 text-center ${
                analysisResults.violationsFound 
                  ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20' 
                  : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
              }`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  analysisResults.violationsFound 
                    ? 'bg-orange-100 dark:bg-orange-900/30' 
                    : 'bg-green-100 dark:bg-green-900/30'
                }`}>
                  {analysisResults.violationsFound ? (
                    <Scale className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                  )}
                </div>
                
                <h2 className="text-2xl font-semibold mb-2">
                  {analysisResults.violationsFound ? t("violationsFound") : t("noViolations")}
                </h2>
                
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {analysisResults.summary}
                </p>

                {analysisResults.violationsFound && (
                  <div className="space-y-3 max-w-md mx-auto">
{analysisResults.violations.map((violation: Violation, index: number) => (
                      <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 text-left">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            violation.severity === 'high' 
                              ? 'bg-red-500' 
                              : 'bg-yellow-500'
                          }`} />
                          <div>
                            <h4 className="font-medium text-sm">{violation.type}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {violation.description}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                              Confidence: {Math.round(violation.confidence * 100)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                  <Button className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {t("contactAttorney")}
                  </Button>
                  <Button variant="outline" onClick={resetFlow}>
                    Analyze Another Pay Stub
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
              <span>© 2024 WageViolation.ai</span>
              <span>•</span>
              <button className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                {t("privacyPolicy")}
              </button>
              <span>•</span>
              <button className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                {t("termsOfService")}
              </button>
              <span>•</span>
              <button className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                {t("contactUs")}
              </button>
            </div>
            <p className="text-xs">
              This service is for informational purposes only and does not constitute legal advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

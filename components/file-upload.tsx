"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  Camera, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  X 
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing?: boolean;
}

export function FileUpload({ onFileSelect, isProcessing = false }: FileUploadProps) {
  const { t } = useLanguage();
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // Clear previous errors
    setError(null);

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError(t("errorFileTooBig"));
      return false;
    }

    // Check file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg", 
      "image/png",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(t("errorInvalidFormat"));
      return false;
    }

    return true;
  };

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (isProcessing) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [isProcessing]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleCameraInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const openFileDialog = () => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  };

  const openCamera = () => {
    if (!isProcessing) {
      videoInputRef.current?.click();
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileInput}
        className="hidden"
        disabled={isProcessing}
      />

      {/* Camera Input */}
      <input
        ref={videoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraInput}
        className="hidden"
        disabled={isProcessing}
      />

      {!selectedFile ? (
        <Card
          className={`p-8 border-2 border-dashed transition-colors cursor-pointer ${
            dragActive
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDrag}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onClick={openFileDialog}
        >
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            </div>
            
            <h3 className="text-lg font-semibold mb-2">
              {t("uploadTitle")}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t("uploadSubtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <Button
                type="button"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  openFileDialog();
                }}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {t("chooseFile")}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  openCamera();
                }}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                {t("takePhoto")}
              </Button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("dragDrop")}
            </p>
            
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {t("supportedFormats")}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-sm">{selectedFile.name}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFile}
              disabled={isProcessing}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>50%</span>
              </div>
              <Progress value={50} className="h-2" />
            </div>
          )}
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
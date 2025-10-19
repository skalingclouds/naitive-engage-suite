"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Camera, Upload, FileText, Eye, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Language = "en" | "es";

interface FormData {
  workerName: string;
  employerName: string;
  city: string;
  state: string;
  zipCode: string;
}

interface Violation {
  type: string;
  description: string;
  confidence: number;
  severity: "low" | "medium" | "high";
  laborCode?: string;
}

const translations = {
  en: {
    title: "Pay Stub Wage Violation Check",
    subtitle: "Upload your pay stub to check for potential wage violations",
    capturePhoto: "Take Photo",
    uploadFile: "Upload File",
    workerName: "Worker Name",
    employerName: "Employer Name", 
    city: "City",
    state: "State",
    zipCode: "ZIP Code",
    next: "Next",
    processing: "Processing...",
    analyzing: "Analyzing pay stub...",
    checkingOvertime: "Checking overtime violations...",
    checkingMealBreaks: "Checking meal break premiums...",
    generatingSummary: "Generating summary...",
    complete: "Analysis Complete",
    violationsFound: "Potential Violations Found",
    noViolations: "No Violations Detected",
    confidence: "Confidence",
    high: "High",
    medium: "Medium",
    low: "Low",
    viewDetails: "View Details",
    uploadNew: "Upload New Pay Stub",
    errorProcessing: "Error processing pay stub",
    errorCapture: "Error accessing camera",
    errorFile: "Error reading file",
    consent: "I consent to the processing of my pay stub data for wage violation analysis",
    consentRequired: "Please accept the consent to continue"
  },
  es: {
    title: "Verificación de Violaciones Salariales",
    subtitle: "Sube tu talón de pago para verificar posibles violaciones salariales",
    capturePhoto: "Tomar Foto",
    uploadFile: "Subir Archivo",
    workerName: "Nombre del Trabajador",
    employerName: "Nombre del Empleador",
    city: "Ciudad",
    state: "Estado",
    zipCode: "Código Postal",
    next: "Siguiente",
    processing: "Procesando...",
    analyzing: "Analizando talón de pago...",
    checkingOvertime: "Verificando violaciones de horas extras...",
    checkingMealBreaks: "Verificando primas de descanso para comidas...",
    generatingSummary: "Generando resumen...",
    complete: "Análisis Completo",
    violationsFound: "Violaciones Potenciales Encontradas",
    noViolations: "No se Detectaron Violaciones",
    confidence: "Confianza",
    high: "Alta",
    medium: "Media",
    low: "Baja",
    viewDetails: "Ver Detalles",
    uploadNew: "Subir Nuevo Talón",
    errorProcessing: "Error al procesar el talón de pago",
    errorCapture: "Error al acceder a la cámara",
    errorFile: "Error al leer el archivo",
    consent: "Consiento el procesamiento de mis datos de talón de pago para el análisis de violaciones salariales",
    consentRequired: "Por favor acepte el consentimiento para continuar"
  }
};

const californiaCities = [
  "Los Angeles", "San Francisco", "San Diego", "San Jose", "Fresno",
  "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Anaheim"
];

export default function PayStubCapture() {
  const [language, setLanguage] = useState<Language>("en");
  const [step, setStep] = useState<"capture" | "form" | "processing" | "results">("capture");
  const [formData, setFormData] = useState<FormData>({
    workerName: "",
    employerName: "",
    city: "",
    state: "CA",
    zipCode: ""
  });
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const t = translations[language];

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/') && !selectedFile.type === 'application/pdf') {
      toast.error(t.errorFile);
      return;
    }

    setFile(selectedFile);
    
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    }
    
    setStep("form");
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      toast.success("Camera ready. Position your pay stub and capture.");
    } catch (error) {
      toast.error(t.errorCapture);
    }
  };

  const simulateProcessing = async () => {
    setStep("processing");
    setProgress(0);

    const steps = [
      { progress: 20, message: t.analyzing, delay: 800 },
      { progress: 40, message: t.checkingOvertime, delay: 1000 },
      { progress: 60, message: t.checkingMealBreaks, delay: 1000 },
      { progress: 80, message: t.generatingSummary, delay: 1200 },
      { progress: 100, message: t.complete, delay: 500 }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      setProgress(step.progress);
    }

    // Simulate violation detection results
    const mockViolations: Violation[] = [
      {
        type: "Overtime Violation",
        description: language === "en" 
          ? "Employee worked 48 hours in a week but was only paid regular rate for hours over 40."
          : "El empleado trabajó 48 horas en una semana pero solo recibió pago regular por las horas sobre 40.",
        confidence: 0.92,
        severity: "high",
        laborCode: "CA Labor Code § 510"
      },
      {
        type: "Meal Break Premium",
        description: language === "en"
          ? "Employee worked 10+ hours but did not receive a second meal break period."
          : "El empleado trabajó más de 10 horas pero no recibió un segundo período de descanso para comida.",
        confidence: 0.87,
        severity: "medium",
        laborCode: "CA Labor Code § 512"
      }
    ];

    setViolations(mockViolations);
    setStep("results");
  };

  const handleSubmit = async () => {
    if (!consent) {
      toast.error(t.consentRequired);
      return;
    }

    await simulateProcessing();
  };

  const resetForm = () => {
    setStep("capture");
    setFile(null);
    setPreview(null);
    setViolations([]);
    setProgress(0);
    setFormData({
      workerName: "",
      employerName: "",
      city: "",
      state: "CA",
      zipCode: ""
    });
    setConsent(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-blue-900 dark:via-blue-800 dark:to-blue-900">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-2">
            {t.title}
          </h1>
          <p className="text-blue-700 dark:text-blue-300">
            {t.subtitle}
          </p>
          
          {/* Language Toggle */}
          <div className="mt-4 flex justify-center">
            <div className="bg-white dark:bg-blue-800 rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  language === "en"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-blue-700"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("es")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  language === "es"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-blue-700"
                }`}
              >
                ES
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Card className="p-6">
          {step === "capture" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mb-4">
                  <FileText className="w-16 h-16 mx-auto text-blue-600" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {language === "en" 
                    ? "Take a photo or upload your pay stub to begin analysis"
                    : "Toma una foto o sube tu talón de pago para comenzar el análisis"
                  }
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={handleCameraCapture}
                  className="h-20 flex-col gap-2"
                  variant="outline"
                >
                  <Camera className="w-6 h-6" />
                  {t.capturePhoto}
                </Button>
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 flex-col gap-2"
                  variant="outline"
                >
                  <Upload className="w-6 h-6" />
                  {t.uploadFile}
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              {/* Camera Preview */}
              {videoRef.current?.srcObject && (
                <div className="mt-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg border"
                  />
                  <Button
                    onClick={() => {
                      const canvas = document.createElement('canvas');
                      const video = videoRef.current;
                      if (video) {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(video, 0, 0);
                        canvas.toBlob((blob) => {
                          if (blob) {
                            const file = new File([blob], 'paystub.jpg', { type: 'image/jpeg' });
                            handleFileSelect(file);
                          }
                        });
                        
                        // Stop camera stream
                        const stream = video.srcObject as MediaStream;
                        stream.getTracks().forEach(track => track.stop());
                      }
                    }}
                    className="w-full mt-2"
                  >
                    Capture Photo
                  </Button>
                </div>
              )}

              {preview && (
                <div className="mt-4">
                  <img
                    src={preview}
                    alt="Pay stub preview"
                    className="w-full rounded-lg border"
                  />
                </div>
              )}
            </div>
          )}

          {step === "form" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">
                {language === "en" ? "Additional Information" : "Información Adicional"}
              </h3>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="workerName">{t.workerName}</Label>
                  <Input
                    id="workerName"
                    value={formData.workerName}
                    onChange={(e) => setFormData({ ...formData, workerName: e.target.value })}
                    placeholder={t.workerName}
                  />
                </div>

                <div>
                  <Label htmlFor="employerName">{t.employerName}</Label>
                  <Input
                    id="employerName"
                    value={formData.employerName}
                    onChange={(e) => setFormData({ ...formData, employerName: e.target.value })}
                    placeholder={t.employerName}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city">{t.city}</Label>
                    <Select value={formData.city} onValueChange={(value) => setFormData({ ...formData, city: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t.city} />
                      </SelectTrigger>
                      <SelectContent>
                        {californiaCities.map(city => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="zipCode">{t.zipCode}</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      placeholder={t.zipCode}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {t.consent}
                  </span>
                </label>
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full"
                disabled={!consent}
              >
                {t.next}
              </Button>
            </div>
          )}

          {step === "processing" && (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-blue-600" />
              <h3 className="text-lg font-semibold mb-2">{t.processing}</h3>
              <Progress value={progress} className="w-full mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {progress < 20 && t.analyzing}
                {progress >= 20 && progress < 40 && t.checkingOvertime}
                {progress >= 40 && progress < 60 && t.checkingMealBreaks}
                {progress >= 60 && progress < 80 && t.generatingSummary}
                {progress >= 80 && t.complete}
              </p>
            </div>
          )}

          {step === "results" && (
            <div className="space-y-6">
              <div className="text-center">
                {violations.length > 0 ? (
                  <>
                    <AlertCircle className="w-16 h-16 mx-auto mb-4 text-orange-500" />
                    <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-300">
                      {t.violationsFound}
                    </h3>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
                      {t.noViolations}
                    </h3>
                  </>
                )}
              </div>

              {violations.length > 0 && (
                <div className="space-y-4">
                  {violations.map((violation, index) => (
                    <Card key={index} className="p-4 border-orange-200 dark:border-orange-800">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-orange-700 dark:text-orange-300">
                          {violation.type}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                            {t.confidence}: {Math.round(violation.confidence * 100)}%
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            violation.severity === "high" 
                              ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                              : violation.severity === "medium"
                              ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                              : "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                          }`}>
                            {t[violation.severity]}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        {violation.description}
                      </p>
                      {violation.laborCode && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {violation.laborCode}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={resetForm}
                  variant="outline"
                  className="flex-1"
                >
                  {t.uploadNew}
                </Button>
                {violations.length > 0 && (
                  <Button 
                    className="flex-1"
                    onClick={() => window.open(`/paystub/results/demo-${Date.now()}`, '_blank')}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {t.viewDetails}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
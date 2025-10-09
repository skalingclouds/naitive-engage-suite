"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Download,
  Share,
  Printer,
  Mail,
  MessageSquare,
  Eye,
  Calendar,
  User,
  Building,
  MapPin,
  DollarSign,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";

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
    blobUrl?: string;
    extractedData?: any;
    confidenceScores?: Record<string, number>;
  };
}

interface LLMSummary {
  overall_summary: string;
  key_findings: string[];
  recommended_actions: string[];
  next_steps: string[];
  legal_rights_summary: string;
  confidence_level: string;
  disclaimer: string;
}

export default function ResultsDisplay({ params }: { params: { id: string } }) {
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { id } = params;
  const [summary, setSummary] = useState<LLMSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [language, setLanguage] = useState<"en" | "es">("en");

  // Fetch result data
  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/paystub/results/${id}`);
        
        if (response.ok) {
          const data = await response.json();
          setResult(data);
        } else {
          setError('Failed to load results');
        }
      } catch (error) {
        console.error('Error fetching result:', error);
        setError('An error occurred while loading results');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [id]);

  const translations = {
    en: {
      title: "Pay Stub Analysis Results",
      processingComplete: "Analysis Complete",
      violationsFound: "Potential Violations Detected",
      noViolations: "No Violations Detected",
      overallConfidence: "Overall Confidence",
      processingTime: "Processing Time",
      ocrService: "OCR Service",
      generatedSummary: "AI-Generated Summary",
      keyFindings: "Key Findings",
      recommendedActions: "Recommended Actions",
      nextSteps: "Next Steps",
      legalRights: "Your Legal Rights",
      disclaimer: "Important Disclaimer",
      downloadReport: "Download Report",
      shareResults: "Share Results",
      printSummary: "Print Summary",
      contactLawyer: "Contact Lawyer",
      askQuestions: "Ask Questions",
      violationDetails: "Violation Details",
      extractedData: "Extracted Pay Stub Data",
      processingInfo: "Processing Information"
    },
    es: {
      title: "Resultados del Análisis del Talón de Pago",
      processingComplete: "Análisis Completo",
      violationsFound: "Violaciones Potenciales Detectadas",
      noViolations: "No se Detectaron Violaciones",
      overallConfidence: "Confianza General",
      processingTime: "Tiempo de Procesamiento",
      ocrService: "Servicio OCR",
      generatedSummary: "Resumen Generado por IA",
      keyFindings: "Hallazgos Clave",
      recommendedActions: "Acciones Recomendadas",
      nextSteps: "Próximos Pasos",
      legalRights: "Sus Derechos Legales",
      disclaimer: "Descargo de Responsabilidad Importante",
      downloadReport: "Descargar Informe",
      shareResults: "Compartir Resultados",
      printSummary: "Imprimir Resumen",
      contactLawyer: "Contactar Abogado",
      askQuestions: "Hacer Preguntas",
      violationDetails: "Detalles de Violación",
      extractedData: "Datos Extraídos del Talón de Pago",
      processingInfo: "Información de Procesamiento"
    }
  };

  const t = translations[language];

  const generateLLMSummary = async () => {
    setLoadingSummary(true);
    
    try {
      const response = await fetch('/api/llm/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          violations: result.violations,
          confidence: result.confidence,
          extractedData: result.metadata.extractedData,
          language
        })
      });

      if (response.ok) {
        const llmResult = await response.json();
        setSummary(llmResult.summary);
      } else {
        throw new Error('Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      // Fallback summary
      setSummary({
        overall_summary: language === "en" 
          ? `Based on our analysis, we found ${result.violations.length} potential violations with ${Math.round(result.confidence * 100)}% confidence.`
          : `Según nuestro análisis, encontramos ${result.violations.length} violaciones potenciales con ${Math.round(result.confidence * 100)}% de confianza.`,
        key_findings: result.violations.map(v => v.description),
        recommended_actions: language === "en"
          ? ["Review your pay records carefully", "Consider consulting with an employment lawyer", "Document all hours worked"]
          : ["Revise sus registros de pago cuidadosamente", "Considere consultar con un abogado laboral", "Documente todas las horas trabajadas"],
        next_steps: language === "en"
          ? ["Gather additional pay stubs", "Create a timeline of work hours", "Prepare questions for legal consultation"]
          : ["Reúna talones de pago adicionales", "Cree una línea de tiempo de horas trabajadas", "Prepare preguntas para consulta legal"],
        legal_rights_summary: language === "en"
          ? "California law provides strong protections for workers. You have the right to receive proper overtime pay, meal breaks, and detailed pay statements."
          : "Las leyes de California proporcionan protecciones fuertes para los trabajadores. Tiene derecho a recibir pago de horas extras adecuado, descansos para comidas y estados de pago detallados.",
        confidence_level: `${Math.round(result.confidence * 100)}%`,
        disclaimer: language === "en"
          ? "This analysis is for informational purposes only and does not constitute legal advice. Please consult with a qualified employment attorney for legal guidance."
          : "Este análisis es solo para fines informativos y no constituye asesoramiento legal. Por favor consulte con un abogado laboral calificado para orientación legal."
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (result) {
      generateLLMSummary();
    }
  }, [language, result]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {error || 'Results not found'}
          </p>
          <Button onClick={() => window.close()}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t.title}
          </h1>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <CheckCircle className="w-5 h-5 text-green-500" />
            {t.processingComplete}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {result.violations.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {result.violations.length === 1 ? 'Violation' : 'Violations'}
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className={`text-3xl font-bold mb-2 ${getConfidenceColor(result.confidence)}`}>
              {Math.round(result.confidence * 100)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {t.overallConfidence}
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {result.processingTime}ms
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {t.processingTime}
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="violations">Violations</TabsTrigger>
            <TabsTrigger value="data">Extracted Data</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            {/* AI-Generated Summary */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  {t.generatedSummary}
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLanguage(language === "en" ? "es" : "en")}
                  >
                    {language === "en" ? "ES" : "EN"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateLLMSummary}
                    disabled={loadingSummary}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {loadingSummary ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : summary ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-2">Overall Assessment</h4>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {summary.overall_summary}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {t.keyFindings}
                    </h4>
                    <ul className="space-y-2">
                      {summary.key_findings.map((finding, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-gray-700 dark:text-gray-300">{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">{t.recommendedActions}</h4>
                    <ul className="space-y-2">
                      {summary.recommended_actions.map((action, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-gray-700 dark:text-gray-300">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">{t.nextSteps}</h4>
                    <ul className="space-y-2">
                      {summary.next_steps.map((step, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-gray-700 dark:text-gray-300">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{t.legalRights}:</strong> {summary.legal_rights_summary}
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>{t.disclaimer}:</strong> {summary.disclaimer}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : null}
            </Card>

            {/* Action Buttons */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Take Action</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  {t.downloadReport}
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <Share className="w-4 h-4" />
                  {t.shareResults}
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  {t.printSummary}
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {t.contactLawyer}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="violations" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {result.violations.length > 0 ? t.violationsFound : t.noViolations}
              </h3>
              
              {result.violations.length > 0 ? (
                <div className="space-y-4">
                  {result.violations.map((violation, index) => (
                    <div 
                      key={index} 
                      className={`border rounded-lg p-4 ${getSeverityColor(violation.severity)}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{violation.type}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {Math.round(violation.confidence * 100)}% confidence
                          </Badge>
                          <Badge variant="outline">
                            {violation.severity}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mb-2">
                        {violation.description}
                      </p>
                      {violation.laborCode && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Legal Reference: {violation.laborCode}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-300">
                    No violations were detected in this pay stub.
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">{t.extractedData}</h3>
              
              {result.metadata.extractedData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(result.metadata.extractedData).map(([key, value]: [string, any]) => (
                    <div key={key} className="border rounded-lg p-3">
                      <div className="text-sm text-gray-500 mb-1 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="font-medium">
                        {typeof value === 'object' && value?.value !== undefined 
                          ? (typeof value.value === 'number' ? formatCurrency(value.value) : value.value)
                          : (typeof value === 'number' ? formatCurrency(value) : value)
                        }
                      </div>
                      {typeof value === 'object' && value?.confidence && (
                        <div className="text-xs text-gray-500 mt-1">
                          Confidence: {Math.round(value.confidence * 100)}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-300">
                  No extracted data available.
                </p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">{t.processingInfo}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Processing Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Analysis ID:</span>
                      <span className="font-mono text-sm">{result.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">{t.ocrService}:</span>
                      <span>{result.metadata.ocrService}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">{t.processingTime}:</span>
                      <span>{result.processingTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Analysis Date:</span>
                      <span>{new Date(result.metadata.processingTimestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Confidence Breakdown</h4>
                  {result.metadata.confidenceScores ? (
                    <div className="space-y-2">
                      {Object.entries(result.metadata.confidenceScores).map(([field, confidence]) => (
                        <div key={field}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span>{Math.round(confidence * 100)}%</span>
                          </div>
                          <Progress value={confidence * 100} className="h-2" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-300">
                      No confidence data available.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {result.metadata.blobUrl && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Original Document</h3>
                <div className="flex items-center gap-4">
                  <Button variant="outline" asChild>
                    <a href={result.metadata.blobUrl} target="_blank" rel="noopener noreferrer">
                      <Eye className="w-4 h-4 mr-2" />
                      View Original Pay Stub
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={result.metadata.blobUrl} download={`paystub-${result.id}`}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Original
                    </a>
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
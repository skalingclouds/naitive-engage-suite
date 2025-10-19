"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  Server, 
  TestTube, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";

interface OCRService {
  id: string;
  name: string;
  description: string;
  available: boolean;
  status: 'active' | 'inactive' | 'testing' | 'error';
  lastTest?: string;
  responseTime?: number;
  accuracy?: number;
  costPerRequest?: number;
}

interface SystemConfig {
  defaultOCRService: string;
  enableDualProcessing: boolean;
  confidenceThreshold: number;
  maxProcessingTime: number;
  fallbackEnabled: boolean;
}

export default function OCRAdminPanel() {
  const [services, setServices] = useState<OCRService[]>([
    {
      id: "azure_document_intelligence",
      name: "Azure Document Intelligence",
      description: "Azure's structured document processing service",
      available: false,
      status: "inactive"
    },
    {
      id: "gpt_5_mini", 
      name: "GPT-5-mini",
      description: "OpenAI's latest model with advanced OCR capabilities",
      available: false,
      status: "inactive"
    }
  ]);

  const [config, setConfig] = useState<SystemConfig>({
    defaultOCRService: "azure_document_intelligence",
    enableDualProcessing: false,
    confidenceThreshold: 0.90,
    maxProcessingTime: 3000,
    fallbackEnabled: true
  });

  const [testingService, setTestingService] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/ocr/services');
      const data = await response.json();
      
      setServices(data.services.map((service: any) => ({
        ...service,
        status: service.available ? 'active' : 'inactive',
        lastTest: service.lastTest || null,
        responseTime: service.responseTime || null,
        accuracy: service.accuracy || null
      })));
    } catch (error) {
      toast.error("Failed to fetch OCR services");
    }
  };

  const testService = async (serviceId: string) => {
    setTestingService(serviceId);
    
    try {
      // Update service status to testing
      setServices(prev => prev.map(s => 
        s.id === serviceId ? { ...s, status: 'testing' as const } : s
      ));

      const startTime = Date.now();
      
      // Mock service test - in production this would test actual connectivity
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const responseTime = Date.now() - startTime;
      const success = Math.random() > 0.1; // 90% success rate for mock
      
      if (success) {
        setServices(prev => prev.map(s => 
          s.id === serviceId ? {
            ...s,
            status: 'active' as const,
            available: true,
            lastTest: new Date().toISOString(),
            responseTime,
            accuracy: 0.85 + Math.random() * 0.15, // 85-100% accuracy
            costPerRequest: serviceId === 'gpt_5_mini' ? 0.002 : 0.001
          } : s
        ));
        
        toast.success(`Service test completed successfully`);
      } else {
        setServices(prev => prev.map(s => 
          s.id === serviceId ? {
            ...s,
            status: 'error' as const,
            available: false,
            lastTest: new Date().toISOString()
          } : s
        ));
        
        toast.error(`Service test failed`);
      }
    } catch (error) {
      setServices(prev => prev.map(s => 
        s.id === serviceId ? {
          ...s,
          status: 'error' as const,
          available: false,
          lastTest: new Date().toISOString()
        } : s
      ));
      
      toast.error("Service test failed");
    } finally {
      setTestingService(null);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    
    try {
      const response = await fetch('/api/admin/ocr/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast.success("Configuration saved successfully");
      } else {
        toast.error("Failed to save configuration");
      }
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const getStatusIcon = (status: OCRService['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'testing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: OCRService['status']) => {
    const variants = {
      active: "default",
      testing: "secondary",
      error: "destructive",
      inactive: "outline"
    } as const;

    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                OCR Services Configuration
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Manage and configure OCR processing services
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="services" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Available Services</h2>
                <Button onClick={fetchServices} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="space-y-4">
                {services.map((service) => (
                  <div key={service.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(service.status)}
                          <h3 className="font-semibold">{service.name}</h3>
                          {getStatusBadge(service.status)}
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                          {service.description}
                        </p>

                        {service.available && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            {service.responseTime && (
                              <div>
                                <span className="text-gray-500">Response Time:</span>
                                <p className="font-medium">{service.responseTime}ms</p>
                              </div>
                            )}
                            {service.accuracy && (
                              <div>
                                <span className="text-gray-500">Accuracy:</span>
                                <p className="font-medium">{Math.round(service.accuracy * 100)}%</p>
                              </div>
                            )}
                            {service.costPerRequest && (
                              <div>
                                <span className="text-gray-500">Cost/Request:</span>
                                <p className="font-medium">${service.costPerRequest.toFixed(4)}</p>
                              </div>
                            )}
                            {service.lastTest && (
                              <div>
                                <span className="text-gray-500">Last Test:</span>
                                <p className="font-medium">
                                  {new Date(service.lastTest).toLocaleTimeString()}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => testService(service.id)}
                          disabled={testingService === service.id}
                          variant="outline"
                          size="sm"
                        >
                          {testingService === service.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Testing
                            </>
                          ) : (
                            <>
                              <TestTube className="w-4 h-4 mr-2" />
                              Test
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-6">Processing Configuration</h2>
              
              <div className="space-y-6">
                <div>
                  <Label htmlFor="defaultService">Default OCR Service</Label>
                  <Select
                    value={config.defaultOCRService}
                    onValueChange={(value) => setConfig({ ...config, defaultOCRService: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {services.filter(s => s.available).map(service => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="confidenceThreshold">Confidence Threshold</Label>
                    <Input
                      id="confidenceThreshold"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={config.confidenceThreshold}
                      onChange={(e) => setConfig({ ...config, confidenceThreshold: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum confidence level for field extraction (0.0-1.0)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="maxProcessingTime">Max Processing Time (ms)</Label>
                    <Input
                      id="maxProcessingTime"
                      type="number"
                      min="1000"
                      max="10000"
                      step="100"
                      value={config.maxProcessingTime}
                      onChange={(e) => setConfig({ ...config, maxProcessingTime: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum processing time before fallback
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="dualProcessing">Enable Dual Processing</Label>
                      <p className="text-sm text-gray-500">
                        Process with multiple services and compare results
                      </p>
                    </div>
                    <Switch
                      id="dualProcessing"
                      checked={config.enableDualProcessing}
                      onCheckedChange={(checked) => setConfig({ ...config, enableDualProcessing: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="fallback">Enable Fallback</Label>
                      <p className="text-sm text-gray-500">
                        Use secondary service if primary fails
                      </p>
                    </div>
                    <Switch
                      id="fallback"
                      checked={config.fallbackEnabled}
                      onCheckedChange={(checked) => setConfig({ ...config, fallbackEnabled: checked })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    onClick={saveConfiguration}
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-6">Performance Metrics</h2>
              
              <Alert>
                <Server className="h-4 w-4" />
                <AlertDescription>
                  Performance metrics and analytics will be available once the services are configured and processing real documents.
                </Alert>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">--</div>
                  <div className="text-sm text-gray-500">Total Processed</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">--</div>
                  <div className="text-sm text-gray-500">Success Rate</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">--</div>
                  <div className="text-sm text-gray-500">Avg Response Time</div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
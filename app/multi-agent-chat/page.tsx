"use client";

import React, { useState, useEffect, useRef } from "react";
import { useChat } from '@ai-sdk/react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bot,
  User,
  Loader2,
  Send,
  Upload,
  FileText,
  Shield,
  Calculator,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Clock,
  Settings,
  Globe,
  Zap,
  TrendingUp,
  Scale,
  HelpCircle,
  ChevronRight,
  FileCheck,
  Gavel,
  DollarSign,
  Users,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
  toolInvocations?: Array<{
    toolName: string;
    state: 'call' | 'result' | 'approval-requested';
    args?: any;
    result?: any;
    agent?: string;
  }>;
  agent?: string;
  workflow?: string;
}

interface UserContext {
  isEmployee: boolean;
  isCurrentlyEmployed: boolean;
  location: string;
  urgency: 'low' | 'medium' | 'high';
  language: 'en' | 'es';
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced';
}

interface DocumentInfo {
  documentType: 'paystub' | 'w2' | '1099' | 'other';
  fileName?: string;
  hasOCRData: boolean;
}

interface Preferences {
  includePenalties: boolean;
  includeProcessGuidance: boolean;
  includeRightsEducation: boolean;
  depth: 'summary' | 'detailed' | 'comprehensive';
}

// Agent configuration with icons and colors
const agentConfig = {
  documentProcessor: {
    name: 'Document Processor',
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'Handles document upload, OCR, and data extraction'
  },
  qualityController: {
    name: 'Quality Controller',
    icon: FileCheck,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    description: 'Validates OCR accuracy and data quality'
  },
  rulesAnalyst: {
    name: 'Rules Analyst',
    icon: Scale,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    description: 'Performs labor law analysis and compliance checking'
  },
  penaltyCalculator: {
    name: 'Penalty Calculator',
    icon: Calculator,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    description: 'Calculates penalties and recovery amounts'
  },
  complianceScorer: {
    name: 'Compliance Scorer',
    icon: TrendingUp,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    description: 'Assesses overall compliance levels'
  },
  rightsEducator: {
    name: 'Rights Educator',
    icon: BookOpen,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    description: 'Explains worker rights and protections'
  },
  processGuide: {
    name: 'Process Guide',
    icon: HelpCircle,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
    description: 'Provides step-by-step process guidance'
  },
  assistant: {
    name: 'Assistant',
    icon: Bot,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    description: 'General assistance and support'
  }
};

// Workflow configuration
const workflowConfig = {
  'document-analysis': {
    name: 'Document Analysis',
    description: 'Complete document processing and compliance analysis',
    icon: FileText,
    color: 'bg-blue-500',
    steps: ['Validation', 'OCR Processing', 'Quality Control', 'Rules Analysis', 'Summary']
  },
  'violation-assessment': {
    name: 'Violation Assessment',
    description: 'Detailed assessment of detected violations',
    icon: Gavel,
    color: 'bg-red-500',
    steps: ['Violation Analysis', 'Penalty Calculation', 'Rights Explanation', 'Action Planning']
  },
  'rights-guidance': {
    name: 'Rights Guidance',
    description: 'Education about worker rights and protections',
    icon: Shield,
    color: 'bg-green-500',
    steps: ['Rights Identification', 'Explanation', 'Enforcement Guidance', 'Resource Connection']
  },
  'compliance-review': {
    name: 'Compliance Review',
    description: 'Comprehensive compliance assessment',
    icon: TrendingUp,
    color: 'bg-cyan-500',
    steps: ['Compliance Analysis', 'Scoring', 'Benchmarking', 'Improvement Planning']
  },
  'penalty-calculation': {
    name: 'Penalty Calculation',
    description: 'Detailed penalty and recovery calculations',
    icon: Calculator,
    color: 'bg-orange-500',
    steps: ['Violation Analysis', 'Penalty Assessment', 'Interest Calculation', 'Total Recovery']
  }
};

export default function MultiAgentChatPage() {
  const [isClient, setIsClient] = useState(false);
  const [userContext, setUserContext] = useState<UserContext>({
    isEmployee: true,
    isCurrentlyEmployed: true,
    location: 'CA',
    urgency: 'medium',
    language: 'en',
    expertiseLevel: 'beginner'
  });
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo>({
    documentType: 'paystub',
    hasOCRData: false
  });
  const [preferences, setPreferences] = useState<Preferences>({
    includePenalties: true,
    includeProcessGuidance: true,
    includeRightsEducation: true,
    depth: 'detailed'
  });
  const [currentWorkflow, setCurrentWorkflow] = useState<string>('document-analysis');
  const [showSettings, setShowSettings] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    reload,
    append
  } = useChat<AgentMessage>({
    api: '/api/agents/chat',
    initialMessages: [
      {
        id: '1',
        role: 'assistant' as const,
        content: `Welcome to the Multi-Agent Labor Law Assistant! I coordinate with specialized AI agents to help you with document analysis, compliance checking, and rights guidance.

I can help you with:
📄 **Document Analysis** - Upload pay stubs, W-2s, or other employment documents for comprehensive analysis
⚖️ **Violation Assessment** - Review potential labor law violations and calculate penalties
🛡️ **Rights Guidance** - Understand your worker rights and protections
📊 **Compliance Review** - Assess overall compliance levels
💰 **Penalty Calculations** - Calculate potential recovery amounts

Choose a workflow below or upload a document to get started!`,
        createdAt: new Date(),
      }
    ],
    body: {
      workflowType: currentWorkflow,
      userContext,
      documentInfo,
      preferences
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const renderToolInvocation = (invocation: any) => {
    const agent = agentConfig[invocation.agent as keyof typeof agentConfig] || agentConfig.assistant;
    const AgentIcon = agent.icon;

    if (invocation.state === 'call') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
          <div className={`w-4 h-4 rounded-full ${agent.bgColor} flex items-center justify-center`}>
            <AgentIcon className={`w-3 h-3 ${agent.color}`} />
          </div>
          <span>{agent.name} is working...</span>
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      );
    }

    if (invocation.state === 'result' && invocation.result) {
      return (
        <Card className={`p-4 border-l-4 ${invocation.agent === 'rulesAnalyst' ? 'border-l-purple-500 bg-purple-50 dark:bg-purple-950/20' :
          invocation.agent === 'penaltyCalculator' ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20' :
          invocation.agent === 'documentProcessor' ? 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20' :
          'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20'}`}>
          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full ${agent.bgColor} flex items-center justify-center flex-shrink-0`}>
              <AgentIcon className={`w-4 h-4 ${agent.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm">{agent.name}</span>
                <Badge variant="outline" className="text-xs">Complete</Badge>
              </div>

              {invocation.agent === 'rulesAnalyst' && invocation.result.violations && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Analysis Results:</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-red-100 dark:bg-red-900/30 rounded">
                      <div className="font-bold text-red-600 dark:text-red-400">{invocation.result.violations?.filter((v: any) => v.severity === 'high').length || 0}</div>
                      <div className="text-red-600 dark:text-red-400">High Severity</div>
                    </div>
                    <div className="text-center p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                      <div className="font-bold text-yellow-600 dark:text-yellow-400">{invocation.result.violations?.filter((v: any) => v.severity === 'medium').length || 0}</div>
                      <div className="text-yellow-600 dark:text-yellow-400">Medium Severity</div>
                    </div>
                    <div className="text-center p-2 bg-green-100 dark:bg-green-900/30 rounded">
                      <div className="font-bold text-green-600 dark:text-green-400">{invocation.result.violations?.filter((v: any) => v.severity === 'low').length || 0}</div>
                      <div className="text-green-600 dark:text-green-400">Low Severity</div>
                    </div>
                  </div>
                </div>
              )}

              {invocation.agent === 'penaltyCalculator' && invocation.result.totalRecovery && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Potential Recovery:</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${invocation.result.totalRecovery?.toLocaleString() || '0'}
                  </div>
                  {invocation.result.breakdown && (
                    <div className="text-xs text-muted-foreground">
                      Unpaid wages: ${invocation.result.breakdown.unpaidWages?.toLocaleString() || '0'} |
                      Penalties: ${invocation.result.breakdown.statutoryPenalties?.toLocaleString() || '0'}
                    </div>
                  )}
                </div>
              )}

              {invocation.agent === 'documentProcessor' && invocation.result.extractedData && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Document Processing Complete</div>
                  <div className="text-xs text-muted-foreground">
                    Confidence: {Math.round((invocation.result.confidence || 0) * 100)}% |
                    Processing time: {invocation.result.processingTime || 0}s
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Completed {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </Card>
      );
    }

    return null;
  };

  const renderMessage = (message: AgentMessage) => {
    const isUser = message.role === 'user';

    return (
      <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
        )}

        <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
          <div className={`rounded-lg p-4 ${
            isUser
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white ml-auto'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          }`}>
            <div className="whitespace-pre-wrap text-sm">{message.content}</div>

            {/* Render tool invocations for assistant messages */}
            {message.toolInvocations?.map((invocation, index) => (
              <div key={index} className="mt-3">
                {renderToolInvocation(invocation)}
              </div>
            ))}

            {/* Agent and workflow indicators */}
            {!isUser && (message.agent || message.workflow) && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                {message.agent && (
                  <Badge variant="outline" className="text-xs">
                    {agentConfig[message.agent as keyof typeof agentConfig]?.name || message.agent}
                  </Badge>
                )}
                {message.workflow && (
                  <Badge variant="outline" className="text-xs">
                    {workflowConfig[message.workflow as keyof typeof workflowConfig]?.name || message.workflow}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 px-1">
            <span className="text-xs text-muted-foreground">
              {message.createdAt?.toLocaleTimeString()}
            </span>
            {error && message.role === 'assistant' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => reload()}
                className="h-6 px-2 text-xs"
              >
                <AlertCircle className="w-3 h-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </div>

        {isUser && (
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
        )}
      </div>
    );
  };

  const handleWorkflowChange = (workflow: string) => {
    setCurrentWorkflow(workflow);
    append({
      role: 'user',
      content: `I want to use the ${workflowConfig[workflow as keyof typeof workflowConfig]?.name} workflow.`,
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setDocumentInfo(prev => ({
        ...prev,
        fileName: file.name,
        documentType: 'paystub', // Default to paystub, could be improved with file type detection
        hasOCRData: true
      }));

      append({
        role: 'user',
        content: `I've uploaded a file: ${file.name}. Please analyze it.`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                ← Back
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">Multi-Agent Labor Law Assistant</h1>
                  <p className="text-sm text-muted-foreground">AI-powered document analysis and rights guidance</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="container mx-auto px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* User Context */}
              <div>
                <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  User Context
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isEmployee"
                      checked={userContext.isEmployee}
                      onChange={(e) => setUserContext(prev => ({ ...prev, isEmployee: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="isEmployee" className="text-sm">I am an employee</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isCurrentlyEmployed"
                      checked={userContext.isCurrentlyEmployed}
                      onChange={(e) => setUserContext(prev => ({ ...prev, isCurrentlyEmployed: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="isCurrentlyEmployed" className="text-sm">Currently employed</label>
                  </div>
                  <select
                    value={userContext.location}
                    onChange={(e) => setUserContext(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full p-2 text-sm border rounded"
                  >
                    <option value="CA">California</option>
                    <option value="NY">New York</option>
                    <option value="TX">Texas</option>
                    <option value="FL">Florida</option>
                  </select>
                </div>
              </div>

              {/* Document Info */}
              <div>
                <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Document Type
                </h3>
                <select
                  value={documentInfo.documentType}
                  onChange={(e) => setDocumentInfo(prev => ({
                    ...prev,
                    documentType: e.target.value as any
                  }))}
                  className="w-full p-2 text-sm border rounded"
                >
                  <option value="paystub">Pay Stub</option>
                  <option value="w2">W-2 Form</option>
                  <option value="1099">1099 Form</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Preferences */}
              <div>
                <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Preferences
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includePenalties"
                      checked={preferences.includePenalties}
                      onChange={(e) => setPreferences(prev => ({ ...prev, includePenalties: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="includePenalties" className="text-sm">Include penalty calculations</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeProcessGuidance"
                      checked={preferences.includeProcessGuidance}
                      onChange={(e) => setPreferences(prev => ({ ...prev, includeProcessGuidance: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="includeProcessGuidance" className="text-sm">Include process guidance</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeRightsEducation"
                      checked={preferences.includeRightsEducation}
                      onChange={(e) => setPreferences(prev => ({ ...prev, includeRightsEducation: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="includeRightsEducation" className="text-sm">Include rights education</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Workflow Selection */}
          <div className="lg:col-span-1">
            <Card className="p-4">
              <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Workflows
              </h3>
              <div className="space-y-2">
                {Object.entries(workflowConfig).map(([key, workflow]) => {
                  const WorkflowIcon = workflow.icon;
                  return (
                    <Button
                      key={key}
                      variant={currentWorkflow === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleWorkflowChange(key)}
                      className="w-full justify-start gap-2 h-auto p-3"
                    >
                      <div className={`w-8 h-8 rounded-full ${workflow.color} flex items-center justify-center flex-shrink-0`}>
                        <WorkflowIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-sm">{workflow.name}</div>
                        <div className="text-xs opacity-75">{workflow.description}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>

              <Separator className="my-4" />

              {/* File Upload */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Document
                </h3>
                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isLoading}
                  />
                  <Button variant="outline" size="sm" className="w-full" disabled={isLoading}>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
                {uploadedFile && (
                  <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                    <div className="font-medium">{uploadedFile.name}</div>
                    <div>{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              {/* Agent Status */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Active Agents
                </h3>
                <div className="space-y-1">
                  {Object.entries(agentConfig).slice(0, 4).map(([key, agent]) => {
                    const AgentIcon = agent.icon;
                    return (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <div className={`w-4 h-4 rounded-full ${agent.bgColor} flex items-center justify-center`}>
                          <AgentIcon className={`w-3 h-3 ${agent.color}`} />
                        </div>
                        <span className="text-muted-foreground">{agent.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <Card className="bg-white dark:bg-gray-900">
              {/* Messages Area */}
              <ScrollArea className="h-[600px] p-4">
                <div className="space-y-4">
                  {messages.map(renderMessage)}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Orchestrator is coordinating with specialist agents...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error display */}
                  {error && (
                    <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <AlertDescription className="text-red-600 dark:text-red-400">
                        <div className="font-medium">Connection Error</div>
                        <div className="text-sm">{error.message || 'Failed to get response. Please try again.'}</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reload()}
                          className="mt-2 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                        >
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Try Again
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <Separator />

              {/* Input Area */}
              <div className="p-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Ask about ${workflowConfig[currentWorkflow as keyof typeof workflowConfig]?.name.toLowerCase()} or upload a document...`}
                    className="flex-1"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>

                {/* Quick Actions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("Can you help me understand my rights as an employee?")}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    Employee Rights
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("What should I look for in my pay stub?")}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Pay Stub Analysis
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("How do I file a wage claim?")}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    <Gavel className="w-3 h-3 mr-1" />
                    File a Claim
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("Calculate potential penalties for minimum wage violations")}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    <DollarSign className="w-3 h-3 mr-1" />
                    Calculate Penalties
                  </Button>
                </div>
              </div>
            </Card>

            {/* Info Card */}
            <Card className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-1">
                    AI-Powered Multi-Agent System
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This advanced system uses Vercel AI SDK 6 with ai-sdk-tools to coordinate between specialized agents for document processing, legal analysis, and rights guidance. The orchestrator manages complex workflows and provides comprehensive, actionable insights.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
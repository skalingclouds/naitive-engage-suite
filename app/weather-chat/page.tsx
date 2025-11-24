"use client";

import React, { useState, useEffect, useRef } from "react";
import { useChat } from '@ai-sdk/react';
import { InferAgentUIMessage } from 'ai';
import { weatherAgent } from '@/agents/weather-agent';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  Wind,
  Droplets,
  Eye,
  Gauge,
  Loader2,
  Send,
  Bot,
  User,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

// Type inference from the weather agent
type WeatherMessage = InferAgentUIMessage<typeof weatherAgent>;

// Weather condition icon mapping
const weatherIcons = {
  sunny: Sun,
  'partly cloudy': Cloud,
  cloudy: Cloud,
  rainy: CloudRain,
  stormy: CloudRain,
  snowy: CloudSnow,
};

// Weather color mapping
const weatherColors = {
  sunny: 'text-yellow-500',
  'partly cloudy': 'text-gray-500',
  cloudy: 'text-gray-600',
  rainy: 'text-blue-500',
  stormy: 'text-purple-500',
  snowy: 'text-blue-300',
};

export default function WeatherChatPage() {
  const [isClient, setIsClient] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize useChat with proper configuration
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    reload
  } = useChat<WeatherMessage>({
    api: '/api/chat',
    initialMessages: [
      {
        id: '1',
        role: 'assistant' as const,
        content: "Hi! I'm your weather assistant. Ask me about the weather in any city and I'll give you current conditions and helpful advice. For example, try asking 'What's the weather like in San Francisco?'",
        createdAt: new Date(),
      }
    ],
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Ensure client-side rendering for hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Auto-scroll to bottom of messages
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
    if (invocation.toolName !== 'weather') return null;

    const WeatherIcon = weatherIcons[invocation.result?.condition as keyof typeof weatherIcons] || Cloud;
    const iconColor = weatherColors[invocation.result?.condition as keyof typeof weatherColors] || 'text-gray-500';

    if (invocation.state === 'call') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking weather for {invocation.args.city}...</span>
        </div>
      );
    }

    if (invocation.state === 'result' && invocation.result) {
      const { city, temperature, condition, humidity, windSpeed, description } = invocation.result;

      return (
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <WeatherIcon className={`w-6 h-6 ${iconColor}`} />
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">{city}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {temperature}°F
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-muted-foreground">Humidity</p>
                <p className="font-medium">{humidity}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-muted-foreground">Wind</p>
                <p className="font-medium">{windSpeed} mph</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-muted-foreground">UV Index</p>
                <p className="font-medium">{invocation.result.uvIndex || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {new Date(invocation.result.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </Card>
      );
    }

    return null;
  };

  const renderMessage = (message: WeatherMessage) => {
    const isUser = message.role === 'user';

    return (
      <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
        )}

        <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
          <div className={`rounded-lg p-4 ${
            isUser
              ? 'bg-blue-600 text-white ml-auto'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          }`}>
            <div className="whitespace-pre-wrap text-sm">{message.content}</div>

            {/* Render tool invocations for assistant messages */}
            {message.toolInvocations?.map((invocation, index) => (
              <div key={index} className="mt-3">
                {renderToolInvocation(invocation)}
              </div>
            ))}
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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                ← Back
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">Weather Assistant</h1>
                  <p className="text-sm text-muted-foreground">Ask about weather in any city</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          {/* Messages Area */}
          <ScrollArea className="h-[600px] p-4">
            <div className="space-y-4">
              {messages.map(renderMessage)}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error display */}
              {error && (
                <Card className="p-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Connection Error</span>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {error.message || 'Failed to get response. Please try again.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reload()}
                    className="mt-2 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Try Again
                  </Button>
                </Card>
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
                placeholder="Ask about the weather... (e.g., 'What's the weather in Tokyo?')"
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

            {/* Example prompts */}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("What's the weather like in San Francisco?")}
                disabled={isLoading}
                className="text-xs"
              >
                San Francisco
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("How's the weather in New York today?")}
                disabled={isLoading}
                className="text-xs"
              >
                New York
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("What should I wear in London?")}
                disabled={isLoading}
                className="text-xs"
              >
                London weather advice
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("Is it raining in Seattle?")}
                disabled={isLoading}
                className="text-xs"
              >
                Seattle rain check
              </Button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <Card className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-1">
                AI-Powered Weather Assistant
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                This demo uses Vercel AI SDK 6 with ToolLoopAgent to provide weather information.
                The agent uses tool calling to fetch weather data and provides conversational responses.
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
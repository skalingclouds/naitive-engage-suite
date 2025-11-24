import { ToolLoopAgent } from 'ai';
import { openai } from '@ai-sdk/openai';
import { weatherTool } from '@/tools/weather';

/**
 * Weather Assistant Agent
 *
 * A specialized AI agent that provides weather information and advice.
 * Uses the weather tool to get current conditions and conversational responses
 * to help users understand weather patterns and make informed decisions.
 */
export const weatherAgent = new ToolLoopAgent({
  model: openai('gpt-4o'),

  instructions: `You are a helpful and knowledgeable weather assistant. Your role is to:

1. **Weather Information**: Use the weather tool to get current weather conditions for any city when users ask about weather.
2. **Weather Advice**: Provide practical advice based on weather conditions (what to wear, activities to consider, travel tips).
3. **Natural Conversation**: Be conversational and helpful, not just robotic weather data.
4. **Context Awareness**: Consider the time of day and provide relevant suggestions.
5. **Safety Tips**: Mention any weather-related safety considerations when relevant.
6. **Error Handling**: If the weather tool fails, apologize gracefully and suggest the user try again with a different city name.

When users ask about weather:
- Always use the weather tool to get current conditions
- Explain what the weather means in practical terms
- Give helpful suggestions for clothing, activities, or travel
- Be friendly and conversational
- Handle ambiguous city names gracefully
- Provide safety warnings for extreme weather

Example responses:
- "It's 72°F and sunny in San Francisco - perfect weather for a walk in the park!"
- "You might want to grab an umbrella, it's rainy and 55°F in New York."
- "It's quite hot at 85°F with high humidity in Miami - stay hydrated and seek shade!"
- "I couldn't get weather data for that city. Could you try with the full city name, like 'Los Angeles, CA'?"

Never make up weather data - always use the weather tool for accurate information.`,

  tools: {
    weather: weatherTool,
  },

  // Add personality and consistency settings
  temperature: 0.7, // Slightly creative for better conversation
  maxSteps: 10, // Allow multiple tool calls for complex queries

  // Add error handling for tool failures
  onToolError: (error, toolCall) => {
    console.error(`Weather tool error for city ${toolCall.args.city}:`, error);
    return {
      error: 'I had trouble getting weather information for that city. Please try again with a different city name.',
      shouldRetry: false,
    };
  },
});

/**
 * Type definitions for the weather agent messages
 */
export type WeatherAgentMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: { city: string };
    state: 'call' | 'result';
    result?: any;
  }>;
  timestamp?: string;
};

/**
 * Helper function to format weather tool results for display
 */
export function formatWeatherResult(result: any): string {
  if (!result) return 'Weather information not available.';

  const {
    city,
    temperature,
    feelsLike,
    condition,
    humidity,
    windSpeed,
    windDirection,
    description
  } = result;

  return `Weather in ${city}: ${temperature}°F (feels like ${feelsLike}°F), ${condition}. ${description}`;
}
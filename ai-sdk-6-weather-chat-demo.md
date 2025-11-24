# AI SDK 6 Weather Chat Demo

A comprehensive implementation of Vercel AI SDK 6 with ToolLoopAgent for building intelligent, conversational weather assistant using Next.js and TypeScript.

## 🚀 Features

### Core AI SDK 6 Features
- **ToolLoopAgent Abstraction**: Agent-based architecture with automatic tool calling
- **Streaming Responses**: Real-time streaming of agent responses
- **Tool Execution Approval**: Ready for approval workflows (can be extended)
- **Structured Output**: Type-safe weather data with Zod validation
- **Error Handling**: Graceful error handling and retry mechanisms

### Weather Assistant Features
- **Realistic Weather Data**: Simulated weather conditions with consistency
- **Conversational Interface**: Natural language understanding and responses
- **Visual Weather Display**: Rich UI components for weather information
- **Multi-city Support**: Query weather for any city worldwide
- **Practical Advice**: Clothing recommendations and activity suggestions

## 📁 Project Structure

```
app/
├── agents/
│   └── weather-agent.ts          # Weather assistant agent with ToolLoopAgent
├── api/
│   └── chat/
│       └── route.ts              # API endpoint with streaming support
├── tools/
│   └── weather.ts                # Weather tool with Zod schema validation
├── weather-chat/
│   └── page.tsx                  # Interactive chat UI component
└── page.tsx                      # Main page with demo link
```

## 🛠️ Implementation Details

### 1. Weather Tool (`app/tools/weather.ts`)

```typescript
export const weatherTool = tool({
  description: 'Get the current weather in a location',
  inputSchema: z.object({
    city: z.string().describe('The city name to get weather for'),
  }),
  execute: async ({ city }) => {
    // Returns realistic weather data including:
    // - Temperature, humidity, wind speed
    // - Weather conditions, visibility
    // - UV index, pressure, dew point
    // - Human-readable descriptions
  },
});
```

**Key Features:**
- Consistent weather data generation based on city name hash
- Comprehensive weather metrics
- Human-readable descriptions
- Type-safe return values

### 2. Weather Agent (`app/agents/weather-agent.ts`)

```typescript
export const weatherAgent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  instructions: 'You are a helpful weather assistant...',
  tools: { weather: weatherTool },
  temperature: 0.7,
  maxSteps: 10,
  onToolError: (error, toolCall) => { /* error handling */ },
});
```

**Key Features:**
- Detailed instructions for conversational responses
- Error handling with graceful degradation
- Configurable temperature for creativity
- Automatic tool calling

### 3. API Route (`app/api/chat/route.ts`)

```typescript
export async function POST(request: NextRequest) {
  const response = await createAgentUIStreamResponse({
    agent: weatherAgent,
    messages: validatedMessages,
    options: agentOptions,
  });
  return response;
}
```

**Key Features:**
- Request validation with Zod schemas
- Streaming responses
- CORS support
- Comprehensive error handling
- Rate limiting detection
- Health check endpoint

### 4. Chat UI (`app/weather-chat/page.tsx`)

```typescript
const { messages, input, setInput, handleSubmit, isLoading, error } = useChat<WeatherMessage>({
  api: '/api/chat',
  initialMessages: [/* welcome message */],
});
```

**Key Features:**
- TypeScript inference from agent types
- Real-time streaming display
- Rich weather visualization
- Error handling and retry
- Responsive design
- Example prompts

## 🎯 AI SDK 6 Concepts Demonstrated

### Agent Abstraction
- **Before (AI SDK 5)**: Manual loop management with `generateText()`
- **After (AI SDK 6)**: `new ToolLoopAgent()` with automatic orchestration

### Tool Integration
- **Tool Definition**: Zod schema validation and execution
- **Automatic Calling**: Agent decides when to use tools
- **Type Safety**: End-to-end TypeScript support

### Streaming Support
- **createAgentUIStreamResponse**: Server-side streaming
- **useChat Hook**: Client-side streaming UI
- **Tool Invocation Display**: Real-time tool execution feedback

### Error Handling
- **Tool Errors**: Graceful degradation with user feedback
- **API Errors**: Comprehensive error categorization
- **Retry Mechanism**: Automatic and manual retry options

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
npm install ai@beta @ai-sdk/openai@beta @ai-sdk/react@beta zod
```

### 2. Environment Variables

Create a `.env.local` file with:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Access the Demo

- Main application: http://localhost:3000
- Weather chat demo: http://localhost:3000/weather-chat

## 🌟 Usage Examples

### Basic Weather Queries
- "What's the weather like in San Francisco?"
- "Is it raining in New York?"
- "How hot is it in Miami?"

### Weather Advice
- "What should I wear in London today?"
- "Is it good weather for a picnic in Tokyo?"
- "Should I bring an umbrella in Seattle?"

### Multiple Cities
- "Compare the weather in Paris and Berlin"
- "Which city is warmer: Los Angeles or San Diego?"

## 🎨 UI Features

### Weather Display Cards
- **Temperature**: Large, readable display
- **Conditions**: Weather icons and descriptions
- **Metrics**: Humidity, wind speed, UV index
- **Timestamps**: Real-time update indicators

### Chat Interface
- **Message History**: Persistent conversation
- **Tool Status**: Live tool invocation updates
- **Error States**: Clear error messaging with retry
- **Example Prompts**: Quick-start suggestions

### Responsive Design
- **Mobile Optimized**: Touch-friendly interface
- **Dark Mode**: Automatic theme detection
- **Accessibility**: Screen reader support
- **Keyboard Navigation**: Full keyboard access

## 🔍 Code Quality

### TypeScript Integration
- **Type Inference**: `InferAgentUIMessage<typeof weatherAgent>`
- **Schema Validation**: Zod schemas for all inputs
- **Error Types**: Comprehensive error handling
- **Component Props**: Fully typed React components

### Best Practices
- **Error Boundaries**: Graceful error recovery
- **Loading States**: User feedback during operations
- **Accessibility**: ARIA labels and keyboard support
- **Performance**: Optimized re-renders and lazy loading

## 🚀 Production Considerations

### Scaling
- **Rate Limiting**: OpenAI API quota management
- **Caching**: Weather data caching strategies
- **Monitoring**: Error tracking and performance metrics
- **Load Balancing**: Multiple instance support

### Security
- **API Keys**: Secure environment variable handling
- **Input Validation**: Comprehensive request validation
- **CORS**: Proper cross-origin configuration
- **Rate Limiting**: Client-side request throttling

### Monitoring
- **Health Checks**: API endpoint monitoring
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time tracking
- **Usage Analytics**: Feature usage monitoring

## 📚 Additional Resources

### Vercel AI SDK Documentation
- [AI SDK 6 Beta](https://sdk.vercel.ai/)
- [ToolLoopAgent Guide](https://sdk.vercel.ai/docs/ai-sdk-ui/tools)
- [Streaming Responses](https://sdk.vercel.ai/docs/ai-sdk-ui/streaming)

### Related Technologies
- [Next.js App Router](https://nextjs.org/docs/app)
- [Zod Validation](https://zod.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)

## 🤝 Contributing

This demo is part of the Complete AI SDK 6 & Multi-Agent Development Guide. Contributions and improvements are welcome!

## 📄 License

This project is provided as educational material for AI SDK 6 development.
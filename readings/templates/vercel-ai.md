# Vercel AI SDK

## Instance Facts

### Packages

JS Package 'ai' has Version '^4.0.0'.
JS Package 'ai' has Description 'Vercel AI SDK core: generateText, streamText, generateObject, streamObject, tool, embed, embedMany. Provider-agnostic surface that consumes Model objects from any @ai-sdk/* provider package.'.
JS Package 'ai' has Package Manager 'npm'.

JS Package '@ai-sdk/openai' has Version '^1.0.0'.
JS Package '@ai-sdk/openai' has Description 'OpenAI provider for Vercel AI SDK. Exports openai() Model factory and openai.responses() / openai.chat() variants.'.
JS Package '@ai-sdk/openai' has Package Manager 'npm'.

JS Package '@ai-sdk/anthropic' has Version '^1.0.0'.
JS Package '@ai-sdk/anthropic' has Description 'Anthropic provider for Vercel AI SDK. Exports anthropic() Model factory.'.
JS Package '@ai-sdk/anthropic' has Package Manager 'npm'.

JS Package '@ai-sdk/google' has Version '^1.0.0'.
JS Package '@ai-sdk/google' has Description 'Google Generative AI provider for Vercel AI SDK. Exports google() Model factory.'.
JS Package '@ai-sdk/google' has Package Manager 'npm'.

JS Package '@ai-sdk/xai' has Version '^1.0.0'.
JS Package '@ai-sdk/xai' has Description 'xAI provider for Vercel AI SDK. Exports xai() Model factory for Grok models.'.
JS Package '@ai-sdk/xai' has Package Manager 'npm'.

### Core call surface

Predicate 'generateText' is exported from JS Package 'ai'.
Predicate 'generateText' has Module Path 'ai'.
Predicate 'generateText' has Symbol Name 'generateText'.
Predicate 'generateText' has Name 'generateText'.
Predicate 'generateText' has Description 'Generate text and tool calls non-streaming. Takes {model, messages | prompt, tools, system, maxTokens, temperature, ...}; returns {text, toolCalls, toolResults, finishReason, usage, ...}.'.

Predicate 'streamText' is exported from JS Package 'ai'.
Predicate 'streamText' has Module Path 'ai'.
Predicate 'streamText' has Symbol Name 'streamText'.
Predicate 'streamText' has Name 'streamText'.
Predicate 'streamText' has Description 'Generate text and tool calls streaming. Takes {model, messages | prompt, tools, ...}; returns StreamTextResult with textStream / fullStream async iterators plus toDataStreamResponse() / toAIStream() converters.'.

Predicate 'generateObject' is exported from JS Package 'ai'.
Predicate 'generateObject' has Module Path 'ai'.
Predicate 'generateObject' has Symbol Name 'generateObject'.
Predicate 'generateObject' has Name 'generateObject'.
Predicate 'generateObject' has Description 'Generate a typed object matching a schema. Takes {model, schema, messages | prompt, mode, ...}; returns {object, finishReason, usage, ...}. Schema is a Zod / valibot / JSON Schema definition.'.

Predicate 'streamObject' is exported from JS Package 'ai'.
Predicate 'streamObject' has Module Path 'ai'.
Predicate 'streamObject' has Symbol Name 'streamObject'.
Predicate 'streamObject' has Name 'streamObject'.
Predicate 'streamObject' has Description 'Stream a typed object matching a schema. Takes {model, schema, messages | prompt, ...}; returns StreamObjectResult with partialObjectStream async iterator.'.

Predicate 'embed' is exported from JS Package 'ai'.
Predicate 'embed' has Module Path 'ai'.
Predicate 'embed' has Symbol Name 'embed'.
Predicate 'embed' has Name 'embed'.
Predicate 'embed' has Description 'Generate an embedding vector for a single value. Takes {model, value}; returns {embedding, usage, ...}.'.

Predicate 'embedMany' is exported from JS Package 'ai'.
Predicate 'embedMany' has Module Path 'ai'.
Predicate 'embedMany' has Symbol Name 'embedMany'.
Predicate 'embedMany' has Name 'embedMany'.
Predicate 'embedMany' has Description 'Generate embedding vectors for many values in one call. Takes {model, values}; returns {embeddings, usage, ...}.'.

Predicate 'tool' is exported from JS Package 'ai'.
Predicate 'tool' has Module Path 'ai'.
Predicate 'tool' has Symbol Name 'tool'.
Predicate 'tool' has Name 'tool'.
Predicate 'tool' has Description 'Define a tool with description, parameters schema, and execute function. Returned ToolDefinition is passed in the tools map of generateText / streamText. The model calls the tool via Tool Call (templates/agent-chat.md).'.

Predicate 'jsonSchema' is exported from JS Package 'ai'.
Predicate 'jsonSchema' has Module Path 'ai'.
Predicate 'jsonSchema' has Symbol Name 'jsonSchema'.
Predicate 'jsonSchema' has Name 'jsonSchema'.
Predicate 'jsonSchema' has Description 'Wrap a raw JSON Schema for use with generateObject / streamObject when not using Zod.'.

### Provider model factories

Predicate 'openai' is exported from JS Package '@ai-sdk/openai'.
Predicate 'openai' has Module Path '@ai-sdk/openai'.
Predicate 'openai' has Symbol Name 'openai'.
Predicate 'openai' has Name 'openai'.
Predicate 'openai' has Description 'Construct an OpenAI Model. openai("gpt-4o") returns a Model. openai.responses("gpt-4o") opts into the Responses API.'.

Predicate 'anthropic' is exported from JS Package '@ai-sdk/anthropic'.
Predicate 'anthropic' has Module Path '@ai-sdk/anthropic'.
Predicate 'anthropic' has Symbol Name 'anthropic'.
Predicate 'anthropic' has Name 'anthropic'.
Predicate 'anthropic' has Description 'Construct an Anthropic Model. anthropic("claude-opus-4-7") returns a Model.'.

Predicate 'google' is exported from JS Package '@ai-sdk/google'.
Predicate 'google' has Module Path '@ai-sdk/google'.
Predicate 'google' has Symbol Name 'google'.
Predicate 'google' has Name 'google'.
Predicate 'google' has Description 'Construct a Google Generative AI Model. google("gemini-1.5-pro") returns a Model.'.

Predicate 'xai' is exported from JS Package '@ai-sdk/xai'.
Predicate 'xai' has Module Path '@ai-sdk/xai'.
Predicate 'xai' has Symbol Name 'xai'.
Predicate 'xai' has Name 'xai'.
Predicate 'xai' has Description 'Construct an xAI Model. xai("grok-2") returns a Model.'.

### Stream-to-Response helpers

Predicate 'streamToResponse' is exported from JS Package 'ai'.
Predicate 'streamToResponse' has Module Path 'ai'.
Predicate 'streamToResponse' has Symbol Name 'streamToResponse'.
Predicate 'streamToResponse' has Name 'streamToResponse'.
Predicate 'streamToResponse' has Description 'Convert a StreamTextResult into a Response that the client useChat hook can consume. Wires the SSE protocol the hook expects.'.

Domain 'vercel-ai' has Access 'public'.
Domain 'vercel-ai' has Description 'Vercel AI SDK (npm: ai) core surface plus @ai-sdk/* provider model factories.'.

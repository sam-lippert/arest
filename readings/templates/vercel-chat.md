# Vercel AI SDK Chat UI

## Instance Facts

### Packages

JS Package '@ai-sdk/react' has Version '^1.0.0'.
JS Package '@ai-sdk/react' has Description 'Vercel AI SDK React UI bindings. Hooks (useChat, useCompletion, useObject) for managed chat, completion, and structured-object UI state.'.
JS Package '@ai-sdk/react' has Package Manager 'npm'.

JS Package '@ai-sdk/vue' has Version '^1.0.0'.
JS Package '@ai-sdk/vue' has Description 'Vercel AI SDK Vue UI bindings. useChat / useCompletion equivalents for Vue 3.'.
JS Package '@ai-sdk/vue' has Package Manager 'npm'.

JS Package '@ai-sdk/svelte' has Version '^1.0.0'.
JS Package '@ai-sdk/svelte' has Description 'Vercel AI SDK Svelte UI bindings. useChat / useCompletion equivalents for Svelte 5.'.
JS Package '@ai-sdk/svelte' has Package Manager 'npm'.

JS Package 'ai-elements' has Version '^0.1.0'.
JS Package 'ai-elements' has Description 'Pre-built React chat UI primitives layered on @ai-sdk/react: Conversation, Message, PromptInput, Response, Reasoning. Composable shadcn-style components.'.
JS Package 'ai-elements' has Package Manager 'npm'.

### React hooks

Predicate 'useChat' is exported from JS Package '@ai-sdk/react'.
Predicate 'useChat' has Module Path '@ai-sdk/react'.
Predicate 'useChat' has Symbol Name 'useChat'.
Predicate 'useChat' has Description 'React hook for managed multi-turn chat state. Takes {api, id, initialMessages, body, headers, onFinish, onError, ...}; returns {messages, input, handleInputChange, handleSubmit, append, reload, stop, isLoading, error, setMessages, setInput, data}. Consumes the AI SDK Data Stream protocol over SSE.'.

Predicate 'useCompletion' is exported from JS Package '@ai-sdk/react'.
Predicate 'useCompletion' has Module Path '@ai-sdk/react'.
Predicate 'useCompletion' has Symbol Name 'useCompletion'.
Predicate 'useCompletion' has Description 'React hook for single-turn text completion. Takes {api, id, initialInput, body, headers, onFinish, onError, ...}; returns {completion, input, handleInputChange, handleSubmit, complete, stop, isLoading, error, setCompletion, setInput}.'.

Predicate 'useObject' is exported from JS Package '@ai-sdk/react'.
Predicate 'useObject' has Module Path '@ai-sdk/react'.
Predicate 'useObject' has Symbol Name 'experimental_useObject'.
Predicate 'useObject' has Description 'React hook for streaming a typed object matching a schema. Takes {api, schema, id, headers, ...}; returns {object, submit, isLoading, error, stop}. Pairs with server-side streamObject.'.

Predicate 'useAssistant' is exported from JS Package '@ai-sdk/react'.
Predicate 'useAssistant' has Module Path '@ai-sdk/react'.
Predicate 'useAssistant' has Symbol Name 'useAssistant'.
Predicate 'useAssistant' has Description 'React hook for OpenAI Assistants API integration. Takes {api, threadId, ...}; returns {messages, input, status, threadId, append, submitMessage, ...}.'.

### AI Elements components

Predicate 'Conversation' is exported from JS Package 'ai-elements'.
Predicate 'Conversation' has Module Path 'ai-elements/conversation'.
Predicate 'Conversation' has Symbol Name 'Conversation'.
Predicate 'Conversation' has Description 'Scrollable container for chat messages. Wraps the messages array from useChat and provides auto-scroll, sticky bottom, and overflow handling.'.

Predicate 'Message' is exported from JS Package 'ai-elements'.
Predicate 'Message' has Module Path 'ai-elements/message'.
Predicate 'Message' has Symbol Name 'Message'.
Predicate 'Message' has Description 'Per-message bubble rendering a single chat turn. Takes {from: "user" | "assistant"} and content; styles user vs assistant variants.'.

Predicate 'PromptInput' is exported from JS Package 'ai-elements'.
Predicate 'PromptInput' has Module Path 'ai-elements/prompt-input'.
Predicate 'PromptInput' has Symbol Name 'PromptInput'.
Predicate 'PromptInput' has Description 'Composable input form for chat. Wraps useChat.handleSubmit + handleInputChange with submit-on-Enter behavior, attachment slots, and stop button.'.

Predicate 'Response' is exported from JS Package 'ai-elements'.
Predicate 'Response' has Module Path 'ai-elements/response'.
Predicate 'Response' has Symbol Name 'Response'.
Predicate 'Response' has Description 'Markdown renderer for streaming assistant text. Handles partial streaming gracefully and applies syntax highlighting to code blocks.'.

Predicate 'Reasoning' is exported from JS Package 'ai-elements'.
Predicate 'Reasoning' has Module Path 'ai-elements/reasoning'.
Predicate 'Reasoning' has Symbol Name 'Reasoning'.
Predicate 'Reasoning' has Description 'Collapsible disclosure for thinking-mode model output. Renders the reasoning channel from streamText results without dominating the visible chat.'.

### Server-side handlers (paired with hooks)

Predicate 'toDataStreamResponse' is exported from JS Package 'ai'.
Predicate 'toDataStreamResponse' has Module Path 'ai'.
Predicate 'toDataStreamResponse' has Symbol Name 'toDataStreamResponse'.
Predicate 'toDataStreamResponse' has Description 'Method on StreamTextResult that emits the AI SDK Data Stream protocol. The Response returned by this method is what useChat / useObject expect from the {api} URL.'.

Predicate 'toAIStreamResponse' is exported from JS Package 'ai'.
Predicate 'toAIStreamResponse' has Module Path 'ai'.
Predicate 'toAIStreamResponse' has Symbol Name 'toAIStreamResponse'.
Predicate 'toAIStreamResponse' has Description 'Legacy converter for older streaming clients. Prefer toDataStreamResponse for new code.'.

Domain 'vercel-chat' has Access 'public'.
Domain 'vercel-chat' has Description 'Vercel AI SDK React UI surface (@ai-sdk/react) plus AI Elements components.'.

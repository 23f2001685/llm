const fetch = require('node-fetch');

// Load API keys from environment
const AI_PIPE_KEY = process.env.AI_PIPE_KEY;
const AI_PROXY_KEY = process.env.AI_PROXY_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "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";

// NVIDIA Model Configuration
const NVIDIA_MODELS = {
  'llama-4-maverick': 'meta/llama-4-maverick-17b-128e-instruct',
  'llama-4-scout': 'meta/llama-4-scout-17b-16e-instruct',
  'deepseek-r1': 'deepseek-ai/deepseek-r1',
  'llama-3.3': 'meta/llama-3.3-70b-instruct',
  'qwen-coder': 'qwen/qwen2.5-coder-32b-instruct'
};

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { messages, provider = 'nvidia', model = 'deepseek-r1' } = req.body;

    // Conversation history management - keep last 20 messages to prevent payload issues
    let managedMessages = messages || [];
    if (managedMessages.length > 20) {
      // Keep system message (if any) + last 19 messages
      const systemMessages = managedMessages.filter(msg => msg.role === 'system');
      const recentMessages = managedMessages.slice(-19);
      managedMessages = [...systemMessages, ...recentMessages];
      console.log(`📝 Conversation truncated: ${messages.length} → ${managedMessages.length} messages`);
    }

    // Add system message to control tool usage
    const systemMessage = {
      role: "system",
      content: "You are a helpful assistant that MUST follow the OpenAI tool calling format exactly. CRITICAL RULES:\n\n1. NEVER include raw JSON in your text responses\n2. NEVER write {\"type\": \"function\"...} or {\"name\": \"...\"} in your messages\n3. When you want to use a tool, use the proper tool_calls mechanism - the system will handle this automatically\n4. Your text responses should only contain natural language, never JSON\n5. If you need to execute code, search, or process data, the system will automatically generate the proper tool calls\n\nEXAMPLES OF CORRECT BEHAVIOR:\n- User: 'code a calculator' → You: 'I'll create a calculator for you.' (system handles tool call)\n- User: 'search for news' → You: 'Let me search for recent news.' (system handles tool call)\n- User: 'what is 2+2' → You: 'The answer is 4.' (no tool needed)\n\nNEVER output tool call JSON in your responses. Let the system handle tool calling automatically."
    };

    // Add system message if not already present
    if (!managedMessages.some(msg => msg.role === 'system')) {
      managedMessages.unshift(systemMessage);
    }

    // OpenAI-style tool definitions
    const tools = [
      {
        type: "function",
        function: {
          name: "search_google",
          description: "Search Google for information and return snippets",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "execute_javascript",
          description: "Execute JavaScript code safely in a browser sandbox. ONLY supports JavaScript/ECMAScript - no Python, Java, C++, or other languages. Use for calculations, data processing, algorithms, and web APIs available in browsers.",
          parameters: {
            type: "object",
            properties: {
              code: { type: "string", description: "Valid JavaScript code to execute (no Python/other languages)" }
            },
            required: ["code"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "process_with_aipipe",
          description: "Process data through AI Pipe workflow",
          parameters: {
            type: "object",
            properties: {
              input: { type: "string", description: "Input data" },
              workflow: { type: "string", description: "Workflow type", default: "default" }
            },
            required: ["input"]
          }
        }
      }
    ];

    let response;
    let apiUsed = provider;

    // Try NVIDIA API first (best performance)
    if (provider === 'nvidia' || provider === 'aipipe' || provider === 'aiproxy') {
      try {
        const modelPath = NVIDIA_MODELS[model] || NVIDIA_MODELS['deepseek-r1'];
        console.log(`🚀 Using NVIDIA model: ${modelPath}`);

        response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelPath,
            messages: managedMessages,
            tools: tools,
            tool_choice: "auto",
            max_tokens: 2048,
            temperature: 0.3, // Lower temperature for more consistent formatting
            stream: false,
            // Force proper tool calling format
            response_format: { type: "text" }
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ NVIDIA API success with ${modelPath}`);
          res.json(data);
          return;
        }

        console.log(`⚠️ NVIDIA API failed, trying fallback...`);
      } catch (nvidiaError) {
        console.log(`⚠️ NVIDIA API error: ${nvidiaError.message}`);
      }
    }

    // Fallback to AI Pipe/Proxy APIs
    const apiUrl = provider === 'aiproxy'
      ? 'https://aiproxy.manishiitg.me/llm/v1/chat/completions'
      : 'https://aipipe.manishiitg.me/llm/v1/chat/completions';

    const apiKey = provider === 'aiproxy' ? AI_PROXY_KEY : AI_PIPE_KEY;
    apiUsed = provider === 'aiproxy' ? 'aiproxy' : 'aipipe';

    console.log(`🤖 Fallback to ${apiUsed} API`);

    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: managedMessages,
        tools: tools,
        tool_choice: "auto",
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      throw new Error(`${apiUsed} API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ ${apiUsed} API success`);
    res.json(data);

  } catch (error) {
    console.error('LLM API Error:', error.message);

    // Smart fallback - analyze user input for tool calls
    const { messages } = req.body;
    const fallbackMessages = messages || [];
    const lastMessage = fallbackMessages.length > 0 ? fallbackMessages[fallbackMessages.length - 1] : null;
    const userInput = lastMessage?.content?.toLowerCase() || '';

    console.log(`🔄 Generating smart fallback for: "${userInput.slice(0, 50)}..."`);

    let fallbackResponse = {
      choices: [{
        message: {
          role: "assistant",
          content: "I apologize, but I'm experiencing technical difficulties with the LLM APIs. Let me try to help you with the available tools based on your request.",
          tool_calls: []
        }
      }]
    };

    // Smart detection for tool calls
    if (userInput.includes('search') || userInput.includes('google') || userInput.includes('find') || userInput.includes('lookup')) {
      const searchQuery = userInput.replace(/(search|google|find|lookup)\s+(for\s+)?/gi, '').trim();
      console.log(`🔍 Smart fallback: Triggering search for "${searchQuery}"`);

      fallbackResponse.choices[0].message.tool_calls = [{
        id: "smart_search_" + Date.now(),
        type: "function",
        function: {
          name: "search_google",
          arguments: JSON.stringify({ query: searchQuery || userInput })
        }
      }];
    } else if (userInput.includes('calculate') || userInput.includes('code') || userInput.includes('javascript') || userInput.includes('run')) {
      console.log(`💻 Smart fallback: Triggering code execution`);

      fallbackResponse.choices[0].message.tool_calls = [{
        id: "smart_code_" + Date.now(),
        type: "function",
        function: {
          name: "execute_javascript",
          arguments: JSON.stringify({ code: "console.log('Smart fallback: Ready to execute code');" })
        }
      }];
    } else if (userInput.includes('process') || userInput.includes('analyze') || userInput.includes('workflow')) {
      console.log(`🔧 Smart fallback: Triggering AI Pipe processing`);

      fallbackResponse.choices[0].message.tool_calls = [{
        id: "smart_process_" + Date.now(),
        type: "function",
        function: {
          name: "process_with_aipipe",
          arguments: JSON.stringify({ input: userInput, workflow: "default" })
        }
      }];
    }

    res.json(fallbackResponse);
  }
};

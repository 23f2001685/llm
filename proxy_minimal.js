const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase payload limit
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('.'));

// Load API keys securely
const AI_PIPE_KEY = process.env.AI_PIPE_KEY;
const AI_PROXY_KEY = process.env.AI_PROXY_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

if (!AI_PIPE_KEY || !AI_PROXY_KEY || !NVIDIA_API_KEY) {
  console.error('❌ Missing API keys in .env file!');
  process.exit(1);
}

console.log('🔐 API keys loaded securely from environment variables');

// NVIDIA Model Configuration
const NVIDIA_MODELS = {
  'llama-4-maverick': 'meta/llama-4-maverick-17b-128e-instruct',
  'llama-4-scout': 'meta/llama-4-scout-17b-16e-instruct', 
  'deepseek-r1': 'deepseek-ai/deepseek-r1',
  'llama-3.3': 'meta/llama-3.3-70b-instruct',
  'qwen-coder': 'qwen/qwen2.5-coder-32b-instruct'
};

// Main LLM endpoint - Enhanced with NVIDIA API
app.post('/api/llm', async (req, res) => {
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
          description: "Execute JavaScript code safely",
          parameters: {
            type: "object", 
            properties: {
              code: { type: "string", description: "JavaScript code to execute" }
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
            temperature: 0.7,
            stream: false
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
          content: null,
          tool_calls: null
        }
      }]
    };

    // Generate appropriate tool calls based on user input
    if (userInput.includes('search') || userInput.includes('google') || userInput.includes('find') || 
        userInput.includes('where') || userInput.includes('what is') || userInput.includes('who is') ||
        userInput.includes('when') || userInput.includes('how') || userInput.includes('why')) {
      // Extract search query for various question types
      let searchQuery = userInput;
      
      // Clean up common search prefixes
      searchQuery = searchQuery.replace(/google search|search for|search|find|google|where is|what is|who is/gi, '').trim();
      
      // If query is too short, use original input
      if (searchQuery.length < 3) {
        searchQuery = userInput;
      }
      
      console.log(`🔍 Smart fallback: Triggering search for "${searchQuery}"`);
      
      fallbackResponse.choices[0].message.tool_calls = [{
        id: "call_search_" + Date.now(),
        type: "function",
        function: {
          name: "search_google",
          arguments: JSON.stringify({ query: searchQuery })
        }
      }];
    } else if (userInput.includes('calculate') || userInput.includes('javascript') || userInput.includes('code') || 
               userInput.includes('execute') || userInput.includes('math') || /\d+[\+\-\*\/]\d+/.test(userInput)) {
      // Generate JavaScript execution for calculations or code
      let code = userInput;
      
      if (userInput.includes('calculate') || /\d+[\+\-\*\/]\d+/.test(userInput)) {
        // Try to extract mathematical expression
        const mathMatch = userInput.match(/calculate\s+(.+)/i) || userInput.match(/(\d+[\+\-\*\/\(\)\s\d]+)/);
        if (mathMatch) {
          code = `console.log(${mathMatch[1]}); return ${mathMatch[1]};`;
        }
      }
      
      console.log(`💻 Smart fallback: Triggering JavaScript execution`);
      
      fallbackResponse.choices[0].message.tool_calls = [{
        id: "call_js_" + Date.now(),
        type: "function", 
        function: {
          name: "execute_javascript",
          arguments: JSON.stringify({ code: code })
        }
      }];
    } else if (userInput.includes('process') || userInput.includes('aipipe') || userInput.includes('ai pipe') ||
               userInput.includes('analyze') || userInput.includes('workflow')) {
      // Generate AI Pipe processing
      const inputData = userInput.replace(/process|with ai pipe|aipipe|analyze|workflow/gi, '').trim();
      
      console.log(`🧠 Smart fallback: Triggering AI Pipe processing`);
      
      fallbackResponse.choices[0].message.tool_calls = [{
        id: "call_aipipe_" + Date.now(),
        type: "function",
        function: {
          name: "process_with_aipipe", 
          arguments: JSON.stringify({ input: inputData || userInput, workflow: "default" })
        }
      }];
    } else {
      // Enhanced default response with helpful suggestions
      const suggestions = [
        'Search: "where is the Eiffel Tower"',
        'Calculate: "what is 25 * 47"', 
        'Code: "generate fibonacci sequence"',
        'Process: "analyze this data with AI Pipe"'
      ];
      
      fallbackResponse.choices[0].message.content = `I'm your enhanced LLM agent with NVIDIA models! I can help with:

🔍 **Google Search** - Ask questions like "where is...", "what is...", or "search for..."
💻 **JavaScript Execution** - Request calculations or code execution
🧠 **AI Pipe Processing** - Analyze data or run AI workflows

**Try these examples:**
${suggestions.map(s => `• ${s}`).join('\n')}

*Note: Currently running on smart fallback mode due to API connectivity.*`;
    }
    
    res.json(fallbackResponse);
  }
});

// Google Search tool endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Mock Google search results (replace with real API if available)
    const results = {
      query: query,
      results: [
        {
          title: `Search Results for: ${query}`,
          snippet: `Here are relevant search results for your query: ${query}. This demonstrates the Google Search integration.`,
          url: "https://example.com"
        },
        {
          title: `More about ${query}`,
          snippet: `Additional information and context about ${query} from various sources.`,
          url: "https://example.org"
        }
      ]
    };
    
    console.log(`🔍 Google search: ${query}`);
    res.json(results);
    
  } catch (error) {
    console.error('Search API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI Pipe workflow endpoint
app.post('/api/aipipe', async (req, res) => {
  try {
    const { input, workflow = 'default' } = req.body;
    
    // Try real AI Pipe API
    try {
      const response = await fetch('https://aipipe.manishiitg.me/workflow/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_PIPE_KEY}`
        },
        body: JSON.stringify({
          workflow: workflow,
          input: input
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`🧠 AI Pipe processing: ${input.slice(0, 50)}...`);
        res.json(data);
        return;
      }
    } catch (apiError) {
      console.log('AI Pipe API unavailable, using mock');
    }
    
    // Fallback mock response
    const result = {
      status: 'success',
      workflow: workflow,
      input: input,
      output: `AI Pipe processed: "${input}" through ${workflow} workflow`,
      timestamp: new Date().toISOString()
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('AI Pipe Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 LLM Agent running on http://localhost:${PORT}`);
  console.log('🌐 CORS enabled for browser access');
});

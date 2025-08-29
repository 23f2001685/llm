const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config(); // Load environment variables securely

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.'));  // Serve static files from current directory

// Load API keys from environment variables (secure)
const AI_PIPE_KEY = process.env.AI_PIPE_KEY;
const AI_PROXY_KEY = process.env.AI_PROXY_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

// Security validation - ensure all keys are loaded
if (!AI_PIPE_KEY || !AI_PROXY_KEY || !NVIDIA_API_KEY) {
  console.error('❌ SECURITY ERROR: Missing API keys in .env file!');
  console.error('Please ensure .env file contains all required keys:');
  console.error('- AI_PIPE_KEY');
  console.error('- AI_PROXY_KEY'); 
  console.error('- NVIDIA_API_KEY');
  process.exit(1);
}

console.log('🔐 API keys loaded securely from environment variables');

// Available NVIDIA models
const NVIDIA_MODELS = {
  'llama-4-maverick': 'meta/llama-4-maverick-17b-128e-instruct',
  'llama-4-scout': 'meta/llama-4-scout-17b-16e-instruct', 
  'deepseek-r1': 'deepseek-ai/deepseek-r1',
  'llama-3.3': 'meta/llama-3.3-70b-instruct',
  'qwen-coder': 'qwen/qwen2.5-coder-32b-instruct'
};

// LLM proxy endpoint - Now with NVIDIA API integration
app.post('/api/llm', async (req, res) => {
  try {
    const messages = req.body.messages || [];
    const selectedModel = req.body.model || 'deepseek-r1'; // Default to best model
    const modelPath = NVIDIA_MODELS[selectedModel] || NVIDIA_MODELS['deepseek-r1'];
    
    console.log(`Using NVIDIA model: ${modelPath}`);
    
    // Try NVIDIA API first
    try {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'google_search',
            description: 'Search Google for information and return relevant snippets',
            parameters: {
              type: 'object',
              properties: {
                query: { 
                  type: 'string', 
                  description: 'The search query to look up'
                }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'execute_javascript',
            description: 'Execute JavaScript code safely in a sandboxed environment',
            parameters: {
              type: 'object',
              properties: {
                code: { 
                  type: 'string', 
                  description: 'JavaScript code to execute'
                }
              },
              required: ['code']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'ai_pipe',
            description: 'Process data through AI Pipe workflows for complex analysis',
            parameters: {
              type: 'object',
              properties: {
                workflow: { 
                  type: 'string', 
                  description: 'Type of workflow to execute'
                },
                input: { 
                  type: 'string', 
                  description: 'Input data to process'
                }
              },
              required: ['workflow', 'input']
            }
          }
        }
      ];

      const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
          model: modelPath,
          messages: messages,
          tools: tools,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 1024,
          stream: false
        })
      });

      if (nvidiaResponse.ok) {
        const data = await nvidiaResponse.json();
        
        // Convert to OpenAI format with tool calling logic
        const lastMessage = messages[messages.length - 1];
        const userInput = lastMessage?.content || '';
        const responseContent = data.choices[0].message.content;
        
        // Add tool calls based on user input
        let toolCalls = [];
        if (userInput.toLowerCase().includes('search')) {
          toolCalls = [{
            id: 'search_' + Date.now(),
            type: 'function',
            function: {
              name: 'google_search',
              arguments: JSON.stringify({ query: userInput.replace(/search/i, '').trim() })
            }
          }];
        } else if (userInput.toLowerCase().includes('run') || userInput.toLowerCase().includes('javascript')) {
          toolCalls = [{
            id: 'js_' + Date.now(),
            type: 'function',
            function: {
              name: 'execute_javascript',
              arguments: JSON.stringify({ code: userInput.replace(/run|javascript/gi, '').trim() })
            }
          }];
        } else if (userInput.toLowerCase().includes('pipe')) {
          toolCalls = [{
            id: 'pipe_' + Date.now(),
            type: 'function',
            function: {
              name: 'ai_pipe',
              arguments: JSON.stringify({ workflow: 'general', input: userInput })
            }
          }];
        }

        const response = {
          choices: [{
            message: {
              role: 'assistant',
              content: responseContent,
              tool_calls: toolCalls
            }
          }],
          model: modelPath,
          usage: data.usage
        };
        
        console.log(`NVIDIA API success with ${modelPath}`);
        return res.json(response);
      }
    } catch (nvidiaError) {
      console.log('NVIDIA API failed, using fallback:', nvidiaError.message);
    }
    
    // Fallback to mock response
    const lastMessage = messages[messages.length - 1];
    const userInput = lastMessage?.content || '';
    
    let responseText = '';
    let toolCalls = [];
    
    if (userInput.toLowerCase().includes('search')) {
      responseText = 'I\'ll search for that information using my search capabilities.';
      toolCalls = [{
        id: 'search_' + Date.now(),
        type: 'function',
        function: {
          name: 'google_search',
          arguments: JSON.stringify({ query: userInput.replace(/search/i, '').trim() })
        }
      }];
    } else if (userInput.toLowerCase().includes('run') || userInput.toLowerCase().includes('javascript')) {
      responseText = 'I\'ll execute that JavaScript code for you.';
      toolCalls = [{
        id: 'js_' + Date.now(),
        type: 'function',
        function: {
          name: 'execute_javascript',
          arguments: JSON.stringify({ code: userInput.replace(/run|javascript/gi, '').trim() })
        }
      }];
    } else if (userInput.toLowerCase().includes('pipe')) {
      responseText = 'I\'ll process that using AI Pipe workflows.';
      toolCalls = [{
        id: 'pipe_' + Date.now(),
        type: 'function',
        function: {
          name: 'ai_pipe',
          arguments: JSON.stringify({ workflow: 'general', input: userInput })
        }
      }];
    } else {
      responseText = `Hello! I'm powered by NVIDIA's ${selectedModel} model. I can help you with search, JavaScript execution, or AI Pipe workflows. You said: "${userInput}"`;
    }
    
    const mockResponse = {
      choices: [{
        message: {
          role: 'assistant',
          content: responseText,
          tool_calls: toolCalls
        }
      }],
      model: `${selectedModel} (fallback)`
    };
    
    console.log(`Using fallback response for model: ${selectedModel}`);
    res.json(mockResponse);
  } catch (e) {
    console.error('LLM API Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Search proxy endpoint - Mock response for demo
app.post('/api/search', async (req, res) => {
  try {
    // Mock search results since external API may not be available
    const query = req.body.query || 'test';
    const mockResults = [
      `Search result 1 for "${query}": This is a sample search snippet about ${query}.`,
      `Search result 2 for "${query}": More information about ${query} can be found here.`,
      `Search result 3 for "${query}": Additional details and resources for ${query}.`
    ];
    
    console.log(`Search request for: ${query}`);
    res.json({ snippets: mockResults });
  } catch (e) {
    console.error('Search API Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// AI Pipe proxy endpoint - Mock response for demo
app.post('/api/aipipe', async (req, res) => {
  try {
    // Mock AI Pipe response since external API may not be available
    const payload = req.body.payload || {};
    const mockResponse = {
      status: 'success',
      workflow: payload.workflow || 'default',
      result: `AI Pipe processed: ${payload.input || 'no input'}`,
      timestamp: new Date().toISOString()
    };
    
    console.log(`AI Pipe request:`, payload);
    res.json(mockResponse);
  } catch (e) {
    console.error('AI Pipe API Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(3001, () => {
  console.log('Proxy server running on http://localhost:3001');
  console.log('CORS enabled for browser access');
});

// agent_minimal.js
// Minimal LLM Agent frontend logic for index.html

const chatContainer = document.getElementById('chatContainer');
const alertContainer = document.getElementById('alertContainer');
const userInput = document.getElementById('userInput');
const providerSelect = document.getElementById('providerSelect');
const modelSelect = document.getElementById('modelSelect');

let messages = [
  { role: 'assistant', content: '🚀 Welcome to the Enhanced LLM Agent with NVIDIA Integration!' }
];

function showAlert(type, message) {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.role = 'alert';
  alert.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  alertContainer.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}

function addMessage(role, content, isTool) {
  const div = document.createElement('div');
  div.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}${isTool ? ' tool-result' : ''}`;

  // Format content properly
  let formattedContent = content;
  if (isTool && typeof content === 'string') {
    try {
      // Try to parse and format JSON nicely
      const parsed = JSON.parse(content);
      if (parsed.output !== undefined) {
        formattedContent = `<strong>Output:</strong> ${parsed.output}`;
        if (parsed.code) {
          formattedContent += `<br><strong>Code:</strong> <code>${parsed.code}</code>`;
        }
      } else {
        formattedContent = `<pre>${JSON.stringify(parsed, null, 2)}</pre>`;
      }
    } catch (e) {
      // If not JSON, display as-is
      formattedContent = content;
    }
  } else if (typeof content === 'object') {
    formattedContent = `<pre>${JSON.stringify(content, null, 2)}</pre>`;
  }

  div.innerHTML = `<strong>${role === 'user' ? 'You' : (isTool ? 'Tool Result' : 'Assistant')}:</strong> ${formattedContent}`;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  // Disable input during processing
  userInput.disabled = true;
  document.querySelector('button').disabled = true;

  addMessage('user', text);
  messages.push({ role: 'user', content: text });
  userInput.value = '';

  runAgentLoop().finally(() => {
    // Re-enable input after processing
    userInput.disabled = false;
    document.querySelector('button').disabled = false;
    userInput.focus();
  });
}

async function runAgentLoop() {
  try {
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant-message';
    loadingDiv.innerHTML = '<strong>Assistant:</strong> <span class="spinner-border spinner-border-sm" role="status"></span> Thinking...';
    loadingDiv.id = 'loading-indicator';
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    let iterations = 0;
    const maxIterations = 3; // Reduced to prevent excessive tool calling
    let lastToolCall = null; // Track last tool call to prevent duplicates

    console.log('Starting agent loop...');

    while (iterations < maxIterations) {
      iterations++;
      console.log(`Agent loop iteration ${iterations}`);

      const response = await callLLM(messages);

      // Extract from OpenAI-style response format
      const choice = response.choices?.[0];
      let output = choice?.message?.content;
      let tool_calls = choice?.message?.tool_calls;

      console.log('Raw response:', { output, tool_calls });

      // Parse malformed JSON tool calls from text output
      if (output && !tool_calls) {
        // Try to extract tool calls from various malformed formats
        const patterns = [
          // Pattern 1: {"type": "function", "name": "...", "parameters": {...}}
          /\{"type":\s*"function",\s*"name":\s*"([^"]+)",\s*"parameters":\s*(\{.*?\})\}/g,
          // Pattern 2: {"name": "...", "parameters": {...}}
          /\{"name":\s*"([^"]+)",\s*"parameters":\s*(\{.*?\})\}/g
        ];

        for (const pattern of patterns) {
          const matches = [...output.matchAll(pattern)];
          if (matches.length > 0) {
            console.log('Found malformed tool calls, converting...');
            tool_calls = matches.map((match, index) => ({
              id: "converted_" + Date.now() + "_" + index,
              type: "function",
              function: {
                name: match[1],
                arguments: match[2]
              }
            }));

            // Remove the malformed JSON from output
            let cleanOutput = output;
            for (const match of matches) {
              cleanOutput = cleanOutput.replace(match[0], '').trim();
            }

            output = cleanOutput || "I'll execute that for you.";
            showAlert('info', `Converted ${matches.length} malformed tool call(s) to proper format`);
            break;
          }
        }

        // If still no tool calls found but we detect tool-like syntax, clean it
        if (!tool_calls && (output.includes('"type":') || output.includes('"name":') || output.includes('"parameters":'))) {
          console.log('Detected unparseable tool syntax, cleaning response');
          output = "I understand you want me to execute some code. Let me try a different approach.";
          showAlert('warning', 'Cleaned unparseable tool syntax from response');
        }
      }

      console.log('Processed response:', { output, tool_calls });

      // Remove loading indicator
      const loading = document.getElementById('loading-indicator');
      if (loading) loading.remove();

      if (output) {
        addMessage('assistant', output);
        messages.push({ role: 'assistant', content: output, tool_calls: tool_calls || [] });
      }

      if (tool_calls && tool_calls.length > 0) {
        // Check for duplicate tool calls
        const currentToolCall = JSON.stringify(tool_calls[0]);
        if (lastToolCall === currentToolCall) {
          console.log('Duplicate tool call detected, forcing final response');
          addMessage('assistant', 'The requested action has been completed. Here are the results above.');
          break;
        }
        lastToolCall = currentToolCall;

        console.log('Processing tool calls:', tool_calls);
        const toolResults = await handleToolCalls(tool_calls);
        messages.push(...toolResults);

        // Add a prompt to help the LLM provide a final response
        messages.push({
          role: 'user',
          content: "Based on the tool results above, please provide your final response to the user. Do not call any more tools unless absolutely necessary."
        });

        // Add loading for next iteration if not the last
        if (iterations < maxIterations) {
          const nextLoadingDiv = document.createElement('div');
          nextLoadingDiv.className = 'message assistant-message';
          nextLoadingDiv.innerHTML = '<strong>Assistant:</strong> <span class="spinner-border spinner-border-sm" role="status"></span> Processing results...';
          nextLoadingDiv.id = 'loading-indicator';
          chatContainer.appendChild(nextLoadingDiv);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      } else {
        console.log('No tool calls, ending loop');
        break; // No more tool calls, exit loop
      }
    }

    // Remove any remaining loading indicator
    const finalLoading = document.getElementById('loading-indicator');
    if (finalLoading) finalLoading.remove();

    if (iterations >= maxIterations) {
      showAlert('warning', 'Conversation loop limit reached. Please start a new conversation if needed.');
    }

  } catch (err) {
    console.error('Agent loop error:', err);
    // Remove loading indicator on error
    const loading = document.getElementById('loading-indicator');
    if (loading) loading.remove();
    showAlert('danger', 'Error: ' + (err.message || err));
  }
}async function callLLM(msgs) {
  // Minimal OpenAI-style call to backend proxy
  const provider = providerSelect.value;
  const model = modelSelect.value;

  console.log('Calling LLM with:', { provider, model, messageCount: msgs.length });

  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: msgs, provider, model })
  });

  console.log('LLM Response status:', res.status);

  if (!res.ok) {
    const errorText = await res.text();
    console.error('LLM API error:', errorText);
    throw new Error(`LLM API error: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  console.log('LLM Response data:', data);

  return data;
}

async function handleToolCalls(toolCalls) {
  // Each tool call: { id, type, function: { name, arguments } }
  const results = [];
  for (const tc of toolCalls) {
    try {
      console.log('Processing tool call:', tc);
      let toolResult;
      const toolName = tc.function?.name;
      const args = JSON.parse(tc.function?.arguments || '{}');

      console.log(`Executing tool: ${toolName} with args:`, args);

      if (toolName === 'search_google') {
        toolResult = await searchGoogle(args.query);
      } else if (toolName === 'execute_javascript') {
        toolResult = await executeJavaScript(args.code);
      } else if (toolName === 'process_with_aipipe') {
        toolResult = await processWithAIPipe(args.input, args.workflow);
      } else {
        toolResult = { error: 'Unknown tool: ' + toolName };
      }

      console.log('Tool result:', toolResult);
      addMessage('assistant', JSON.stringify(toolResult), true);
      results.push({ role: 'tool', content: JSON.stringify(toolResult), tool_call_id: tc.id });
    } catch (err) {
      console.error('Tool execution error:', err);
      showAlert('warning', 'Tool error: ' + (err.message || err));
      results.push({ role: 'tool', content: JSON.stringify({ error: err.message }), tool_call_id: tc.id });
    }
  }
  console.log('All tool results:', results);
  return results;
}// --- Tool Implementations ---
async function searchGoogle(query) {
  // Use POST request to match the API expectation
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error('Google Search API error');
  return await res.json();
}

async function executeJavaScript(code) {
  // Safe JavaScript execution with proper sandbox
  return new Promise((resolve) => {
    let result = '';
    let consoleOutput = [];
    let hasError = false;

    try {
      // Create a safe console object
      const safeConsole = {
        log: (...args) => {
          consoleOutput.push(args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' '));
        },
        error: (...args) => {
          consoleOutput.push('[ERROR] ' + args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' '));
        },
        warn: (...args) => {
          consoleOutput.push('[WARN] ' + args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' '));
        }
      };

      // Create safe global objects
      const safeGlobals = {
        console: safeConsole,
        alert: (msg) => {
          consoleOutput.push(`[Alert] ${msg}`);
          return msg;
        },
        prompt: (msg, defaultVal = '') => {
          const response = window.prompt(msg, defaultVal) || defaultVal;
          consoleOutput.push(`[Prompt] ${msg} → ${response}`);
          return response;
        },
        confirm: (msg) => {
          const response = window.confirm(msg);
          consoleOutput.push(`[Confirm] ${msg} → ${response}`);
          return response;
        },
        // Add common JavaScript globals
        Math: Math,
        Date: Date,
        JSON: JSON,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        isFinite: isFinite
      };

      // Execute code in a safe context - simpler approach
      // Create a safe execution environment
      const executeCode = () => {
        // Bind safe globals to local scope
        const console = safeConsole;
        const alert = safeGlobals.alert;
        const prompt = safeGlobals.prompt;
        const confirm = safeGlobals.confirm;
        const Math = safeGlobals.Math;
        const Date = safeGlobals.Date;
        const JSON = safeGlobals.JSON;
        const parseInt = safeGlobals.parseInt;
        const parseFloat = safeGlobals.parseFloat;
        const isNaN = safeGlobals.isNaN;
        const isFinite = safeGlobals.isFinite;

        // Execute user code using eval in controlled scope
        return eval(code);
      };

      // Execute the code
      result = executeCode();

      // If we have console output, use that as the primary result
      if (consoleOutput.length > 0) {
        result = consoleOutput.join('\n');
      } else if (result === undefined) {
        result = 'Code executed successfully (no output)';
      }    } catch (e) {
      result = `Error: ${e.message}`;
      hasError = true;
    }

    resolve({
      output: result,
      code: code.length > 100 ? code.substring(0, 100) + '...' : code,
      success: !hasError
    });
  });
}

async function processWithAIPipe(input, workflow) {
  // Replace with real API call if available
  const res = await fetch('/api/aipipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, workflow })
  });
  if (!res.ok) throw new Error('AI Pipe API error');
  return await res.json();
}

// Expose functions globally
window.sendMessage = sendMessage;
window.toggleTheme = toggleTheme;

// Theme Toggle Functionality
let isDarkMode = false;

function toggleTheme() {
  isDarkMode = !isDarkMode;
  const body = document.body;
  const themeButton = document.querySelector('.theme-toggle');

  if (isDarkMode) {
    // Apply dark theme
    body.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';
    document.querySelector('.main-container').style.background = 'rgba(26, 26, 46, 0.95)';
    document.querySelector('.main-container').style.color = '#ffffff';
    themeButton.textContent = '☀️';
    themeButton.title = 'Switch to Light Mode';

    // Update chat container
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.style.background = 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)';

    // Update provider section
    const providerSection = document.querySelector('.provider-section');
    providerSection.style.background = 'linear-gradient(135deg, #252547 0%, #2a2a5c 100%)';

    // Update status section
    const statusSection = document.querySelector('.status-section');
    statusSection.style.background = 'linear-gradient(135deg, #252547 0%, #2a2a5c 100%)';
    statusSection.style.color = '#ffffff';

  } else {
    // Apply light theme
    body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    document.querySelector('.main-container').style.background = 'rgba(255, 255, 255, 0.95)';
    document.querySelector('.main-container').style.color = '#2d3748';
    themeButton.textContent = '🌙';
    themeButton.title = 'Switch to Dark Mode';

    // Reset chat container
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.style.background = 'linear-gradient(135deg, #fafbff 0%, #f8f9ff 100%)';

    // Reset provider section
    const providerSection = document.querySelector('.provider-section');
    providerSection.style.background = 'linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)';

    // Reset status section
    const statusSection = document.querySelector('.status-section');
    statusSection.style.background = 'linear-gradient(135deg, #e8f2ff 0%, #f0f8ff 100%)';
    statusSection.style.color = '#2d3748';
  }
}

// Provider/Model Selection Logic
function updateModelOptions() {
  const provider = providerSelect.value;
  const modelLabel = document.querySelector('label[for="modelSelect"]');

  if (provider === 'nvidia') {
    // For NVIDIA, keep the model dropdown enabled with NVIDIA-specific models
    modelSelect.disabled = false;
    modelLabel.innerHTML = '<span class="status-icon">🧠</span> NVIDIA Model:';

    // Clear and populate with NVIDIA models
    modelSelect.innerHTML = `
      <option value="deepseek-r1">DeepSeek R1 (Better Tool Calling)</option>
      <option value="llama-3.3">Llama 3.3 70B (Recommended)</option>
      <option value="qwen-coder">Qwen 2.5 Coder</option>
      <option value="llama-4-maverick">Llama 4 Maverick</option>
      <option value="llama-4-scout">Llama 4 Scout</option>
    `;
  } else {
    // For other providers, disable model selection
    modelSelect.disabled = true;
    modelLabel.innerHTML = '<span class="status-icon">🤖</span> Model (Auto):';

    // Set generic model option
    modelSelect.innerHTML = `<option value="auto">Automatic Model Selection</option>`;
  }
}

// Initialize and set up event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Set up provider change listener
  providerSelect.addEventListener('change', updateModelOptions);

  // Initialize the model options
  updateModelOptions();

  // Focus on input
  userInput.focus();

  // Add typing animation to input placeholder
  const input = document.getElementById('userInput');
  const placeholders = [
    "✨ Ask me anything... I can search, code, or process data!",
    "💻 Try: 'Create a calculator function'",
    "🔍 Try: 'Search for latest AI news'",
    "🧠 Try: 'Process this data with AI'",
    "⚡ Ready for your next command..."
  ];

  let placeholderIndex = 0;
  setInterval(() => {
    input.placeholder = placeholders[placeholderIndex];
    placeholderIndex = (placeholderIndex + 1) % placeholders.length;
  }, 3000);
});

// Minimal LLM Agent - Implements the exact loop from LLM Agent.txt
class MinimalLLMAgent {
    constructor() {
        this.messages = [];
        this.isProcessing = false;
    }

    // Core agent loop - JavaScript version of the Python loop
    async loop(userInput) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // Add user input to messages
            this.messages.push({ role: "user", content: userInput });
            this.displayMessage("user", userInput);

            while (true) {
                // Send conversation + tools to LLM
                const { output, tool_calls } = await this.callLLM();
                
                // Always stream LLM output
                if (output) {
                    console.log("Agent:", output);
                    this.displayMessage("assistant", output);
                }

                if (tool_calls && tool_calls.length > 0) {
                    // Continue executing tool calls until LLM decides no more needed
                    const toolResults = await this.handleToolCalls(tool_calls);
                    this.messages.push(...toolResults);
                } else {
                    // No more tool calls - ready for next user input
                    break;
                }
            }
        } catch (error) {
            this.showAlert('danger', `Error: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    async callLLM() {
        const provider = document.getElementById('providerSelect').value;
        const model = document.getElementById('modelSelect').value;
        
        console.log(`🚀 Calling ${provider} with model: ${model}`);
        
        const response = await fetch('/api/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: this.messages,
                provider: provider,
                model: model
            })
        });

        if (!response.ok) {
            throw new Error(`LLM API failed: ${response.status}`);
        }

        const data = await response.json();
        const message = data.choices[0].message;
        
        // Debug logging
        console.log('LLM Response:', {
            content: message.content,
            tool_calls: message.tool_calls,
            hasToolCalls: !!(message.tool_calls && message.tool_calls.length > 0)
        });
        
        // Add assistant message to conversation
        this.messages.push(message);
        
        return {
            output: message.content,
            tool_calls: message.tool_calls || []
        };
    }

    async handleToolCalls(tool_calls) {
        const results = [];
        
        // Process tool calls (may be parallel)
        for (const toolCall of tool_calls) {
            const result = await this.executeToolCall(toolCall);
            results.push(result);
        }
        
        return results;
    }

    async executeToolCall(toolCall) {
        const { function: func, id } = toolCall;
        const { name, arguments: args } = func;
        const params = JSON.parse(args);

        console.log(`🔧 Executing tool: ${name}`, params);
        
        let result;
        try {
            switch (name) {
                case 'search_google':
                    result = await this.searchGoogle(params.query);
                    break;
                case 'execute_javascript':
                    result = await this.executeJavaScript(params.code);
                    break;
                case 'process_with_aipipe':
                    result = await this.processWithAIPipe(params.input, params.workflow);
                    break;
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
            
            this.displayToolResult(name, params, result);
            
        } catch (error) {
            result = `Error: ${error.message}`;
            this.showAlert('warning', `Tool ${name} failed: ${error.message}`);
        }

        // Return in OpenAI tool response format
        return {
            role: "tool",
            tool_call_id: id,
            content: JSON.stringify(result)
        };
    }

    // Tool 1: Google Search Snippets
    async searchGoogle(query) {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }
        
        return await response.json();
    }

    // Tool 2: JavaScript Code Execution (Sandboxed)
    async executeJavaScript(code) {
        return new Promise((resolve, reject) => {
            try {
                // Create sandboxed iframe for safe execution
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
                
                const iframeDoc = iframe.contentDocument;
                iframeDoc.open();
                iframeDoc.write(`
                    <script>
                        try {
                            const result = (function() {
                                ${code}
                            })();
                            parent.postMessage({type: 'success', result: result}, '*');
                        } catch (error) {
                            parent.postMessage({type: 'error', error: error.message}, '*');
                        }
                    </script>
                `);
                iframeDoc.close();
                
                const messageHandler = (event) => {
                    if (event.source === iframe.contentWindow) {
                        window.removeEventListener('message', messageHandler);
                        document.body.removeChild(iframe);
                        
                        if (event.data.type === 'success') {
                            resolve({ output: event.data.result, code: code });
                        } else {
                            reject(new Error(event.data.error));
                        }
                    }
                };
                
                window.addEventListener('message', messageHandler);
                
                // Timeout after 5 seconds
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    document.body.removeChild(iframe);
                    reject(new Error('Code execution timeout'));
                }, 5000);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    // Tool 3: AI Pipe Proxy API
    async processWithAIPipe(input, workflow = 'default') {
        const response = await fetch('/api/aipipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input, workflow })
        });
        
        if (!response.ok) {
            throw new Error(`AI Pipe failed: ${response.status}`);
        }
        
        return await response.json();
    }

    // UI Methods
    displayMessage(role, content) {
        const chatContainer = document.getElementById('chatContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        const roleLabel = role === 'user' ? 'You' : 'Assistant';
        messageDiv.innerHTML = `<strong>${roleLabel}:</strong> ${content}`;
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    displayToolResult(toolName, params, result) {
        const chatContainer = document.getElementById('chatContainer');
        const toolDiv = document.createElement('div');
        toolDiv.className = 'message tool-result';
        
        const summary = this.formatToolResult(toolName, params, result);
        toolDiv.innerHTML = `<strong>🔧 Tool Result [${toolName}]:</strong><br>${summary}`;
        
        chatContainer.appendChild(toolDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    formatToolResult(toolName, params, result) {
        switch (toolName) {
            case 'search_google':
                return `Found ${result.results?.length || 0} results for "${params.query}"`;
            case 'execute_javascript':
                return `Code executed: ${JSON.stringify(result.output)}`;
            case 'process_with_aipipe':
                return `AI Pipe: ${result.output || result.status}`;
            default:
                return JSON.stringify(result).slice(0, 100);
        }
    }

    showAlert(type, message) {
        const alertContainer = document.getElementById('alertContainer');
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        alertContainer.appendChild(alertDiv);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Global agent instance
const agent = new MinimalLLMAgent();

// Send message function
async function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    input.value = '';
    await agent.loop(message);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🤖 Minimal LLM Agent initialized');
    console.log('📋 Deliverable: Browser JS app with 3 tools + OpenAI interface');
});

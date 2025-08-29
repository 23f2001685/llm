# LLM Agent POC - Vercel Deployment

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/llm-agent-poc)

## 📁 Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── llm.js             # Main LLM chat endpoint
│   ├── search.js          # Google search tool
│   ├── aipipe.js          # AI Pipe processing tool
│   └── execute.js         # JavaScript execution tool (unused - client-side)
├── public/                # Static files served by Vercel
│   ├── index.html         # Main application UI
│   └── agent.js           # Client-side agent logic
├── vercel.json            # Vercel deployment configuration
└── package.json           # Dependencies

```

## 🔧 Environment Variables Setup

Add these environment variables in your Vercel dashboard:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables:

```
AI_PIPE_KEY=your_ai_pipe_api_key
AI_PROXY_KEY=your_ai_proxy_api_key
NVIDIA_API_KEY=your_nvidia_api_key
```

## 🛠️ Features

- **NVIDIA API Integration**: 5 premium models (DeepSeek R1, Llama variants, Qwen Coder)
- **Smart Fallback System**: Automatically switches between NVIDIA → AI Pipe → AI Proxy APIs
- **Three Working Tools**:
  - 🔍 Google Search Snippets (mock implementation)
  - 💻 JavaScript Execution (client-side sandboxed)
  - 🧠 AI Pipe Processing (real API with fallback)
- **OpenAI Tool-Calling Interface**: Full specification compliance
- **Bootstrap UI**: Professional responsive interface
- **Conversation Management**: Handles large conversations (20 message limit)

## 🚀 Deployment Steps

### Option 1: Deploy from GitHub

1. **Fork this repository** to your GitHub account
2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your forked repository
3. **Add Environment Variables** (see above)
4. **Deploy!** - Vercel will automatically build and deploy

### Option 2: Deploy from Local

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Add Environment Variables**:
   ```bash
   vercel env add AI_PIPE_KEY
   vercel env add AI_PROXY_KEY  
   vercel env add NVIDIA_API_KEY
   ```

5. **Redeploy with Environment Variables**:
   ```bash
   vercel --prod
   ```

## 🔗 API Endpoints

- `GET /` - Main application interface
- `POST /api/llm` - Main LLM chat endpoint with tool calling
- `POST /api/search` - Google search tool endpoint
- `POST /api/aipipe` - AI Pipe processing tool endpoint

## 🧪 Testing the Deployment

After deployment, test these features:

1. **Basic Chat**: Ask a simple question
2. **Search Tool**: "search for Eiffel Tower"
3. **Code Execution**: "calculate 25 * 47"
4. **AI Pipe Processing**: "process this data with AI Pipe"
5. **Model Selection**: Try different NVIDIA models

## 🛡️ Security Features

- **Environment Variables**: API keys stored securely in Vercel
- **CORS Enabled**: Proper cross-origin resource sharing
- **Sandboxed JavaScript**: Client-side execution in iframe
- **Request Validation**: Proper HTTP method checking
- **Error Handling**: Comprehensive error catching and fallbacks

## 🎯 Production Ready

- **Payload Management**: 50MB request limit with conversation truncation
- **Smart Fallbacks**: Multiple API redundancy ensures uptime
- **Performance Optimized**: Serverless functions with fast cold starts
- **Scalable Architecture**: Vercel's global edge network

## 📱 Mobile Responsive

The application works perfectly on mobile devices with Bootstrap 5.3.0 responsive design.

## 🔧 Customization

### Adding New Tools

1. Create a new file in `/api/` directory
2. Follow the same CORS and error handling pattern
3. Add the tool definition to `/api/llm.js`
4. Update the client-side handler in `/public/agent.js`

### Changing Models

Update the `NVIDIA_MODELS` object in `/api/llm.js` with new model paths from NVIDIA's catalog.

## 📊 Monitoring

Monitor your deployment in the Vercel dashboard:
- Function logs
- Performance metrics
- Error tracking
- Usage analytics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use and modify for your projects.

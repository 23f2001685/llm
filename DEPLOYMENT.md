# 🚀 Vercel Deployment Guide

## Prerequisites
- Git repository (GitHub, GitLab, or Bitbucket)
- Vercel account (free)
- API keys configured

## Step 1: Prepare for Deployment

Your project is already configured for Vercel with:
- ✅ `vercel.json` configuration file
- ✅ `package.json` with dependencies
- ✅ Environment variable setup
- ✅ `.gitignore` file
- ✅ Express.js serverless functions

## Step 2: Deploy to Vercel

### Option A: Vercel CLI (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy from project directory:**
   ```bash
   vercel
   ```

4. **Deploy to production:**
   ```bash
   vercel --prod
   ```

### Option B: GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will auto-detect Next.js/Node.js and deploy

## Step 3: Configure Environment Variables

In your Vercel dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add these variables:

```
NVIDIA_API_KEY=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
AI_PIPE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6IjIzZjIwMDE2ODVAZHMuc3R1ZHkuaWl0bS5hYy5pbiJ9.akfdFSdcnTBx6oSmRDzNSs9s-DSBLkesFdi3BRWgnMw
AI_PROXY_KEY=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6IjIzZjIwMDE2ODVAZHMuc3R1ZHkuaWl0bS5hYy5pbiJ9.iIaiNklwouWA9dp9rsKcPcuOcNAcemZuE2LG3FTeEOQ
NODE_ENV=production
```

3. **Redeploy** after adding environment variables

## Step 4: Test Your Deployment

After deployment, test:
- ✅ Chat interface loads
- ✅ NVIDIA API responses
- ✅ JavaScript execution works
- ✅ Google Search tool
- ✅ AI Pipe processing
- ✅ Theme toggle
- ✅ Responsive design

## 🎯 Your app will be available at:
`https://your-project-name.vercel.app`

## 🔧 Troubleshooting

**Common Issues:**

1. **Environment Variables Not Loading:**
   - Ensure variables are added in Vercel dashboard
   - Redeploy after adding variables
   - Check variable names match exactly

2. **API Endpoints Not Working:**
   - Verify `vercel.json` routing configuration
   - Check serverless function exports

3. **Static Files Not Serving:**
   - Ensure files are in project root (not `/public/`)
   - Check `vercel.json` routes

## 📱 Features Working on Vercel:
- 🤖 **NVIDIA API Integration** (5 models)
- 🔍 **Google Search Tool** 
- 💻 **JavaScript Execution**
- 🧠 **AI Pipe Processing**
- 🎨 **Modern UI with Dark/Light Theme**
- 📱 **Responsive Design**
- ⚡ **Fast Serverless Deployment**

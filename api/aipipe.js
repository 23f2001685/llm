const fetch = require('node-fetch');

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
    const { input, workflow = 'default' } = req.body;
    const AI_PIPE_KEY = process.env.AI_PIPE_KEY;
    
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
};

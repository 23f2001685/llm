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
};

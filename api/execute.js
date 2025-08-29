const vm = require('vm');

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
    const { code } = req.body;
    
    // Create a secure execution context
    const sandbox = {
      console: {
        log: (...args) => {
          sandbox._output.push(args.join(' '));
        }
      },
      Math: Math,
      Date: Date,
      JSON: JSON,
      _output: []
    };
    
    // Create VM context
    const context = vm.createContext(sandbox);
    
    // Execute code with timeout
    try {
      const result = vm.runInContext(code, context, {
        timeout: 5000, // 5 second timeout
        displayErrors: true
      });
      
      const output = sandbox._output.join('\n');
      
      console.log(`💻 JavaScript execution: ${code.slice(0, 50)}...`);
      
      res.json({
        success: true,
        result: result,
        output: output,
        execution_time: Date.now()
      });
      
    } catch (execError) {
      res.json({
        success: false,
        error: execError.message,
        output: sandbox._output.join('\n')
      });
    }
    
  } catch (error) {
    console.error('JavaScript Execution Error:', error);
    res.status(500).json({ error: error.message });
  }
};

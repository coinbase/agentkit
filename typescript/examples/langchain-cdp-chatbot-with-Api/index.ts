import express from 'express';
import cors from 'cors';
import { main, runChatMode } from './chatbot';

const app = express();
const PORT = process.env.PORT || 3000;

let agent, config;

// Initialize the agent and config
(async () => {
  try {
    const result = await main();
    if (!result) {
      throw new Error('Failed to initialize: result is undefined');
    }
    agent = result.agent;
    config = result.config;
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
})();

// Middleware
app.use(cors()); // Enable CORS for the routes required
app.use(express.json()); // Parse JSON bodies

/**
 *Post request route
 *Set the route as per your requirement 
*/
app.post('/api/data', async (req, res) => {
  try {
    const data =await req.body.message;
    let obj = await runChatMode(agent, config , data);

    res.status(200).json({
      success: true,
      message: 'Data received successfully',
      data: obj
    });
  } catch (error : any) {
    res.status(500).json({
      success: false,
      message: 'Error processing request',
      error: error?.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
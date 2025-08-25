import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeAgent } from './agent';

interface ChatResponse {
  response: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    const { agent, config } = await initializeAgent();
    
    const stream = await agent.stream(
      { messages: [{ type: 'human', content: message }] },
      config
    );

    let response = '';
    for await (const chunk of stream) {
      if ('agent' in chunk) {
        response += chunk.agent.messages[0].content;
      } else if ('tools' in chunk) {
        response += chunk.tools.messages[0].content;
      }
    }

    res.status(200).json({ response });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
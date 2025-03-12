import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeAgent } from './agent';

interface AutoResponse {
  response: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AutoResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { agent, config } = await initializeAgent();
    const thought = "Be creative and do something interesting on the blockchain. Choose an action or set of actions and execute it that highlights your abilities.";
    
    const stream = await agent.stream(
      { messages: [{ type: 'human', content: thought }] },
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
    console.error('Error in autonomous mode:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
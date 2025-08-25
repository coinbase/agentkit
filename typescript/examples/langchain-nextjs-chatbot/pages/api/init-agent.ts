import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeAgent } from './agent';
import { AgentData } from 'components/ui/types/agent';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AgentData | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { agent, config: { configurable } } = await initializeAgent();
    res.status(200).json({ agent, config: { thread_id: configurable.thread_id } });
  } catch (error) {
    console.error('Error initializing agent:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
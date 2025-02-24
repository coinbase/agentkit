export interface AgentMessage {
    type: 'human' | 'agent' | 'tool';
    content: string;
  }
  
  export interface ChatMessage {
    type: 'user' | 'agent' | 'error';
    content: string;
  }
  
  export interface AgentConfig {
    thread_id: string;
    [key: string]: any;
  }
  
  export interface AgentResponse {
    agent?: {
      messages: AgentMessage[];
    };
    tools?: {
      messages: AgentMessage[];
    };
  }
  
  export interface AgentData {
    agent: any;
    config: AgentConfig;
  }
'use client';
import ReactMarkdown from "react-markdown";
import React, { useState, KeyboardEvent } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage, AgentData } from './ui/types/agent';

const AgentInterface = () => {
  const [mode, setMode] = useState<'chat' | 'auto' | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const initializeAgent = async (): Promise<AgentData> => {
    try {
      const response = await fetch('/api/init-agent', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to initialize agent');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error initializing agent:', error);
      throw error;
    }
  };

  const handleModeSelect = async (selectedMode: 'chat' | 'auto') => {
    setMode(selectedMode);
    const agentData = await initializeAgent();
    
    if (selectedMode === 'auto') {
      startAutonomousMode(agentData.agent, agentData.config);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { type: 'user', content: input }]);
    
    try {
      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        type: 'agent', 
        content: data.response 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }]);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const startAutonomousMode = async (agent: any, config: any) => {
    setIsLoading(true);
    
    while (mode === 'auto') {
      try {
        const response = await fetch('/api/agent-auto', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to run autonomous mode');
        }

        const data = await response.json();
        
        setMessages(prev => [...prev, { 
          type: 'agent', 
          content: data.response 
        }]);

        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (error) {
        setMessages(prev => [...prev, { 
          type: 'error', 
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }]);
        setMode(null);
        break;
      }
    }
    
    setIsLoading(false);
  };

  if (!mode) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Choose Agent Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            className="w-full flex items-center justify-center space-x-2" 
            onClick={() => handleModeSelect('chat')}
          >
            <span className="text-lg">💬</span>
            <span>Chat Mode</span>
          </Button>
          <Button 
            className="w-full flex items-center justify-center space-x-2" 
            onClick={() => handleModeSelect('auto')}
          >
            <span className="text-lg">🤖</span>
            <span>Autonomous Mode</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span className="text-lg">
            {mode === 'chat' ? '💬' : '🤖'}
          </span>
          <span>{mode === 'chat' ? 'Chat Mode' : 'Autonomous Mode'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-96 overflow-y-auto space-y-4 p-4 border rounded-lg">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-100 ml-auto max-w-[80%]'
                  : message.type === 'error'
                  ? 'bg-red-100'
                  : 'bg-gray-100'
              }`}
            >
         <ReactMarkdown>{message.content}</ReactMarkdown>
         </div>
          ))}
        </div>
        
        {mode === 'chat' && (
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={isLoading}
            >
              Send
            </Button>
          </div>
        )}
        
        {mode === 'auto' && (
          <Button 
            onClick={() => setMode(null)} 
            className="w-full"
            disabled={isLoading}
          >
            Stop Autonomous Mode
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentInterface;
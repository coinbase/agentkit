import { useState } from "react";

export function useAgent() {
  const [messages, setMessages] = useState<{ text: string; sender: "user" | "agent" }[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const sendMessage = async (input: string) => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { text: input, sender: "user" }]);
    setIsThinking(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: input }),
      });

      const data = await response.json();

      if (data.response) {
        setMessages((prev) => [...prev, { text: data.response, sender: "agent" }]);
      }
    } catch (error) {
      console.error("Error communicating with agent:", error);
    } finally {
      setIsThinking(false);
    }
  };

  return { messages, sendMessage, isThinking };
}

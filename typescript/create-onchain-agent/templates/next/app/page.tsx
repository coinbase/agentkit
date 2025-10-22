"use client";

import { useState, useEffect, useRef } from "react";
import { useAgent } from "./hooks/useAgent";
import ReactMarkdown from "react-markdown";

/**
 * Home page for the AgentKit Quickstart
 *
 * @returns {React.ReactNode} The home page
 */
export default function Home() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, isThinking } = useAgent();

  // Ref for the messages container
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to the bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const onSendMessage = async () => {
    if (!input.trim() || isThinking) return;
    const message = input;
    setInput("");
    await sendMessage(message);
  };

  return (
    <div className="flex flex-col flex-grow items-center justify-center text-black dark:text-white w-full h-full">
      <div className="w-full max-w-2xl h-[70vh] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 flex flex-col">
        {/* Chat Messages */}
        <div className="flex-grow overflow-y-auto space-y-3 p-2">
          {messages.length === 0 ? (
            <p className="text-center text-gray-500">Start chatting with AgentKit...</p>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-2xl shadow ${
                  msg.sender === "user"
                    ? "bg-[#0052FF] text-white self-end"
                    : "bg-gray-100 dark:bg-gray-700 self-start"
                }`}
              >
                <ReactMarkdown
                  components={{
                    a: props => (
                      <a
                        {...props}
                        className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            ))
          )}

          {/* Thinking Indicator */}
          {isThinking && <div className="text-right mr-2 text-gray-500 italic">🤖 Thinking...</div>}

          {/* Invisible div to track the bottom */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <div className="flex items-center space-x-2 mt-2">
          <input
            type="text"
            className="flex-grow p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
            placeholder={"Type a message..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSendMessage()}
            disabled={isThinking}
          />
          <button
            onClick={onSendMessage}
            className={`px-6 py-2 rounded-full font-semibold transition-all ${
              isThinking
                ? "bg-gray-300 cursor-not-allowed text-gray-500"
                : "bg-[#0052FF] hover:bg-[#003ECF] text-white shadow-md"
            }`}
            disabled={isThinking}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

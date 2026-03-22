import { useState, useCallback } from 'react';
import { api } from '../utils/api.js';

export function useAIChat() {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [panels, setPanels] = useState([]);

  const sendMessage = useCallback(async (content, snapshotId) => {
    const userMessage = { role: 'user', content, timestamp: new Date().toISOString() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setStreaming(true);
    setPanels([]);

    try {
      const response = await api.postRaw('/ai/chat', {
        messages: updatedMessages.map(({ role, content }) => ({ role, content })),
        snapshot_id: snapshotId,
        conversation_id: conversationId,
      });

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        const convIdHeader = response.headers.get('x-conversation-id');
        if (convIdHeader) setConversationId(convIdHeader);

        const assistantMsg = {
          role: 'assistant',
          content: data.plain_text || '',
          panels: data.panels || [],
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setPanels(data.panels || []);
      } else {
        let assistantContent = '';
        setMessages((prev) => [...prev, { role: 'assistant', content: '', timestamp: new Date().toISOString() }]);

        const convIdHeader = response.headers.get('x-conversation-id');
        if (convIdHeader) setConversationId(convIdHeader);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6);
              if (payload === '[DONE]') break;
              try {
                const parsed = JSON.parse(payload);
                if (parsed.content) {
                  assistantContent += parsed.content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      content: assistantContent,
                    };
                    return updated;
                  });
                }
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Something went wrong. Please try again.', timestamp: new Date().toISOString() },
      ]);
    } finally {
      setStreaming(false);
    }
  }, [messages, conversationId]);

  function resetChat() {
    setMessages([]);
    setConversationId(null);
    setPanels([]);
  }

  return { messages, streaming, panels, sendMessage, resetChat, conversationId };
}

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIChat } from '../hooks/useAIChat.js';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../utils/api.js';
import { ComicPanelStrip } from './ComicPanel.jsx';
import ResponseModeToggle from './ResponseModeToggle.jsx';

const FALLBACK_STARTERS = [
  'Can I afford a hire at $45K?',
  'Why is my cash always tight?',
  'What should I fix first?',
  'What does my breakeven look like if I raise prices 10%?',
];

export default function AIChatPanel({ snapshotId, snapshotOutputs, collapsed = true }) {
  const [isOpen, setIsOpen] = useState(!collapsed);
  const [input, setInput] = useState('');
  const [starters, setStarters] = useState(FALLBACK_STARTERS);
  const { user } = useAuth();
  const { messages, streaming, panels, sendMessage, resetChat } = useAIChat();
  const responseMode = user?.response_mode || 'comic';

  useEffect(() => {
    if (snapshotOutputs && isOpen) {
      api.post('/ai/dynamic-starters', { outputs: snapshotOutputs })
        .then((data) => {
          if (data.questions?.length > 0) setStarters(data.questions);
        })
        .catch(() => {});
    }
  }, [snapshotOutputs, isOpen]);

  function handleSend(text) {
    const msg = text || input.trim();
    if (!msg || streaming) return;
    sendMessage(msg, snapshotId);
    setInput('');
  }

  async function handleModeToggle(mode) {
    try {
      await api.put('/ai/response-mode', { mode });
    } catch {}
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-orange rounded-full flex items-center justify-center
          shadow-lg hover:bg-orange-hover transition-colors z-40"
      >
        <span className="text-white text-2xl">💬</span>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 right-6 w-[440px] max-h-[650px] bg-navy-light border border-white/10
        rounded-xl shadow-2xl flex flex-col z-40 overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange rounded-full flex items-center justify-center text-xs font-bold text-white">EN</div>
          <span className="font-sora text-sm text-white">Conversational CFO</span>
        </div>
        <div className="flex items-center gap-2">
          <ResponseModeToggle currentMode={responseMode} onToggle={handleModeToggle} />
          <button onClick={resetChat} className="text-stone text-xs hover:text-white">Clear</button>
          <button onClick={() => setIsOpen(false)} className="text-stone hover:text-white text-lg">&times;</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="font-mulish text-sm text-stone">Ask me anything about your numbers.</p>
            {starters.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="block w-full text-left text-sm font-mulish text-orange hover:text-orange-hover
                  bg-orange/5 hover:bg-orange/10 rounded-lg px-3 py-2 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm font-mulish
                  ${msg.role === 'user'
                    ? 'bg-orange/20 text-white'
                    : 'bg-white/5 text-stone-light'
                  }`}
              >
                {msg.content}
                {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                  <span className="inline-block w-1.5 h-4 bg-orange ml-1 animate-pulse" />
                )}
              </div>
            </div>

            {responseMode === 'comic' && msg.role === 'assistant' && msg.panels?.length > 0 && (
              <div className="mt-2">
                <ComicPanelStrip panels={msg.panels} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about your numbers..."
            className="flex-1 bg-navy text-white font-mulish text-sm rounded-lg px-3 py-2
              border border-white/10 focus:border-orange outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={streaming || !input.trim()}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </motion.div>
  );
}

import { useState } from 'react';

export default function ResponseModeToggle({ currentMode, onToggle }) {
  const [mode, setMode] = useState(currentMode || 'comic');
  const [saving, setSaving] = useState(false);

  async function handleToggle(newMode) {
    if (newMode === mode || saving) return;
    setSaving(true);
    setMode(newMode);
    try {
      await onToggle(newMode);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="font-mulish text-sm text-stone">Response Style</span>
      <div className="flex bg-navy rounded-lg p-0.5 border border-white/10">
        <button
          onClick={() => handleToggle('comic')}
          className={`px-3 py-1.5 rounded-md text-xs font-sora transition-all
            ${mode === 'comic'
              ? 'bg-orange text-white'
              : 'text-stone hover:text-white'
            }`}
        >
          Visual
        </button>
        <button
          onClick={() => handleToggle('classic')}
          className={`px-3 py-1.5 rounded-md text-xs font-sora transition-all
            ${mode === 'classic'
              ? 'bg-orange text-white'
              : 'text-stone hover:text-white'
            }`}
        >
          Classic
        </button>
      </div>
    </div>
  );
}

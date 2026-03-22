import { useState } from 'react';

export default function Tooltip({ content, children }) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-navy-light border border-white/10 rounded-lg shadow-lg max-w-xs">
          <p className="font-mulish text-xs text-stone-light whitespace-normal">{content}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-navy-light border-r border-b border-white/10 rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import Tooltip from './Tooltip.jsx';

export default function InputField({
  label,
  name,
  value,
  onChange,
  type = 'currency',
  tooltip,
  error,
  source,
  disabled = false,
  placeholder,
}) {
  const [displayValue, setDisplayValue] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDisplayValue(formatForDisplay(value));
    }
  }, [value, focused]);

  function formatForDisplay(val) {
    if (val === null || val === undefined || val === '' || val === 0) return '';
    if (type === 'percent') return (val * 100).toFixed(1);
    if (type === 'plain') return String(Math.round(Number(val)));
    return Number(val).toLocaleString();
  }

  function handleChange(e) {
    const raw = e.target.value;
    setDisplayValue(raw);

    const cleaned = raw.replace(/[^0-9.-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return;

    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      if (type === 'percent') onChange(name, num / 100);
      else if (type === 'plain') onChange(name, Math.round(num));
      else onChange(name, num);
    }
  }

  function handleFocus() {
    setFocused(true);
    if (type === 'percent' && value) {
      setDisplayValue((value * 100).toString());
    } else if (value) {
      setDisplayValue(value.toString());
    } else {
      setDisplayValue('');
    }
  }

  function handleBlur() {
    setFocused(false);
    if (displayValue.trim() === '') {
      onChange(name, 0);
    }
    setDisplayValue(formatForDisplay(value));
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="font-mulish text-sm text-stone-light">{label}</label>
        {tooltip && (
          <Tooltip content={tooltip}>
            <span className="text-stone text-xs cursor-help">(?)</span>
          </Tooltip>
        )}
        {source && source !== 'manual' && (
          <span className="text-xs bg-status-blue/20 text-status-blue px-2 py-0.5 rounded-full font-mulish">
            {source === 'qbo' ? 'From QuickBooks' : source === 'excel' ? 'From Excel' : source === 'estimated' ? 'Estimated' : `From ${source}`}
          </span>
        )}
      </div>
      <div className="relative">
        {type === 'currency' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone font-mulish">$</span>
        )}
        <input
          type="text"
          inputMode={type === 'plain' ? 'numeric' : 'decimal'}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder || '0'}
          className={`w-full bg-offwhite text-navy font-mulish rounded-lg py-2.5 outline-none transition-colors
            ${type === 'currency' ? 'pl-7 pr-3' : 'px-3'}
            ${error ? 'border-2 border-status-red' : 'border border-stone/30 focus:border-orange'}
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
        {type === 'percent' && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone font-mulish">%</span>
        )}
      </div>
      {error && <p className="text-status-red text-xs font-mulish">{error}</p>}
    </div>
  );
}

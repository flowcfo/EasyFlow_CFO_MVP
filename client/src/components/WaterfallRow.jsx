import { formatCurrencyWhole, formatPercent } from '../utils/format.js';

export default function WaterfallRow({ label, value, percent, indent = 0, bold = false, highlight = false }) {
  return (
    <div
      className={`flex items-center justify-between py-2 px-3 rounded
        ${highlight ? 'bg-orange/10 border-l-2 border-orange' : 'border-l-2 border-transparent'}
        ${bold ? 'font-semibold' : ''}`}
      style={{ paddingLeft: `${12 + indent * 16}px` }}
    >
      <span className={`font-mulish ${bold ? 'text-white' : 'text-stone-light'}`}>{label}</span>
      <div className="flex items-center gap-4">
        <span className={`font-sora ${highlight ? 'text-orange' : 'text-white'}`}>
          {formatCurrencyWhole(value)}
        </span>
        {percent !== undefined && (
          <span className="font-mulish text-sm text-stone w-16 text-right">
            {formatPercent(percent)}
          </span>
        )}
      </div>
    </div>
  );
}

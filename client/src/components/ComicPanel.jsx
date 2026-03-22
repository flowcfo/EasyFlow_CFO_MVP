import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const PANEL_COLORS = {
  red: { accent: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  yellow: { accent: '#eab308', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  green: { accent: '#22c55e', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  orange: { accent: '#F05001', bg: 'bg-orange/10', border: 'border-orange/30' },
  gray: { accent: '#8A8278', bg: 'bg-stone/10', border: 'border-stone/30' },
};

function GaugeVisual({ value, target, color }) {
  const pct = Math.min(Math.max((value / target) * 100, 0), 100);
  const accent = PANEL_COLORS[color]?.accent || '#F05001';

  return (
    <div className="relative w-20 h-20 mx-auto">
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <circle cx="40" cy="40" r="34" fill="none" stroke="#1a2a3e" strokeWidth="6" />
        <circle
          cx="40" cy="40" r="34"
          fill="none" stroke={accent} strokeWidth="6"
          strokeDasharray={`${(pct / 100) * 213.6} 213.6`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-sora text-lg text-white font-bold">{typeof value === 'number' ? value.toFixed(1) : value}</span>
        <span className="text-[10px] text-stone font-mulish">/ {target}</span>
      </div>
    </div>
  );
}

function GapBarVisual({ value, target, color }) {
  const pct = Math.min(Math.max((value / target) * 100, 0), 100);
  const accent = PANEL_COLORS[color]?.accent || '#ef4444';

  return (
    <div className="w-full px-2">
      <div className="relative h-4 bg-navy-light rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: accent }} />
        <div className="absolute top-0 h-full w-0.5 bg-white" style={{ left: '100%' }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-stone font-mulish">{typeof value === 'number' ? value.toFixed(2) : value}</span>
        <span className="text-[10px] text-stone font-mulish">Target: {target}</span>
      </div>
    </div>
  );
}

function MeterVisual({ value, color }) {
  const pct = Math.min(Math.max(value * 100, 0), 100);
  const accent = PANEL_COLORS[color]?.accent || '#8A8278';

  return (
    <div className="w-6 h-16 mx-auto bg-navy-light rounded-full overflow-hidden relative">
      <div
        className="absolute bottom-0 w-full rounded-full transition-all"
        style={{ height: `${pct}%`, backgroundColor: accent }}
      />
    </div>
  );
}

function ActionArrowVisual() {
  return (
    <div className="flex justify-center">
      <div className="w-10 h-10 rounded-full bg-orange flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function PanelVisual({ visual, value, target, color }) {
  switch (visual) {
    case 'gauge': return <GaugeVisual value={value} target={target} color={color} />;
    case 'gap_bar': return <GapBarVisual value={value} target={target} color={color} />;
    case 'meter': return <MeterVisual value={value} color={color} />;
    case 'action_arrow': return <ActionArrowVisual />;
    default: return null;
  }
}

export default function ComicPanel({ panel, index = 0 }) {
  const navigate = useNavigate();
  const colors = PANEL_COLORS[panel.color] || PANEL_COLORS.orange;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.3 }}
      className={`rounded-xl border ${colors.border} ${colors.bg} p-4 space-y-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-sora uppercase tracking-wider text-stone">{panel.type}</span>
        <span className="text-[10px] font-sora text-stone/60">Panel {panel.number}</span>
      </div>

      {panel.visual && (
        <PanelVisual
          visual={panel.visual}
          value={panel.value}
          target={panel.target}
          color={panel.color}
        />
      )}

      <p className="font-sora text-sm text-white font-semibold leading-snug">{panel.caption}</p>

      {panel.subtext && (
        <p className="font-mulish text-xs text-stone leading-relaxed">{panel.subtext}</p>
      )}

      {panel.cta_label && panel.cta_screen && (
        <button
          onClick={() => navigate(panel.cta_screen)}
          className="w-full mt-2 bg-orange hover:bg-orange-hover text-white font-sora text-xs
            py-2 px-4 rounded-lg transition-colors"
        >
          {panel.cta_label}
        </button>
      )}
    </motion.div>
  );
}

export function ComicPanelStrip({ panels }) {
  if (!panels || panels.length === 0) return null;

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(panels.length, 4)}, 1fr)` }}>
      {panels.map((panel, i) => (
        <ComicPanel key={panel.number || i} panel={panel} index={i} />
      ))}
    </div>
  );
}

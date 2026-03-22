import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useAuth } from '../hooks/useAuth.js';
import InputField from '../components/InputField.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatCurrency, formatPercent } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';
import { api } from '../utils/api.js';

export default function WeeklyScorecard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    week_ending: new Date().toISOString().split('T')[0],
    revenue: 0, cogs: 0, direct_labor: 0, marketing: 0, notes: '',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [entriesData, summaryData] = await Promise.all([
        api.get('/weekly/entries'),
        api.get('/weekly/summary'),
      ]);
      setEntries(entriesData.entries || []);
      setSummary(summaryData);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post('/weekly/entry', form);
      await loadData();
      setForm({ ...form, revenue: 0, cogs: 0, direct_labor: 0, marketing: 0, notes: '' });
    } catch {}
  }

  if (loading) return <SkeletonCard count={2} />;

  const weeks = summary?.weeks || [];
  const qtd = summary?.summary || {};
  const chartData = weeks.slice(0, 13).reverse().map((w) => ({
    week: w.week_ending?.slice(5),
    revenue: w.revenue,
    target: w.weekly_revenue_target,
    status: w.status,
  }));

  return (
    <div className="space-y-6">
      <h1 className="font-sora text-2xl font-bold text-white">Weekly Scorecard</h1>

      <div className="card-light">
        <h3 className="font-sora text-sm text-navy font-semibold mb-3">Log This Week</h3>
        <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="font-mulish text-sm text-stone block mb-1">Week Ending</label>
            <input type="date" value={form.week_ending} onChange={(e) => setForm({ ...form, week_ending: e.target.value })}
              className="w-full bg-offwhite text-navy font-mulish rounded-lg py-2 px-3 border border-stone/30" />
          </div>
          <InputField label="Revenue" name="revenue" value={form.revenue} onChange={(_, v) => setForm({ ...form, revenue: v })} />
          <InputField label="COGS" name="cogs" value={form.cogs} onChange={(_, v) => setForm({ ...form, cogs: v })} />
          <InputField label="Direct Labor" name="direct_labor" value={form.direct_labor} onChange={(_, v) => setForm({ ...form, direct_labor: v })} />
          <InputField label="Marketing" name="marketing" value={form.marketing} onChange={(_, v) => setForm({ ...form, marketing: v })} />
          <div>
            <label className="font-mulish text-sm text-stone block mb-1">Notes</label>
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-offwhite text-navy font-mulish rounded-lg py-2 px-3 border border-stone/30" />
          </div>
          <button type="submit" className="btn-primary py-2 md:col-span-3" style={{ backgroundColor: '#0E1B2E', color: '#F05001', border: '2px solid #F05001' }}>
            Save Entry
          </button>
        </form>
      </div>

      {chartData.length > 0 && (
        <div className="card-dark">
          <h3 className="font-sora text-sm text-white font-semibold mb-3">Last 13 Weeks</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="week" stroke="#8A8278" fontSize={10} />
              <YAxis stroke="#8A8278" fontSize={10} />
              {chartData[0]?.target > 0 && (
                <ReferenceLine y={chartData[0].target} stroke="#F05001" strokeDasharray="3 3" label="Target" />
              )}
              <RechartsTooltip contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)' }} />
              <Bar dataKey="revenue" fill="#F05001" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {weeks.length > 0 && (
        <div className="card-dark overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {['Week', 'Revenue', 'vs Target', 'CM%', 'Direct LPR', 'Status'].map((h) => (
                  <th key={h} className="text-right font-mulish text-stone pb-2 px-2 first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.slice(0, 13).map((w, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="font-mulish text-stone-light py-2 px-2">{w.week_ending}</td>
                  <td className="text-right font-sora text-white py-2 px-2">{formatCurrency(w.revenue)}</td>
                  <td className="text-right font-sora text-white py-2 px-2">{formatCurrency(w.weekly_revenue_target)}</td>
                  <td className="text-right font-sora text-white py-2 px-2">{formatPercent(w.weekly_cm_pct)}</td>
                  <td className="text-right font-sora text-white py-2 px-2">{w.weekly_direct_lpr?.toFixed(2)}x</td>
                  <td className="text-right py-2 px-2"><StatusBadge status={w.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-dark text-center"><p className="font-mulish text-xs text-stone">QTD Revenue</p><p className="font-sora text-lg text-white">{formatCurrency(qtd.total_revenue || 0)}</p></div>
        <div className="card-dark text-center"><p className="font-mulish text-xs text-stone">Avg Weekly</p><p className="font-sora text-lg text-white">{formatCurrency(qtd.avg_weekly_revenue || 0)}</p></div>
        <div className="card-dark text-center"><p className="font-mulish text-xs text-stone">Green Weeks</p><p className="font-sora text-lg text-status-green">{qtd.green_weeks || 0}</p></div>
        <div className="card-dark text-center"><p className="font-mulish text-xs text-stone">Red Weeks</p><p className="font-sora text-lg text-status-red">{qtd.red_weeks || 0}</p></div>
      </div>
    </div>
  );
}

import { Link, useParams } from 'react-router-dom';
import { SAMPLE_GAME_PLAN } from '../utils/gamePlanSample.js';
import { WorkbookIcon } from '../components/Icons.jsx';

// ---------- formatting ----------
const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
function short(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return usd(n);
}
const pct = (n, d = 0) => `${(n * 100).toFixed(d)}%`;
const monthLabel = (iso, opts = { month: 'short' }) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', opts);
const monthYear = (iso) => monthLabel(iso, { month: 'short', year: 'numeric' });
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ---------- pieces ----------
function SectionHead({ title, note }) {
  return (
    <div className="mb-4 mt-10 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <h2 className="font-heading text-[22px] font-bold leading-[30px] text-navy">{title}</h2>
      {note && <p className="text-[15px] text-slate">{note}</p>}
    </div>
  );
}

function TargetCard({ label, big, sub, progress, footLeft, footRight, isKey }) {
  const behind = progress < 0.5;
  return (
    <article className={`rounded-2xl bg-white p-[22px] shadow-card ${isKey ? 'ring-2 ring-inset ring-flame' : ''}`}>
      <p className="text-[15px] font-semibold text-slate">{label}</p>
      <p className={`mt-1.5 font-heading text-[30px] font-extrabold leading-[38px] tracking-[-0.01em] ${isKey ? 'text-flame' : 'text-navy'}`}>
        {big}
      </p>
      <p className="text-[15px] text-slate">{sub}</p>
      <div className="mb-2 mt-4 h-2.5 overflow-hidden rounded-full bg-offwhite" role="progressbar"
           aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} progress`}>
        <div className={`h-full rounded-full ${behind ? 'bg-flame' : 'bg-ink'}`} style={{ width: `${clamp01(progress) * 100}%` }} />
      </div>
      <div className="flex justify-between gap-2 text-sm text-slate">
        <span>{footLeft}</span>
        <span>{footRight}</span>
      </div>
    </article>
  );
}

function Guardrail({ g }) {
  const span = g.scaleMax - g.scaleMin;
  const pos = (v) => clamp01((v - g.scaleMin) / span) * 100;
  const onTarget = g.current >= g.low && (g.high == null || g.current <= g.high);
  const targetText = g.high == null ? `target ${g.low}× or more` : `target ${g.low}× to ${g.high}×`;
  const bandLeft = pos(g.low);
  const bandRight = g.high == null ? 0 : 100 - pos(g.high);
  return (
    <article className="rounded-2xl bg-white p-[22px] shadow-card">
      <h3 className="font-heading text-lg font-bold leading-6 text-navy">{g.name}</h3>
      <p className="mb-4 mt-0.5 text-[15px] text-slate">{g.what}</p>
      <div className="flex items-baseline gap-2.5">
        <span className="font-heading text-[30px] font-extrabold leading-[38px] text-navy">{g.current}×</span>
        <span className="text-[15px] text-slate">{targetText}</span>
      </div>
      <div className="relative mb-1.5 mt-[18px] h-2.5 rounded-full bg-offwhite">
        <div className="absolute inset-y-0 rounded-full bg-pale" style={{ left: `${bandLeft}%`, right: `${bandRight}%` }} />
        <div
          className={`absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-white ${onTarget ? 'bg-ink' : 'bg-flame'}`}
          style={{ left: `${pos(g.current)}%` }}
        />
      </div>
      <div className="flex justify-between text-[13px] text-slate">
        <span>{g.scaleMin}×</span><span>{g.scaleMax}×</span>
      </div>
      <span className={`mt-3.5 inline-flex rounded-full px-3 py-1 text-sm font-bold ${
        onTarget ? 'bg-pale text-ink' : 'bg-cream text-ember ring-1 ring-inset ring-[#F6D9BF]'}`}>
        {onTarget ? 'On target' : 'Below target'}
      </span>
    </article>
  );
}

function MonthChart({ months, closedThrough }) {
  const max = Math.max(...months.map((m) => Math.max(m.target, m.actual || 0)));
  const nextIdx = months.findIndex((m) => m.month > closedThrough);
  return (
    <section className="rounded-2xl bg-white p-6 shadow-card">
      <div className="grid h-[180px] grid-cols-12 items-end gap-1 sm:gap-2.5" role="img"
           aria-label="Monthly revenue targets with actuals for closed months">
        {months.map((m, i) => (
          <div key={m.month} className="flex h-full flex-col items-center justify-end gap-2">
            <div className="relative flex h-[150px] w-full max-w-[34px] items-end">
              <div className="absolute inset-x-0 bottom-0 rounded-t-lg rounded-b bg-offwhite ring-1 ring-inset ring-line"
                   style={{ height: `${(m.target / max) * 100}%` }} title={`${monthYear(m.month)} target ${usd(m.target)}`} />
              {m.actual != null && (
                <div className={`absolute inset-x-[5px] bottom-0 rounded-t-md rounded-b-sm ${m.actual >= m.target ? 'bg-ink' : 'bg-flame'}`}
                     style={{ height: `${(m.actual / max) * 100}%` }} title={`${monthYear(m.month)} actual ${usd(m.actual)}`} />
              )}
            </div>
            <small className={`text-[11px] sm:text-[13px] ${i === nextIdx ? 'font-bold text-navy' : 'text-slate'}`}>
              {monthLabel(m.month)}
            </small>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate">
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[3px] bg-offwhite ring-1 ring-inset ring-line" />Target</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[3px] bg-ink" />Actual, hit target</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[3px] bg-flame" />Actual, missed target</span>
      </div>
    </section>
  );
}

// ---------- screen ----------
export default function GamePlan() {
  const { clientId } = useParams();
  const base = clientId ? `/partner/client/${clientId}` : '/app';
  const plan = SAMPLE_GAME_PLAN; // Stage 3: read from the client's workbook instead.
  const { revenue, pretaxProfit, ownerPay, coreCapital } = plan.targets;

  const lastClosed = [...plan.months].reverse().find((m) => m.actual != null);
  const missedBy = lastClosed ? lastClosed.target - lastClosed.actual : 0;
  const nextMonth = plan.months.find((m) => m.month > plan.closedThrough);

  return (
    <div>
      {plan.isSample && (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-cream px-4 py-3 text-[15px] text-navy ring-1 ring-inset ring-[#F3E3D0]">
          <WorkbookIcon className="mt-0.5 h-5 w-5 flex-none text-ember" />
          <p><b>Sample numbers.</b> Your own game plan shows here once your Profit System workbook is connected.</p>
        </div>
      )}

      {/* Hero */}
      <section className="grid items-end gap-8 rounded-[18px] bg-glossy-cobalt p-6 text-white shadow-card sm:p-9 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="eyebrow text-gold">
            Your 12-month game plan · {monthYear(plan.planStart)} to {monthYear(plan.planEnd)}
          </p>
          <h1 className="mb-3 mt-2.5 font-heading text-[28px] font-extrabold leading-[34px] tracking-[-0.01em] text-white sm:text-4xl sm:leading-[44px]">
            Pay yourself {usd(ownerPay.target)}.{' '}
            <em className="amber-text">Keep {usd(pretaxProfit.target)} in profit.</em>
          </h1>
          <p className="text-lg text-pale">Hit these four numbers and stay inside the three guardrails. Everything else follows.</p>
        </div>
        <dl className="rounded-2xl border border-white/15 bg-ink/55 px-5 py-4">
          {[
            ['Revenue target', usd(revenue.target)],
            ['Pretax profit target', `${usd(pretaxProfit.target)} (${pct(pretaxProfit.targetPct)})`],
            ['Your pay', usd(ownerPay.target)],
          ].map(([k, v], i) => (
            <div key={k} className={`flex justify-between gap-3 py-1.5 ${i ? 'border-t border-white/10' : ''}`}>
              <dt className="text-pale">{k}</dt>
              <dd className="whitespace-nowrap font-bold text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Four targets */}
      <SectionHead title="The four targets" note="Last 12 months compared with the plan" />
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TargetCard label="Revenue" big={short(revenue.target)} sub="Target for the year"
          progress={revenue.current / revenue.target}
          footLeft={<>Last 12 months <b className="text-navy">{short(revenue.current)}</b></>}
          footRight={pct(revenue.current / revenue.target)} />
        <TargetCard isKey label="Pretax profit" big={short(pretaxProfit.target)} sub={`${pct(pretaxProfit.targetPct)} of revenue`}
          progress={pretaxProfit.current / pretaxProfit.target}
          footLeft={<>Last 12 months <b className="text-navy">{short(pretaxProfit.current)} ({pct(pretaxProfit.currentPct, 1)})</b></>}
          footRight={pct(pretaxProfit.current / pretaxProfit.target)} />
        <TargetCard label="Your pay" big={short(ownerPay.target)} sub="Market wage, both hats"
          progress={ownerPay.current / ownerPay.target}
          footLeft={<>Paying now <b className="text-navy">{short(ownerPay.current)}</b></>}
          footRight={pct(ownerPay.current / ownerPay.target)} />
        <TargetCard label="Cash cushion" big={short(coreCapital.target)} sub={`${coreCapital.months} months of operating costs`}
          progress={coreCapital.current / coreCapital.target}
          footLeft={<>In the bank <b className="text-navy">{short(coreCapital.current)}</b></>}
          footRight={pct(coreCapital.current / coreCapital.target)} />
      </section>

      {/* Guardrails */}
      <SectionHead title="Three guardrails" note="Stay inside these and profit takes care of itself" />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plan.guardrails.map((g) => <Guardrail key={g.key} g={g} />)}
      </section>

      {/* Month by month */}
      <SectionHead title="Month by month" note="Revenue target each month, with your actual for months closed" />
      <MonthChart months={plan.months} closedThrough={plan.closedThrough} />

      {/* Gaps + next step */}
      <SectionHead title="Getting from here to target" note="What stands between you and the plan" />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl bg-white px-[22px] py-2 shadow-card">
          {plan.gaps.map((gap, i) => (
            <div key={gap.key} className={`flex items-center justify-between gap-4 py-4 ${i ? 'border-t border-line' : ''}`}>
              <div>
                <p className="font-bold text-navy">{gap.label}</p>
                <p className="text-[15px] text-slate">{gap.note}</p>
              </div>
              <p className="whitespace-nowrap font-heading text-xl font-bold text-navy">{usd(gap.amount)}</p>
            </div>
          ))}
        </article>
        <article className="flex flex-col rounded-2xl bg-cream p-[22px] ring-1 ring-inset ring-[#F3E3D0]">
          <p className="eyebrow text-ember">Next step</p>
          {lastClosed && missedBy > 0 ? (
            <h3 className="mb-2 mt-1 font-heading text-xl font-bold leading-7 text-navy">
              {monthLabel(lastClosed.month, { month: 'long' })} missed by {usd(missedBy)}. See why.
            </h3>
          ) : (
            <h3 className="mb-2 mt-1 font-heading text-xl font-bold leading-7 text-navy">
              {lastClosed ? `${monthLabel(lastClosed.month, { month: 'long' })} hit target. See what drove it.` : 'Close your first month.'}
            </h3>
          )}
          <p className="mb-5 text-navy">Your Target vs. Actual Check shows which line moved and what to watch next month.</p>
          <Link to={`${base}/target-vs-actual`} className="btn-primary self-start">
            Open {lastClosed ? monthLabel(lastClosed.month, { month: 'long' }) : 'the'} check
          </Link>
          {nextMonth && (
            <Link to={`${base}/input`} className="mt-3.5 text-[15px] font-semibold text-cobalt hover:underline">
              Enter {monthLabel(nextMonth.month, { month: 'long' })} numbers
            </Link>
          )}
        </article>
      </section>

      <p className="mb-2 mt-8 flex items-center gap-2 text-sm text-slate">
        <WorkbookIcon className="h-4 w-4" />
        {plan.isSample ? 'Sample numbers' : 'From your Profit System workbook'}
      </p>
    </div>
  );
}

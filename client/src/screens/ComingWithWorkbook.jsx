import { Link, useParams } from 'react-router-dom';
import { WorkbookIcon } from '../components/Icons.jsx';

/**
 * Placeholder for sections that read straight from the client's Profit System
 * workbook (Cash, Target vs. Actual Check). They come online in stage 3, after
 * the SharePoint connection is set up.
 */
export default function ComingWithWorkbook({ eyebrow, title, intro, items }) {
  const { clientId } = useParams();
  const base = clientId ? `/partner/client/${clientId}` : '/app';
  return (
    <div>
      <p className="eyebrow text-ember">{eyebrow}</p>
      <h1 className="mt-1 font-heading text-[30px] font-bold leading-[38px] text-navy">{title}</h1>
      <p className="mt-2 max-w-2xl text-lg text-slate">{intro}</p>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-heading text-lg font-bold text-navy">What you'll see here</h2>
          <ul className="mt-3 space-y-3">
            {items.map((it) => (
              <li key={it.name} className="flex gap-3">
                <span className="mt-2 h-2 w-2 flex-none rounded-full bg-cobalt" aria-hidden="true" />
                <span><b className="text-navy">{it.name}.</b> <span className="text-slate">{it.what}</span></span>
              </li>
            ))}
          </ul>
        </article>
        <article className="flex flex-col rounded-2xl bg-cream p-6 ring-1 ring-inset ring-[#F3E3D0]">
          <WorkbookIcon className="h-7 w-7 text-ember" />
          <h2 className="mt-3 font-heading text-lg font-bold text-navy">Turns on with your workbook</h2>
          <p className="mt-2 text-navy">These numbers come straight from your Profit System workbook. Once it's connected, this page fills in by itself.</p>
          <Link to={`${base}/game-plan`} className="mt-4 font-semibold text-cobalt hover:underline">Back to your Game Plan</Link>
        </article>
      </section>
    </div>
  );
}

export function CashSection() {
  return (
    <ComingWithWorkbook
      eyebrow="Cash"
      title="Know your cash before it's a problem."
      intro="Where cash is headed over the next 13 weeks, and how to free up more of it."
      items={[
        { name: 'Weekly cash', what: 'Cash in, cash out and the balance, week by week.' },
        { name: 'Cash flow', what: 'Where last month’s profit went: receivables, debt, owner draws.' },
        { name: 'Get paid faster', what: 'How much cash is tied up in receivables, and what faster collection frees up.' },
      ]}
    />
  );
}

export function TargetVsActualSection() {
  return (
    <ComingWithWorkbook
      eyebrow="Target vs. Actual Check"
      title="What happened, compared with the plan."
      intro="Run it after each month closes. It shows which line moved profit and what to watch next month."
      items={[
        { name: 'The month', what: 'Revenue, gross margin, labor, marketing and overhead: target, actual and the gap.' },
        { name: 'Impact on profit', what: 'How much each line added to or took from pretax profit, month and year to date.' },
        { name: 'Which ratio moved', what: 'Labor, marketing and overhead guardrails, target vs. actual.' },
        { name: 'What to watch', what: 'The biggest drag, the biggest help, and where to focus next month.' },
      ]}
    />
  );
}

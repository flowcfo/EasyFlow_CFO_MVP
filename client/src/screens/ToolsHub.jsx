import { Link, useParams } from 'react-router-dom';
import { ArrowRightIcon } from '../components/Icons.jsx';

// The Tools section: the decision calculators from the Profit System workbook.
const TOOLS = [
  { path: 'breakeven', name: 'Breakeven', what: 'The sales you need to cover every cost, including your pay, and hit your profit target.' },
  { path: 'pricing', name: 'Pricing', what: 'What a price change does to gross margin and profit before you make it.' },
  { path: 'hire', name: 'Hire', what: 'Whether the next hire pays for itself, and how much new work it takes.' },
  { path: 'scenarios', name: 'Scenario', what: 'Try a what-if on sales, labor or overhead and see the profit before you commit.' },
  { path: 'pay-roadmap', name: 'Owner Pay Roadmap', what: 'A staged plan to get you to your full market wage.' },
];

export default function ToolsHub() {
  const { clientId } = useParams();
  const base = clientId ? `/partner/client/${clientId}` : '/app';
  return (
    <div>
      <p className="eyebrow text-ember">Tools</p>
      <h1 className="mt-1 font-heading text-[30px] font-bold leading-[38px] text-navy">Run the numbers before you decide.</h1>
      <p className="mt-2 max-w-2xl text-lg text-slate">Each tool starts from your own numbers. Change one thing and see what it does to profit.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.path}
            to={`${base}/${t.path}`}
            className="group flex flex-col rounded-2xl bg-white p-6 shadow-card ring-1 ring-transparent transition hover:ring-cobalt"
          >
            <h2 className="font-heading text-xl font-bold text-navy">{t.name}</h2>
            <p className="mt-2 flex-1 text-slate">{t.what}</p>
            <span className="mt-4 inline-flex items-center gap-2 font-semibold text-cobalt">
              Open {t.name} <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

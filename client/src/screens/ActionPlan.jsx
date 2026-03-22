import { useGame } from '../hooks/useGame.js';
import { useAuth } from '../hooks/useAuth.js';
import { useSnapshot } from '../hooks/useSnapshot.js';
import FixQueueCard from '../components/FixQueueCard.jsx';
import ComicPanel from '../components/ComicPanel.jsx';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';
import { api } from '../utils/api.js';

function actionToPanel(action, index) {
  return {
    number: index + 1,
    type: 'action',
    caption: action.title,
    subtext: action.specific_instruction || '',
    visual: 'action_arrow',
    cta_label: `${action.category} Fix`,
    cta_screen: null,
    color: action.difficulty === 'Easy' ? 'green' : action.difficulty === 'Hard' ? 'red' : 'orange',
  };
}

export default function ActionPlan() {
  const { gameProgress, completeAction } = useGame();
  const { user } = useAuth();
  const { outputs, loading } = useSnapshot();
  const isComic = user?.response_mode !== 'classic';

  if (loading) return <SkeletonCard count={3} />;

  const actions = gameProgress?.fix_queue || outputs?.actionPlan?.actions || [];
  const totalImpact = actions.reduce((s, a) => s + (a.score_impact || 0), 0);

  async function handleExportPDF() {
    try {
      const blob = await api.post('/outputs/action-plan');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Action_Plan.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-sora text-2xl font-bold text-white">Action Plan</h1>
        <div className="flex gap-3">
          <button onClick={handleExportPDF} className="btn-secondary text-sm py-2 px-4">
            Export PDF
          </button>
        </div>
      </div>

      <div className="card-dark text-center py-4">
        <p className="font-mulish text-xs text-stone">Total Score Impact if All Completed</p>
        <p className="font-sora text-2xl text-orange font-bold">+{totalImpact} points</p>
      </div>

      <div className="space-y-4">
        {actions.length > 0 ? (
          isComic ? (
            <div className="grid gap-4 md:grid-cols-3">
              {actions.map((action, i) => (
                <div key={i} className="relative">
                  <ComicPanel panel={actionToPanel(action, i)} index={i} />
                  <div className="mt-2 px-2">
                    <FixQueueCard action={action} index={i} onComplete={completeAction} compact />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            actions.map((action, i) => (
              <div key={i} className="card-dark">
                <FixQueueCard action={action} index={i} onComplete={completeAction} />
                {action.specific_instruction && (
                  <p className="font-mulish text-sm text-stone-light mt-3 px-4 pb-2">
                    {action.specific_instruction}
                  </p>
                )}
              </div>
            ))
          )
        ) : (
          <div className="card-dark text-center py-10">
            <p className="font-mulish text-stone">No actions generated yet. Calculate your Profit Score first.</p>
          </div>
        )}
      </div>

      <div className="card-dark text-center py-8 border-t-4 border-orange">
        <p className="font-mulish text-stone-light mb-2">
          Ready to install the full system?
        </p>
        <p className="font-mulish text-white mb-4">
          Let's see the numbers play out.
        </p>
        <a
          href="https://easyflowcfo.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-block px-8 py-3"
        >
          Book a free 15-minute call
        </a>
        <p className="font-mulish text-xs text-stone mt-3">easyflowcfo.com</p>
      </div>
    </div>
  );
}

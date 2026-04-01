import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './hooks/useAuth.js';

import Landing from './screens/Landing.jsx';
import Login from './screens/Login.jsx';
import Signup from './screens/Signup.jsx';
import OnboardUpload from './screens/OnboardUpload.jsx';
import OnboardQBO from './screens/OnboardQBO.jsx';
import OnboardManual from './screens/OnboardManual.jsx';
import EmailCapture from './screens/EmailCapture.jsx';
import ScoreReveal from './screens/ScoreReveal.jsx';
import ImportConfirmation from './screens/ImportConfirmation.jsx';
import ImportFinalReview from './screens/ImportFinalReview.jsx';

import InputEngine from './screens/InputEngine.jsx';
import ProfitDashboard from './screens/ProfitDashboard.jsx';
import OwnerPayGap from './screens/OwnerPayGap.jsx';
import BreakevenCalculator from './screens/BreakevenCalculator.jsx';
import ProductivityScorecard from './screens/ProductivityScorecard.jsx';
import ProfitLeaksFinder from './screens/ProfitLeaksFinder.jsx';
import FourForcesAllocator from './screens/FourForcesAllocator.jsx';
import ScenarioModeler from './screens/ScenarioModeler.jsx';
import TwelveMonthForecast from './screens/TwelveMonthForecast.jsx';
import ForecastView from './screens/ForecastView.jsx';
import Rolling12Screen from './screens/Rolling12Screen.jsx';
import HireCalculator from './screens/HireCalculator.jsx';
import PricingCalculator from './screens/PricingCalculator.jsx';
import WeeklyScorecard from './screens/WeeklyScorecard.jsx';
import OwnerPayRoadmap from './screens/OwnerPayRoadmap.jsx';
import ActionPlan from './screens/ActionPlan.jsx';
import IntegrationHub from './screens/IntegrationHub.jsx';

import PartnerDashboard from './partner/PartnerDashboard.jsx';
import WhiteLabelSettings from './partner/WhiteLabelSettings.jsx';
import AddonSettings from './partner/AddonSettings.jsx';

import DashboardLayout from './components/DashboardLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import TierGate from './components/TierGate.jsx';

function PartnerRoute({ children }) {
  const { user } = useAuth();
  if (user?.user_type !== 'partner') {
    return <Navigate to="/app/dashboard" replace />;
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="skeleton w-16 h-16 rounded-full" />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboard/upload" element={<OnboardUpload />} />
        <Route path="/onboard/qbo" element={<OnboardQBO />} />
        <Route path="/onboard/manual" element={<OnboardManual />} />
        <Route path="/onboard/email" element={<EmailCapture />} />
        <Route path="/onboard/reveal" element={<ScoreReveal />} />
        <Route path="/import/confirm" element={<ImportConfirmation />} />
        <Route path="/import/final-review" element={<ImportFinalReview />} />

        <Route path="/app" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="input" replace />} />
          {/* Free tier: Screens 1-3 */}
          <Route path="input" element={<InputEngine />} />
          <Route path="dashboard" element={<ProfitDashboard />} />
          <Route path="owner-pay-gap" element={<OwnerPayGap />} />
          {/* Clarity tier ($19.99): Diagnosis + Forecast + Pricing */}
          <Route path="breakeven" element={<TierGate required="clarity"><BreakevenCalculator /></TierGate>} />
          <Route path="productivity" element={<TierGate required="clarity"><ProductivityScorecard /></TierGate>} />
          <Route path="leaks" element={<TierGate required="clarity"><ProfitLeaksFinder /></TierGate>} />
          <Route path="forecast" element={<TierGate required="clarity"><ForecastView /></TierGate>} />
          <Route path="forecast-classic" element={<TierGate required="clarity"><TwelveMonthForecast /></TierGate>} />
          <Route path="rolling12" element={<TierGate required="clarity"><Rolling12Screen /></TierGate>} />
          <Route path="pricing" element={<TierGate required="clarity"><PricingCalculator /></TierGate>} />
          {/* Control tier ($49.99): Planning + AI */}
          <Route path="four-forces" element={<TierGate required="control"><FourForcesAllocator /></TierGate>} />
          <Route path="scenarios" element={<TierGate required="control"><ScenarioModeler /></TierGate>} />
          <Route path="action-plan" element={<TierGate required="control"><ActionPlan /></TierGate>} />
          {/* Harvest tier ($99.99): Decision tools + Weekly */}
          <Route path="hire" element={<TierGate required="harvest"><HireCalculator /></TierGate>} />
          <Route path="weekly" element={<TierGate required="harvest"><WeeklyScorecard /></TierGate>} />
          <Route path="pay-roadmap" element={<TierGate required="harvest"><OwnerPayRoadmap /></TierGate>} />
          {/* Integrations (Clarity+) */}
          <Route path="integrations" element={<TierGate required="clarity"><IntegrationHub /></TierGate>} />
        </Route>

        {/* Partner Routes */}
        <Route path="/partner" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PartnerRoute><PartnerDashboard /></PartnerRoute>} />
          <Route path="whitelabel" element={<PartnerRoute><WhiteLabelSettings /></PartnerRoute>} />
          <Route path="addons" element={<PartnerRoute><AddonSettings /></PartnerRoute>} />
          <Route path="client/:clientId" element={<PartnerRoute><ProfitDashboard /></PartnerRoute>} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

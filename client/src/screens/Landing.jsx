import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProfitGauge from '../components/ProfitGauge.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../utils/api.js';

export default function Landing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [partnerBrand, setPartnerBrand] = useState(null);

  const partnerId = searchParams.get('partner');

  useEffect(() => {
    if (partnerId) {
      loadPartnerBrand();
    }
  }, [partnerId]);

  async function loadPartnerBrand() {
    try {
      const data = await api.get(`/auth/partner-brand/${partnerId}`);
      setPartnerBrand(data);
    } catch (err) {
      // Fall back to default branding
    }
  }

  if (user) {
    if (user.user_type === 'partner') {
      navigate('/partner/dashboard', { replace: true });
    } else {
      navigate('/app/dashboard', { replace: true });
    }
    return null;
  }

  const brandName = partnerBrand?.brand_name || 'Easy Numbers';
  const primaryColor = partnerBrand?.primary_color || '#F05001';
  const uploadPath = partnerId ? `/onboard/upload?partner=${partnerId}` : '/onboard/upload';
  const qboPath = partnerId ? `/onboard/qbo?partner=${partnerId}` : '/onboard/qbo';
  const manualPath = partnerId ? `/onboard/manual?partner=${partnerId}` : '/onboard/manual';

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4 relative">
      <div className="absolute top-6 right-6 flex gap-3">
        <button
          onClick={() => navigate('/login')}
          className="font-mulish text-sm text-stone hover:text-white transition px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
        >
          Log in
        </button>
        <button
          onClick={() => navigate('/signup')}
          className="font-mulish text-sm text-white bg-orange hover:bg-orange/90 transition px-3 py-1.5 rounded-lg font-semibold"
        >
          Sign up
        </button>
      </div>
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {partnerBrand?.logo_url && (
          <motion.img
            src={partnerBrand.logo_url}
            alt={brandName}
            className="h-12 mx-auto mb-6 object-contain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          />
        )}

        <motion.h1
          className="font-sora text-3xl md:text-4xl font-bold text-white mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          What is your Profit Score?
        </motion.h1>

        <motion.div
          className="mb-10"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <ProfitGauge score={0} size={240} animated={false} pulsing color={primaryColor} />
        </motion.div>

        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <button
            onClick={() => navigate(uploadPath)}
            className="btn-primary w-full text-lg py-4"
            style={partnerBrand ? { backgroundColor: primaryColor } : {}}
          >
            Upload your P&L. Find out in 60 seconds.
          </button>

          <button
            onClick={() => navigate(qboPath)}
            className="btn-secondary w-full py-3"
          >
            Connect QuickBooks instead
          </button>

          <button
            onClick={() => navigate(manualPath)}
            className="btn-ghost w-full text-sm text-stone/60 hover:text-white"
          >
            No file? Enter numbers manually.
          </button>
        </motion.div>

        <motion.p
          className="font-mulish text-sm text-stone mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Free. No credit card. Takes 2 minutes.
        </motion.p>

        {partnerBrand && (
          <motion.p
            className="font-mulish text-xs text-stone mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            Powered by Easy Numbers Profit System
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

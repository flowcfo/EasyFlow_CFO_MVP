import { createContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../utils/api.js';

export const PartnerContext = createContext(null);

export function PartnerProvider({ children }) {
  const { user } = useAuth();
  const [partner, setPartner] = useState(null);
  const [brandConfig, setBrandConfig] = useState(null);
  const [loading, setLoading] = useState(false);

  const isPartner = user?.user_type === 'partner';
  const isClient = user?.user_type === 'client';

  useEffect(() => {
    if (isPartner) {
      loadPartnerData();
    } else if (isClient && user?.managed_by_partner_id) {
      loadClientBrandConfig();
    }
  }, [user?.id, user?.user_type]);

  async function loadPartnerData() {
    setLoading(true);
    try {
      const config = await api.get('/partner/whitelabel');
      setPartner({ ...config, isPartner: true });
      setBrandConfig(config);
    } catch (err) {
      console.error('Failed to load partner data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadClientBrandConfig() {
    try {
      const data = await api.get('/auth/me');
      if (data.brand_config) {
        setBrandConfig(data.brand_config);
      }
    } catch (err) {
      // Client brand config loaded from auth/me
    }
  }

  function updatePartner(updates) {
    setPartner((prev) => ({ ...prev, ...updates }));
    setBrandConfig((prev) => ({ ...prev, ...updates }));
  }

  return (
    <PartnerContext.Provider value={{
      partner,
      brandConfig,
      isPartner,
      isClient,
      loading,
      updatePartner,
    }}>
      {children}
    </PartnerContext.Provider>
  );
}

import { useContext } from 'react';
import { PartnerContext } from '../context/PartnerContext.jsx';

export function usePartner() {
  const context = useContext(PartnerContext);
  if (!context) {
    throw new Error('usePartner must be used within a PartnerProvider');
  }
  return context;
}

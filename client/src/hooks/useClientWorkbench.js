import { useContext } from 'react';
import { ClientWorkbenchContext } from '../context/ClientWorkbenchContext.jsx';

/**
 * Strict accessor for the partner-side workbench context. Use this only inside
 * components rendered under <ClientWorkbenchProvider /> (the partner client
 * layout and its modals). Screen components should call useWorkbench()
 * instead so they keep working under both /app and /partner/client routes.
 */
export function useClientWorkbench() {
  const ctx = useContext(ClientWorkbenchContext);
  if (!ctx) {
    throw new Error(
      'useClientWorkbench must be used inside ClientWorkbenchProvider',
    );
  }
  return ctx;
}

import { useContext } from 'react';
import { ClientWorkbenchContext } from '../context/ClientWorkbenchContext.jsx';
import { SnapshotContext } from '../context/SnapshotContext.jsx';

/**
 * Unified data hook used by every Easy Numbers screen.
 *
 * Inside /partner/client/:clientId/* the ClientWorkbenchProvider is mounted,
 * so this returns the per-client draft context. Everywhere else the regular
 * SnapshotContext is returned, untouched.
 *
 * Both contexts expose the same surface (inputs, outputs, calculate,
 * updateInputs, setQBOInputs, monthlyHistory, fieldSources, ...), so screens
 * stay drop-in.
 */
export function useWorkbench() {
  const workbench = useContext(ClientWorkbenchContext);
  if (workbench) return workbench;

  const snapshot = useContext(SnapshotContext);
  if (snapshot) return snapshot;

  throw new Error(
    'useWorkbench must be used inside a ClientWorkbenchProvider or SnapshotProvider',
  );
}

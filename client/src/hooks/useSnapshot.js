import { useContext } from 'react';
import { SnapshotContext } from '../context/SnapshotContext.jsx';

export function useSnapshot() {
  const context = useContext(SnapshotContext);
  if (!context) throw new Error('useSnapshot must be used within SnapshotProvider');
  return context;
}

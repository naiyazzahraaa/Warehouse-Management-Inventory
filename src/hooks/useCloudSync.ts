import { useState, useEffect } from 'react';
import { cloudSync } from '../services/cloudSync';
import { SyncInfo } from '../types';

export function useCloudSync() {
  const [syncInfo, setSyncInfo] = useState<SyncInfo>(cloudSync.getSyncInfo());

  useEffect(() => {
    const unsubscribe = cloudSync.subscribeSyncInfo((newInfo) => {
      setSyncInfo(newInfo);
    });
    return unsubscribe;
  }, []);

  return syncInfo;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';

const OFFLINE_QUEUE_KEY = 'comanda_offline_queue';

export interface OfflineAction {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retries: number;
}

export const offlineStore = {
  async getQueue(): Promise<OfflineAction[]> {
    try {
      const queue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (e) {
      console.error('Error reading offline queue:', e);
      return [];
    }
  },

  async addToQueue(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retries'>) {
    const queue = await this.getQueue();
    const newAction: OfflineAction = {
      ...action,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(newAction);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log('[Offline] Action added to queue:', newAction.table, newAction.action);
    return newAction;
  },

  async removeFromQueue(id: string) {
    const queue = await this.getQueue();
    const newQueue = queue.filter(a => a.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
  },

  async sync() {
    const queue = await this.getQueue();
    if (queue.length === 0) return;

    console.log(`[Offline] Syncing ${queue.length} actions...`);

    for (const action of queue) {
      try {
        let error;
        if (action.action === 'insert') {
          ({ error } = await (supabase as any).from(action.table).insert(action.data));
        } else if (action.action === 'update') {
          ({ error } = await (supabase as any).from(action.table).update(action.data).match({ id: action.data.id }));
        }

        if (!error) {
          await this.removeFromQueue(action.id);
          console.log(`[Offline] Synced action: ${action.table} ${action.action}`);
        } else {
          console.warn(`[Offline] Sync failed for action ${action.id}:`, error);
          // Opcional: Incrementar retries
        }
      } catch (e) {
        console.error(`[Offline] Error during sync of action ${action.id}:`, e);
      }
    }
  }
};

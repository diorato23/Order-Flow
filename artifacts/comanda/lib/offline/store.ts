import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';

const OFFLINE_QUEUE_KEY = 'comanda_offline_queue';
const MAX_RETRIES = 3;

export interface OfflineAction {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

export const offlineStore = {
  async getQueue(): Promise<OfflineAction[]> {
    try {
      const queue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch {
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
    if (__DEV__) console.log('[Offline] Queued:', newAction.table, newAction.action);
    return newAction;
  },

  async removeFromQueue(id: string) {
    const queue = await this.getQueue();
    const newQueue = queue.filter(a => a.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
  },

  async incrementRetry(id: string) {
    const queue = await this.getQueue();
    const action = queue.find(a => a.id === id);
    if (action) {
      action.retries += 1;
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  },

  async sync() {
    const queue = await this.getQueue();
    if (queue.length === 0) return;

    if (__DEV__) console.log(`[Offline] Syncing ${queue.length} actions...`);

    for (const action of queue) {
      if (action.retries >= MAX_RETRIES) {
        if (__DEV__) console.warn(`[Offline] Max retries reached for ${action.id}, removing`);
        await this.removeFromQueue(action.id);
        continue;
      }

      try {
        let error;
        if (action.action === 'insert') {
          ({ error } = await supabase.from(action.table as any).insert(action.data as any));
        } else if (action.action === 'update') {
          const { id: rowId, ...rest } = action.data;
          ({ error } = await supabase.from(action.table as any).update(rest as any).eq('id', rowId as string));
        } else if (action.action === 'delete') {
          ({ error } = await supabase.from(action.table as any).delete().eq('id', action.data.id as string));
        }

        if (!error) {
          await this.removeFromQueue(action.id);
          if (__DEV__) console.log(`[Offline] Synced: ${action.table} ${action.action}`);
        } else {
          await this.incrementRetry(action.id);
          if (__DEV__) console.warn(`[Offline] Failed (retry ${action.retries + 1}/${MAX_RETRIES}):`, error.message);
        }
      } catch {
        await this.incrementRetry(action.id);
      }
    }
  },
};

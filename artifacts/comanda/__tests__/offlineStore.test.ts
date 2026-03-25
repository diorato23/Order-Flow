import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStore, OfflineAction } from '../lib/offline/store';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock supabase
jest.mock('../lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

describe('offlineStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getQueue', () => {
    it('retorna array vazio quando não há fila', async () => {
      mockGetItem.mockResolvedValue(null);
      const queue = await offlineStore.getQueue();
      expect(queue).toEqual([]);
    });

    it('retorna fila existente do AsyncStorage', async () => {
      const mockQueue: OfflineAction[] = [
        { id: 'abc', table: 'comanda_pedidos', action: 'insert', data: { nome: 'Test' }, timestamp: Date.now(), retries: 0 },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(mockQueue));

      const queue = await offlineStore.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].table).toBe('comanda_pedidos');
    });

    it('retorna array vazio em caso de erro', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));
      const queue = await offlineStore.getQueue();
      expect(queue).toEqual([]);
    });
  });

  describe('addToQueue', () => {
    it('adiciona ação à fila com id, timestamp e retries=0', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([]));

      const action = await offlineStore.addToQueue({
        table: 'comanda_pedidos',
        action: 'insert',
        data: { nome: 'Pedido 1' },
      });

      expect(action.id).toBeDefined();
      expect(action.retries).toBe(0);
      expect(action.timestamp).toBeGreaterThan(0);
      expect(mockSetItem).toHaveBeenCalledWith(
        'comanda_offline_queue',
        expect.stringContaining('Pedido 1')
      );
    });
  });

  describe('removeFromQueue', () => {
    it('remove ação específica pelo id', async () => {
      const mockQueue: OfflineAction[] = [
        { id: 'a1', table: 'test', action: 'insert', data: {}, timestamp: 1, retries: 0 },
        { id: 'a2', table: 'test', action: 'update', data: {}, timestamp: 2, retries: 0 },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(mockQueue));

      await offlineStore.removeFromQueue('a1');

      const savedQueue = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].id).toBe('a2');
    });
  });

  describe('incrementRetry', () => {
    it('incrementa retries de uma ação', async () => {
      const mockQueue: OfflineAction[] = [
        { id: 'r1', table: 'test', action: 'insert', data: {}, timestamp: 1, retries: 1 },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(mockQueue));

      await offlineStore.incrementRetry('r1');

      const savedQueue = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(savedQueue[0].retries).toBe(2);
    });
  });

  describe('sync', () => {
    it('não faz nada quando fila está vazia', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([]));

      await offlineStore.sync();

      // setItem não deve ser chamado (nada para sincronizar)
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('remove ações que excederam max retries (3)', async () => {
      const mockQueue: OfflineAction[] = [
        { id: 'expired', table: 'test', action: 'insert', data: {}, timestamp: 1, retries: 3 },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(mockQueue));

      await offlineStore.sync();

      // A ação deve ter sido removida (removeFromQueue chamou setItem)
      expect(mockSetItem).toHaveBeenCalled();
    });
  });
});

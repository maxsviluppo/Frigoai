
import { InventoryItem } from '../types';

const DB_NAME = 'FridgeMasterDB';
const STORE_NAME = 'inventory';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveInventoryToDB = async (inventory: InventoryItem[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Pulizia e inserimento (approccio semplice per questo contesto)
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
      inventory.forEach((item) => {
        store.add(item);
      });
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const loadInventoryFromDB = async (): Promise<InventoryItem[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const savePreference = (key: string, value: string) => {
  localStorage.setItem(key, value);
};

export const getPreference = (key: string): string | null => {
  return localStorage.getItem(key);
};

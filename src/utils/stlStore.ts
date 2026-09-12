export interface StlModel {
  id: string;
  name: string;
  description: string;
  tags: string[];
  source: 'sample' | 'user';
  url?: string;
  data?: Blob;
  addedAt?: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('stl-viewer-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('models')) {
        db.createObjectStore('models', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction('models', mode);
        const store = tx.objectStore('models');
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export function getAllModels(): Promise<StlModel[]> {
  return run<StlModel[]>('readonly', (store) => store.getAll() as IDBRequest<StlModel[]>);
}

export function putModel(model: StlModel): Promise<IDBValidKey> {
  return run<IDBValidKey>('readwrite', (store) => store.put(model));
}

export function deleteModel(id: string): Promise<undefined> {
  return run<undefined>('readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}
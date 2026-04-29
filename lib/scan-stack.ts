// Persistance locale du "stack" de scans en attente d'envoi.
// Permet au chef de prendre 5 photos d'affilée sans réseau, fermer l'app,
// revenir plus tard et envoyer le lot. Aucune dépendance, IDB natif.
//
// On stocke directement le File (qui est un Blob avec name/type) — IDB le
// gère nativement, pas besoin de base64.

const DB_NAME = "yield-scan-stack";
const DB_VERSION = 1;
const STORE = "photos";

export type StackItem = {
  id: string;
  file: File;
  fileName: string;
  addedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB non disponible"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("addedAt", "addedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then(db => db.transaction(STORE, mode).objectStore(STORE));
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addToStack(file: File): Promise<StackItem> {
  const item: StackItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    fileName: file.name || "scan.jpg",
    addedAt: Date.now(),
  };
  const store = await tx("readwrite");
  await promisify(store.add(item));
  return item;
}

export async function listStack(): Promise<StackItem[]> {
  try {
    const store = await tx("readonly");
    const items = await promisify(store.getAll() as IDBRequest<StackItem[]>);
    return items.sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    // IDB indispo (mode privé Safari, etc.) — pas un crash, juste pas de stack
    return [];
  }
}

export async function removeFromStack(id: string): Promise<void> {
  try {
    const store = await tx("readwrite");
    await promisify(store.delete(id));
  } catch {
    // silencieux : on ne veut pas bloquer le UX si IDB plante
  }
}

export async function clearStack(): Promise<void> {
  try {
    const store = await tx("readwrite");
    await promisify(store.clear());
  } catch {
    // silencieux
  }
}

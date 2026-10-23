import { RecordingClip } from './types';

const DB_NAME = 'QuranStreamDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecordingClip(clip: RecordingClip): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // IndexedDB stores raw Blob directly without memory leak
    const record = {
      id: clip.id,
      stationId: clip.stationId,
      stationName: clip.stationName,
      timestamp: clip.timestamp,
      duration: clip.duration,
      sizeBytes: clip.sizeBytes,
      format: clip.format,
      blob: clip.blob,
    };

    store.put(record);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to save to IndexedDB, fallback to memory:', e);
  }
}

export async function getAllRecordingClips(): Promise<RecordingClip[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result || [];
        const clips: RecordingClip[] = results
          .map((r: { id: string; stationId: string; stationName: string; timestamp: number; duration: number; sizeBytes: number; format: 'mp3' | 'webm' | 'm4a'; blob: Blob }) => ({
            id: r.id,
            stationId: r.stationId,
            stationName: r.stationName,
            timestamp: r.timestamp,
            duration: r.duration,
            sizeBytes: r.sizeBytes,
            format: r.format,
            blob: r.blob,
            url: URL.createObjectURL(r.blob),
          }))
          .sort((a, b) => b.timestamp - a.timestamp);
        resolve(clips);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Failed to read from IndexedDB:', e);
    return [];
  }
}

export async function deleteRecordingClip(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to delete from IndexedDB:', e);
  }
}

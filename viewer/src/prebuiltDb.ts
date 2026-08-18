import initSqlJs, { type Database } from "sql.js";
import { ungzip } from "pako";

const WASM_URL = "/sql-wasm.wasm";
// Deliberately not named "*.gz" - some static file servers (including Vite's
// own dev server) auto-detect that extension and transparently decompress it
// via a Content-Encoding response header before our JS ever sees the bytes,
// which would break our own explicit pako.ungzip() call below. An unrecognized
// extension guarantees we always receive the raw compressed bytes ourselves,
// consistently across dev and whichever static host this ends up deployed to.
const DB_URL = "/data/flat.sqlite.gzbin";
const CACHE_NAME = "ppr-sqlite-cache-v2";

export interface PrebuiltLoadProgress {
  phase: "downloading" | "decompressing" | "opening";
  bytesLoaded: number;
  totalBytes: number;
  fromCache: boolean;
}

export async function loadPrebuiltDatabase(
  onProgress: (progress: PrebuiltLoadProgress) => void
): Promise<Database> {
  const [SQL, compressed] = await Promise.all([
    initSqlJs({ locateFile: () => WASM_URL }),
    fetchWithCache(onProgress),
  ]);

  onProgress({ phase: "decompressing", bytesLoaded: compressed.length, totalBytes: compressed.length, fromCache: false });
  const bytes = ungzip(compressed);

  onProgress({ phase: "opening", bytesLoaded: bytes.length, totalBytes: bytes.length, fromCache: false });
  return new SQL.Database(bytes);
}

async function fetchWithCache(
  onProgress: (progress: PrebuiltLoadProgress) => void
): Promise<Uint8Array> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(DB_URL);
  if (cached) {
    const buffer = await cached.arrayBuffer();
    onProgress({ phase: "downloading", bytesLoaded: buffer.byteLength, totalBytes: buffer.byteLength, fromCache: true });
    return new Uint8Array(buffer);
  }

  const response = await fetch(DB_URL);
  const cachePut = cache.put(DB_URL, response.clone());
  const totalBytes = Number(response.headers.get("content-length") ?? 0);
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let bytesLoaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytesLoaded += value.length;
    onProgress({ phase: "downloading", bytesLoaded, totalBytes, fromCache: false });
  }

  const merged = new Uint8Array(bytesLoaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  await cachePut;
  return merged;
}

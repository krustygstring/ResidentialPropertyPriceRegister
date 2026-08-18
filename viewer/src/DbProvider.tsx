import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import type { Database } from "sql.js";
import { loadPrebuiltDatabase, type PrebuiltLoadProgress } from "./prebuiltDb";
import "./App.css";

const DbContext = createContext<Database | null>(null);

export function useDb(): Database {
  const db = useContext(DbContext);
  if (!db) {
    throw new Error("useDb must be used within DbProvider");
  }
  return db;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export default function DbProvider() {
  const [db, setDb] = useState<Database | null>(null);
  const [progress, setProgress] = useState<PrebuiltLoadProgress>({
    phase: "downloading",
    bytesLoaded: 0,
    totalBytes: 0,
    fromCache: false,
  });
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadPrebuiltDatabase(setProgress)
      .then(setDb)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <div className="status-screen">
        <p>Failed to load data: {error}</p>
      </div>
    );
  }

  if (!db) {
    return (
      <div className="status-screen">
        <p>
          {progress.phase === "downloading"
            ? progress.fromCache
              ? "Loading cached database…"
              : "Downloading database…"
            : progress.phase === "decompressing"
              ? "Decompressing database…"
              : "Opening database…"}
        </p>
        <p className="rows-loaded">
          {formatMB(progress.bytesLoaded)} MB
          {progress.totalBytes > 0 ? ` / ${formatMB(progress.totalBytes)} MB` : ""}
        </p>
      </div>
    );
  }

  return (
    <DbContext.Provider value={db}>
      <Outlet />
    </DbContext.Provider>
  );
}

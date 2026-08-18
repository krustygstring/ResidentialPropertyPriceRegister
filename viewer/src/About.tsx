import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useDb } from "./DbProvider";
import { query } from "./sqlite";
import "./About.css";

function useImportDate(): string | null {
  const db = useDb();
  return useMemo(() => {
    const rows = query<{ value: string }>(db, "SELECT value FROM metadata WHERE key = 'import_date'");
    const isoDate = rows[0]?.value;
    if (!isoDate) return null;
    return new Date(isoDate).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" });
  }, [db]);
}

export default function About() {
  const importDate = useImportDate();

  return (
    <div className="about-page">
      <Link to="/" className="back-link">
        « Back to search
      </Link>

      <h1>About</h1>
      <p>
        This is a browser-based viewer for Ireland's Residential Property Price Register. It
        lists the date of sale, price, and address of every residential property purchase in
        Ireland recorded since 1 January 2010, as declared to the Revenue Commissioners for
        stamp duty purposes.
      </p>
      <p>
        You can search across address, county, eircode, and description; filter by date range,
        county, or price; sort, resize, and choose which columns to display.
      </p>

      <h2>How it works</h2>
      <p>
        The app runs entirely in your browser — there's no server. The full dataset is
        pre-built into a compressed SQLite database, downloaded once and queried locally using
        SQLite compiled to WebAssembly. After your first visit, the database is cached so
        later visits load almost instantly.
      </p>

      <h2>Data source</h2>
      <p>
        Data is sourced from the official{" "}
        <a href="https://www.propertypriceregister.ie/" target="_blank" rel="noreferrer">
          Residential Property Price Register
        </a>
        , maintained by the Property Services Regulatory Authority (PSRA). The register is
        updated weekly on their site; this app reflects a snapshot from whenever it was last
        rebuilt, not a live feed.
        {importDate && (
          <>
            {" "}
            This snapshot was imported on <strong>{importDate}</strong>.
          </>
        )}
      </p>
    </div>
  );
}

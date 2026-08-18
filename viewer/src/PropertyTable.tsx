import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Database } from "sql.js";
import { query } from "./sqlite";
import MultiSelectDropdown from "./MultiSelectDropdown";
import Dialog from "./Dialog";
import "./PropertyTable.css";

interface PropertyRow {
  id: number;
  sale_date: string;
  address: string;
  county: string;
  eircode: string;
  price: number | null;
  not_full_market_price: string;
  vat_exclusive: string;
  description: string;
  property_size_description: string;
}

interface Column {
  key: keyof PropertyRow | "sale_date_sort";
  label: string;
  sortColumn: string;
  defaultWidth: number;
  defaultVisible: boolean;
  format?: (row: PropertyRow) => string;
}

const COLUMNS: Column[] = [
  { key: "sale_date", label: "Date of Sale", sortColumn: "sale_date_sort", defaultWidth: 120, defaultVisible: true },
  { key: "address", label: "Address", sortColumn: "address", defaultWidth: 280, defaultVisible: true },
  { key: "county", label: "County", sortColumn: "county", defaultWidth: 110, defaultVisible: true },
  { key: "eircode", label: "Eircode", sortColumn: "eircode", defaultWidth: 110, defaultVisible: true },
  {
    key: "price",
    label: "Price",
    sortColumn: "price",
    defaultWidth: 130,
    defaultVisible: true,
    format: (row) =>
      row.price == null
        ? ""
        : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(
            row.price
          ),
  },
  {
    key: "not_full_market_price",
    label: "Not Full Market Price",
    sortColumn: "not_full_market_price",
    defaultWidth: 170,
    defaultVisible: false,
  },
  { key: "vat_exclusive", label: "VAT Exclusive", sortColumn: "vat_exclusive", defaultWidth: 120, defaultVisible: false },
  { key: "description", label: "Description", sortColumn: "description", defaultWidth: 240, defaultVisible: false },
  {
    key: "property_size_description",
    label: "Property Size",
    sortColumn: "property_size_description",
    defaultWidth: 220,
    defaultVisible: false,
  },
];

const MIN_COLUMN_WIDTH = 60;
const SEARCHABLE_COLUMNS = ["address", "county", "eircode", "description", "property_size_description"];
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

type SortDirection = "ASC" | "DESC";
type QueryParam = string | number;

export default function PropertyTable({ db }: { db: Database }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [countyOptions, setCountyOptions] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(
    COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );
  const [sortColumn, setSortColumn] = useState("sale_date_sort");
  const [sortDirection, setSortDirection] = useState<SortDirection>("DESC");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => visibleColumnKeys.includes(c.key)),
    [visibleColumnKeys]
  );
  const totalTableWidth = visibleColumns.reduce((sum, c) => sum + (columnWidths[c.key] ?? c.defaultWidth), 0);

  useEffect(() => {
    const result = query<{ county: string }>(
      db,
      "SELECT DISTINCT county FROM properties WHERE county != '' ORDER BY county"
    );
    setCountyOptions(result.map((r) => r.county));
  }, [db]);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { whereClause, params } = useMemo(() => {
    const conditions: string[] = [];
    const params: QueryParam[] = [];

    if (search) {
      const like = `%${search}%`;
      conditions.push(`(${SEARCHABLE_COLUMNS.map((col) => `${col} LIKE ?`).join(" OR ")})`);
      params.push(...SEARCHABLE_COLUMNS.map(() => like));
    }
    if (dateFrom) {
      conditions.push("sale_date_sort >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push("sale_date_sort <= ?");
      params.push(dateTo);
    }
    if (selectedCounties.length > 0) {
      conditions.push(`county IN (${selectedCounties.map(() => "?").join(", ")})`);
      params.push(...selectedCounties);
    }
    if (priceMin) {
      conditions.push("price >= ?");
      params.push(Number(priceMin));
    }
    if (priceMax) {
      conditions.push("price <= ?");
      params.push(Number(priceMax));
    }

    return {
      whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
      params,
    };
  }, [search, dateFrom, dateTo, selectedCounties, priceMin, priceMax]);

  useEffect(() => {
    setPage(0);
  }, [whereClause]);

  useEffect(() => {
    const countResult = query<{ total: number }>(
      db,
      `SELECT COUNT(*) as total FROM properties ${whereClause}`,
      params
    );
    setTotalCount(countResult[0]?.total ?? 0);
  }, [db, whereClause, params]);

  useEffect(() => {
    const offset = page * pageSize;
    const data = query<PropertyRow>(
      db,
      `SELECT * FROM properties ${whereClause} ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    setRows(data);
  }, [db, whereClause, params, sortColumn, sortDirection, page, pageSize]);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const resizing = resizingRef.current;
      if (!resizing) return;
      const delta = event.clientX - resizing.startX;
      setColumnWidths((prev) => ({
        ...prev,
        [resizing.key]: Math.max(MIN_COLUMN_WIDTH, resizing.startWidth + delta),
      }));
    }
    function handleMouseUp() {
      resizingRef.current = null;
    }
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Whenever the set of visible columns changes (including first mount), fill
  // the available width by distributing it proportionally using each column's
  // default width as a weight - this is the "reset to a sensible fill layout"
  // moment, since a newly shown/hidden column has no manually-chosen width yet.
  // useLayoutEffect avoids a visible flash of the unfilled default widths.
  useLayoutEffect(() => {
    const container = tableScrollRef.current;
    if (!container) return;
    const availableWidth = container.clientWidth;
    if (availableWidth <= 0) return;
    const totalWeight = visibleColumns.reduce((sum, c) => sum + c.defaultWidth, 0);
    setColumnWidths((prev) => {
      const next = { ...prev };
      for (const col of visibleColumns) {
        next[col.key] = Math.max(MIN_COLUMN_WIDTH, Math.round((col.defaultWidth / totalWeight) * availableWidth));
      }
      return next;
    });
  }, [visibleColumns]);

  // Keep filling the width as the window/container is resized, preserving the
  // current relative proportions between columns (including any the user has
  // manually dragged) rather than resetting them to the default weights.
  useEffect(() => {
    const container = tableScrollRef.current;
    if (!container) return;
    let previousWidth = container.clientWidth;
    const observer = new ResizeObserver((entries) => {
      const newWidth = entries[0].contentRect.width;
      if (newWidth <= 0 || Math.abs(newWidth - previousWidth) < 1) return;
      previousWidth = newWidth;
      setColumnWidths((prev) => {
        const totalCurrent = visibleColumns.reduce((sum, c) => sum + (prev[c.key] ?? c.defaultWidth), 0);
        if (totalCurrent <= 0) return prev;
        const next = { ...prev };
        for (const col of visibleColumns) {
          const ratio = (prev[col.key] ?? col.defaultWidth) / totalCurrent;
          next[col.key] = Math.max(MIN_COLUMN_WIDTH, Math.round(ratio * newWidth));
        }
        return next;
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [visibleColumns]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const activeFilterCount = [dateFrom || dateTo, selectedCounties.length > 0, priceMin || priceMax].filter(
    Boolean
  ).length;
  const hasActiveFilters = activeFilterCount > 0;

  function handleSort(column: Column) {
    if (sortColumn === column.sortColumn) {
      setSortDirection((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortColumn(column.sortColumn);
      setSortDirection("ASC");
    }
    setPage(0);
  }

  function startResize(event: React.MouseEvent, key: string) {
    event.preventDefault();
    event.stopPropagation();
    resizingRef.current = { key, startX: event.clientX, startWidth: columnWidths[key] };
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setSelectedCounties([]);
    setPriceMin("");
    setPriceMax("");
  }

  return (
    <div className="property-table">
      <div className="toolbar">
        <input
          type="text"
          placeholder="Search address, county, eircode, description..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="search-input"
        />
        <button
          type="button"
          className={`filters-toggle ${hasActiveFilters ? "active" : ""}`}
          onClick={() => setFiltersOpen(true)}
        >
          Filters{hasActiveFilters ? ` (${activeFilterCount})` : ""}
        </button>
        <MultiSelectDropdown
          label="Columns"
          options={COLUMNS.map((c) => ({ value: c.key, label: c.label }))}
          selected={visibleColumnKeys}
          onChange={(next) => setVisibleColumnKeys(next.length > 0 ? next : visibleColumnKeys)}
        />
        <span className="result-count">
          {totalCount.toLocaleString()} result{totalCount === 1 ? "" : "s"}
        </span>
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div className="filter-dialog-body">
          <div className="filter-group">
            <label className="filter-label">Date of Sale</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span className="filter-separator">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="filter-group">
            <label className="filter-label">County</label>
            <MultiSelectDropdown
              label="All counties"
              options={countyOptions.map((c) => ({ value: c, label: c }))}
              selected={selectedCounties}
              onChange={setSelectedCounties}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Price</label>
            <input
              type="number"
              placeholder="Min €"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              className="price-input"
            />
            <span className="filter-separator">to</span>
            <input
              type="number"
              placeholder="Max €"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="price-input"
            />
          </div>
        </div>

        <div className="filter-dialog-actions">
          <button type="button" className="clear-filters" onClick={clearFilters} disabled={!hasActiveFilters}>
            Clear filters
          </button>
          <button type="button" className="filters-done" onClick={() => setFiltersOpen(false)}>
            Done
          </button>
        </div>
      </Dialog>

      <div className="table-scroll" ref={tableScrollRef}>
        <table style={{ width: totalTableWidth }}>
          <colgroup>
            {visibleColumns.map((col) => (
              <col key={col.key} style={{ width: columnWidths[col.key] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {visibleColumns.map((col) => {
                const isSorted = sortColumn === col.sortColumn;
                return (
                  <th key={col.key} onClick={() => handleSort(col)} className={isSorted ? "sorted" : ""}>
                    <span className="th-label">
                      {col.label}
                      {isSorted && <span className="sort-arrow">{sortDirection === "ASC" ? " ▲" : " ▼"}</span>}
                    </span>
                    <div
                      className="resize-handle"
                      onMouseDown={(e) => startResize(e, col.key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {visibleColumns.map((col) => (
                  <td key={col.key}>{col.format ? col.format(row) : String(row[col.key as keyof PropertyRow] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button onClick={() => setPage(0)} disabled={page === 0}>
          « First
        </button>
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
          ‹ Prev
        </button>
        <span>
          Page {page + 1} of {totalPages.toLocaleString()}
        </span>
        <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
          Next ›
        </button>
        <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>
          Last »
        </button>
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

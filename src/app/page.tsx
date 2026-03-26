"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/api";
import type { DashboardData, CategoryResult, AwardResult } from "@/lib/api";
import { STATE_NAMES, stateCodeFromName } from "@/lib/states";

// ============================================================
// CHART COLORS — brand palette
// ============================================================
const COLORS = [
  "#54a2d3", "#7bbde3", "#2A5CBA", "#4e8cd4", "#1e88c7",
  "#3a6fbf", "#6db3d9", "#2980b9", "#5dade2", "#1a73b5",
  "#4a90d9", "#367ec2", "#62b3e0", "#2c72b8", "#4f97d6",
];

const TABS = [
  "Overview",
  "Spending by Sub-Agency",
  "Geographic Distribution",
  "Top Vendors & Awards",
  "Full Contract Details",
];

// ============================================================
// SHARED UI COMPONENTS
// ============================================================

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dashboard-card text-sm" style={{ minWidth: 160 }}>
      <p className="font-semibold" style={{ color: "#7bbde3" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-slate-300">{formatCurrency(p.value)}</p>
      ))}
    </div>
  );
}

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function EmptyChart({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px] text-slate-500">
      <div className="text-center">
        <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm">{message || "No data for this filter combination"}</p>
      </div>
    </div>
  );
}

function MiniSpinner() {
  return <span className="inline-block w-3 h-3 border-2 border-accent/30 border-t-[#54a2d3] rounded-full animate-spin" />;
}

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">{label}</label>
      <select className="filter-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ============================================================
// FILTERED DATA TYPE
// ============================================================
interface FilteredData {
  recipients: CategoryResult[];
  naics: CategoryResult[];
  states: CategoryResult[];
  subAgencies: CategoryResult[];
  kpiTotals: { totalObligated: number; totalAwards: number; totalRecipients: number; totalSubAgencies: number };
}

// ============================================================
// MAIN DASHBOARD
// ============================================================
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Filters
  const [filterState, setFilterState] = useState("");
  const [filterSubAgency, setFilterSubAgency] = useState("");
  const [filterNaics, setFilterNaics] = useState("");
  const [filterRecipient, setFilterRecipient] = useState("");

  // Server-side filtered data
  const [filteredServerData, setFilteredServerData] = useState<FilteredData | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial comprehensive data
  useEffect(() => {
    fetch("/api/data")
      .then((r) => { if (!r.ok) throw new Error("Failed to load data"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const hasServerFilters = !!(filterState || filterSubAgency || filterNaics);
  const hasFilters = !!(filterState || filterSubAgency || filterNaics || filterRecipient);

  // Fetch filtered category data from server
  const fetchFilteredData = useCallback(async (state: string, subAgency: string, naicsFilter: string) => {
    if (!state && !subAgency && !naicsFilter) {
      setFilteredServerData(null);
      return;
    }
    setFilterLoading(true);
    try {
      const res = await fetch("/api/filtered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateCode: state ? stateCodeFromName(state) : "",
          subAgency: subAgency || "",
          naicsCode: naicsFilter ? naicsFilter.split(" - ")[0] : "",
        }),
      });
      if (!res.ok) throw new Error("Filter request failed");
      setFilteredServerData(await res.json());
    } catch (err) {
      console.error("Filter fetch error:", err);
      setFilteredServerData(null);
    } finally {
      setFilterLoading(false);
    }
  }, []);

  // Debounced filter effect
  useEffect(() => {
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => {
      fetchFilteredData(filterState, filterSubAgency, filterNaics);
    }, 400);
    return () => { if (filterTimerRef.current) clearTimeout(filterTimerRef.current); };
  }, [filterState, filterSubAgency, filterNaics, fetchFilteredData]);

  // Filter options from full data
  const filterOptions = useMemo(() => {
    if (!data) return { states: [], subAgencies: [], naics: [], recipients: [] };
    return {
      states: data.states.map((s) => s.name).sort(),
      subAgencies: data.subAgencies.map((s) => s.name).sort(),
      naics: data.naics.map((n) => `${n.code} - ${n.name}`).sort(),
      recipients: data.recipients.slice(0, 200).map((r) => r.name).sort(),
    };
  }, [data]);

  // Active display data: server-filtered or full
  const displayData = useMemo(() => {
    const source = hasServerFilters && filteredServerData ? filteredServerData : data;
    if (!source) return null;
    let { recipients, naics, states, subAgencies, kpiTotals } = source;
    if (filterRecipient && recipients) {
      recipients = recipients.filter((r) => r.name === filterRecipient);
    }
    return { recipients, naics, states, subAgencies, kpiTotals };
  }, [data, filteredServerData, hasServerFilters, filterRecipient]);

  // Build filter params for contracts endpoint
  const contractFilters = useMemo(() => ({
    stateCode: filterState ? stateCodeFromName(filterState) : "",
    subAgency: filterSubAgency || "",
    naicsCode: filterNaics ? filterNaics.split(" - ")[0] : "",
    recipientSearch: filterRecipient || "",
  }), [filterState, filterSubAgency, filterNaics, filterRecipient]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="spinner" />
        <p className="text-slate-400">Loading DoD spending data...</p>
        <p className="text-xs text-slate-500">First load may take a minute while data is fetched from USASpending.gov</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-xl font-semibold">Failed to load data</div>
        <p className="text-slate-400">{error || "Unknown error"}</p>
        <button onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 rounded-lg text-white hover:opacity-80 transition"
          style={{ background: "#2A5CBA" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header style={{ background: "#03065A", borderBottom: "1px solid rgba(84,162,211,0.2)" }} className="px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">DoD Market Analysis Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Go-to-Market Solutions &middot; Data: USASpending.gov &middot; Jan 2025 &ndash; Present
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Last updated: {new Date(data.lastUpdated).toLocaleDateString()}</div>
            {(data as any).stale && (
              <div className="text-xs text-amber-400 mt-0.5">Using cached data (API temporarily unavailable)</div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ background: "#020440", borderBottom: "1px solid rgba(84,162,211,0.1)" }} className="px-6">
        <div className="max-w-[1400px] mx-auto flex gap-1 pt-2">
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`px-4 py-2.5 rounded-t-lg text-sm transition-all ${activeTab === i ? "tab-active" : "tab-inactive"}`}>
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {/* Filters */}
      <div style={{ background: "rgba(3,6,90,0.3)", borderBottom: "1px solid rgba(84,162,211,0.1)" }} className="px-6 py-3">
        <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          <FilterSelect label="State" value={filterState} options={filterOptions.states} onChange={setFilterState} />
          <FilterSelect label="Sub-Agency" value={filterSubAgency} options={filterOptions.subAgencies} onChange={setFilterSubAgency} />
          <FilterSelect label="NAICS Code" value={filterNaics} options={filterOptions.naics} onChange={setFilterNaics} />
          <FilterSelect label="Recipient" value={filterRecipient} options={filterOptions.recipients} onChange={setFilterRecipient} />
        </div>
        {hasFilters && (
          <div className="max-w-[1400px] mx-auto mt-2 flex items-center gap-3">
            <button onClick={() => { setFilterState(""); setFilterSubAgency(""); setFilterNaics(""); setFilterRecipient(""); }}
              className="text-xs hover:opacity-80 transition" style={{ color: "#54a2d3" }}>
              Clear all filters
            </button>
            {filterLoading && (
              <span className="text-xs text-slate-500 flex items-center gap-1 filter-loading">
                <MiniSpinner /> Updating charts...
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {activeTab === 0 && <OverviewTab displayData={displayData} />}
        {activeTab === 1 && <SubAgencyTab displayData={displayData} />}
        {activeTab === 2 && <GeographicTab displayData={displayData} />}
        {activeTab === 3 && <VendorsTab displayData={displayData} />}
        {activeTab === 4 && <ContractsTab filters={contractFilters} />}
      </main>
    </div>
  );
}

// ============================================================
// TAB: OVERVIEW
// ============================================================
function OverviewTab({ displayData }: { displayData: any }) {
  if (!displayData) return <EmptyChart message="Loading data..." />;

  const recipientData = displayData.recipients.slice(0, 25).map((r: any) => ({ name: r.name, amount: r.amount }));
  const naicsData = displayData.naics.slice(0, 12).map((n: any) => ({ name: n.name, amount: n.amount }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total $ Obligated" value={formatCurrency(displayData.kpiTotals.totalObligated)} />
        <KPICard label="Number of Awards" value={formatNumber(displayData.kpiTotals.totalAwards)} />
        <KPICard label="Distinct Recipients" value={formatNumber(displayData.kpiTotals.totalRecipients)} />
        <KPICard label="Sub-Agencies" value={formatNumber(displayData.kpiTotals.totalSubAgencies || 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="dashboard-card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#7bbde3" }}>Top 25 Recipients by Spending</h3>
          <div style={{ height: 550 }}>
            {recipientData.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={recipientData} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" tickFormatter={formatCurrency} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={180} tick={{ fill: "#cbd5e1", fontSize: 10 }}
                    tickFormatter={(v: string) => v.length > 28 ? v.slice(0, 26) + "..." : v} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="amount" fill="#54a2d3" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>

        <div className="dashboard-card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#7bbde3" }}>Spending by NAICS Industry</h3>
          <div style={{ height: 420 }}>
            {naicsData.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={naicsData} dataKey="amount" nameKey="name" cx="50%" cy="45%"
                    innerRadius={55} outerRadius={125} paddingAngle={2}>
                    {naicsData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Legend formatter={(value: string) => (
                    <span style={{ color: "#cbd5e1", fontSize: "11px" }}>
                      {value.length > 32 ? value.slice(0, 30) + "..." : value}
                    </span>
                  )} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB: SUB-AGENCY
// ============================================================
function SubAgencyTab({ displayData }: { displayData: any }) {
  if (!displayData) return <EmptyChart message="Loading data..." />;
  const chartData = displayData.subAgencies.map((s: any) => ({ name: s.name, amount: s.amount }));

  if (chartData.length === 0) return <div className="dashboard-card"><EmptyChart /></div>;

  return (
    <div className="space-y-6">
      <div className="dashboard-card">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#7bbde3" }}>DoD Spending by Sub-Agency</h3>
        <div style={{ height: Math.max(400, chartData.length * 30) }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <XAxis type="number" tickFormatter={formatCurrency} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={220} tick={{ fill: "#cbd5e1", fontSize: 11 }}
                tickFormatter={(v: string) => v.length > 35 ? v.slice(0, 33) + "..." : v} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="amount" fill="#2A5CBA" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dashboard-card overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#7bbde3" }}>Sub-Agency Detail</h3>
        <table className="data-table">
          <thead>
            <tr><th>Rank</th><th>Sub-Agency</th><th className="text-right">Total $ Obligated</th><th className="text-right">% of Total</th></tr>
          </thead>
          <tbody>
            {chartData.map((row: any, i: number) => {
              const total = chartData.reduce((s: number, r: any) => s + r.amount, 0);
              return (
                <tr key={i}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td className="font-medium">{row.name}</td>
                  <td className="text-right" style={{ color: "#54a2d3" }}>{formatCurrency(row.amount)}</td>
                  <td className="text-right text-slate-400">{total > 0 ? ((row.amount / total) * 100).toFixed(1) : 0}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// TAB: GEOGRAPHIC
// ============================================================
function GeographicTab({ displayData }: { displayData: any }) {
  if (!displayData) return <EmptyChart message="Loading data..." />;
  const stateData = displayData.states.map((s: any) => ({ name: s.name, code: s.code, amount: s.amount }));

  if (stateData.length === 0) return <div className="dashboard-card"><EmptyChart /></div>;

  return (
    <div className="space-y-6">
      <div className="dashboard-card">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#7bbde3" }}>Top 20 States by DoD Spending</h3>
        <div style={{ height: 600 }}>
          <ResponsiveContainer>
            <BarChart data={stateData.slice(0, 20)} layout="vertical" margin={{ left: 10, right: 30 }}>
              <XAxis type="number" tickFormatter={formatCurrency} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fill: "#cbd5e1", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="amount" fill="#54a2d3" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dashboard-card overflow-x-auto" style={{ maxHeight: 500 }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#7bbde3" }}>All States & Territories</h3>
        <table className="data-table">
          <thead>
            <tr><th>Rank</th><th>State</th><th>Code</th><th className="text-right">Total $ Obligated</th></tr>
          </thead>
          <tbody>
            {stateData.map((row: any, i: number) => (
              <tr key={i}>
                <td className="text-slate-400">{i + 1}</td>
                <td className="font-medium">{row.name}</td>
                <td className="text-slate-400">{row.code}</td>
                <td className="text-right" style={{ color: "#54a2d3" }}>{formatCurrency(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// TAB: VENDORS
// ============================================================
function VendorsTab({ displayData }: { displayData: any }) {
  if (!displayData) return <EmptyChart message="Loading data..." />;
  const recipientData = displayData.recipients.slice(0, 50).map((r: any) => ({ name: r.name, amount: r.amount }));

  if (recipientData.length === 0) return <div className="dashboard-card"><EmptyChart /></div>;

  return (
    <div className="space-y-6">
      <div className="dashboard-card">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#7bbde3" }}>Top 50 Vendors by Spending</h3>
        <div style={{ height: Math.max(500, recipientData.length * 22) }}>
          <ResponsiveContainer>
            <BarChart data={recipientData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <XAxis type="number" tickFormatter={formatCurrency} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={200} tick={{ fill: "#cbd5e1", fontSize: 9 }}
                tickFormatter={(v: string) => v.length > 30 ? v.slice(0, 28) + "..." : v} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="amount" fill="#2A5CBA" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dashboard-card overflow-x-auto" style={{ maxHeight: 500 }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#7bbde3" }}>Vendor Detail</h3>
        <table className="data-table">
          <thead>
            <tr><th>Rank</th><th>Vendor</th><th className="text-right">Total $ Obligated</th></tr>
          </thead>
          <tbody>
            {recipientData.map((row: any, i: number) => (
              <tr key={i}>
                <td className="text-slate-400">{i + 1}</td>
                <td className="font-medium">{row.name}</td>
                <td className="text-right" style={{ color: "#54a2d3" }}>{formatCurrency(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// TAB: FULL CONTRACT DETAILS — LIVE SERVER-SIDE PAGINATION
// Browses ALL 4M+ awards via USASpending API in real time
// ============================================================
function ContractsTab({ filters }: {
  filters: { stateCode: string; subAgency: string; naicsCode: string; recipientSearch: string };
}) {
  const [awards, setAwards] = useState<AwardResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [sort, setSort] = useState("Award Amount");
  const [order, setOrder] = useState("desc");
  const [searchInput, setSearchInput] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageSize = 50;

  // Fetch contracts from server
  const fetchContracts = useCallback(async (p: number, s: string, o: string, f: typeof filters, search: string) => {
    setContractLoading(true);
    setContractError(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: p,
          limit: pageSize,
          sort: s,
          order: o,
          ...f,
          recipientSearch: search || f.recipientSearch,
        }),
      });
      if (!res.ok) throw new Error("Failed to load contracts");
      const data = await res.json();
      setAwards(data.results || []);
      setHasNext(data.hasNext ?? false);
    } catch (err: any) {
      setContractError(err.message);
      setAwards([]);
    } finally {
      setContractLoading(false);
    }
  }, []);

  // Fetch on page/sort/filter changes
  useEffect(() => {
    fetchContracts(page, sort, order, filters, searchInput);
  }, [page, sort, order, filters, fetchContracts]); // eslint-disable-line

  // Debounced search
  const handleSearch = (val: string) => {
    setSearchInput(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      fetchContracts(1, sort, order, filters, val);
    }, 500);
  };

  // Sort handler
  const handleSort = (col: string) => {
    if (sort === col) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setSort(col);
      setOrder("desc");
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sort !== col) return <span className="text-slate-600 ml-1">&#8597;</span>;
    return <span className="ml-1" style={{ color: "#54a2d3" }}>{order === "desc" ? "▼" : "▲"}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" className="search-input" placeholder="Search by recipient name..."
            value={searchInput} onChange={(e) => handleSearch(e.target.value)} />
        </div>
        {contractLoading && <MiniSpinner />}
      </div>

      <p className="text-xs text-slate-400">
        Page {page} &middot; Showing {awards.length} contracts
        {contractLoading && " (loading...)"}
        {!contractLoading && !hasNext && awards.length > 0 && " (last page)"}
        <span className="text-slate-600 ml-2">
          Live data from USASpending.gov &middot; Sorted by {sort} ({order})
        </span>
      </p>

      {contractError && (
        <div className="text-red-400 text-sm dashboard-card">Error: {contractError}</div>
      )}

      {/* Table */}
      <div className="dashboard-card overflow-x-auto">
        {awards.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Award ID</th>
                <th className="sort-btn" onClick={() => handleSort("Recipient Name")}>
                  Recipient <SortIcon col="Recipient Name" />
                </th>
                <th className="text-right sort-btn" onClick={() => handleSort("Award Amount")}>
                  Amount <SortIcon col="Award Amount" />
                </th>
                <th className="sort-btn" onClick={() => handleSort("Awarding Sub Agency")}>
                  Sub-Agency <SortIcon col="Awarding Sub Agency" />
                </th>
                <th>State</th>
                <th>NAICS</th>
                <th>Type</th>
                <th className="sort-btn" onClick={() => handleSort("Start Date")}>
                  Start <SortIcon col="Start Date" />
                </th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {awards.map((a, i) => (
                <tr key={`${a["Award ID"]}-${i}`}>
                  <td className="font-mono text-xs" style={{ color: "#54a2d3" }}>{a["Award ID"]}</td>
                  <td className="font-medium max-w-[200px] truncate">{a["Recipient Name"]}</td>
                  <td className="text-right" style={{ color: "#54a2d3" }}>{formatCurrency(a["Award Amount"] || 0)}</td>
                  <td className="text-slate-300 max-w-[160px] truncate">{a["Awarding Sub Agency"]}</td>
                  <td className="text-center">{a["Place of Performance State Code"]}</td>
                  <td className="text-xs text-slate-400">{a.NAICS?.code || "—"}</td>
                  <td className="text-xs text-slate-400 max-w-[120px] truncate">{a["Contract Award Type"]}</td>
                  <td className="text-xs text-slate-400">{a["Start Date"] || "—"}</td>
                  <td className="text-xs text-slate-400">{a["End Date"] || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !contractLoading ? (
          <EmptyChart message="No contracts match the current filters." />
        ) : null}
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3 justify-center">
        <button onClick={() => setPage(1)} disabled={page === 1 || contractLoading}
          className="px-3 py-1.5 rounded text-sm border border-[rgba(84,162,211,0.3)] text-slate-300 disabled:opacity-30 hover:bg-[rgba(10,16,104,0.6)] transition"
          style={{ background: "#03065A" }}>
          First
        </button>
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || contractLoading}
          className="px-3 py-1.5 rounded text-sm border border-[rgba(84,162,211,0.3)] text-slate-300 disabled:opacity-30 hover:bg-[rgba(10,16,104,0.6)] transition"
          style={{ background: "#03065A" }}>
          Previous
        </button>
        <span className="text-sm text-slate-400">Page {page}</span>
        <button onClick={() => setPage(page + 1)} disabled={!hasNext || contractLoading}
          className="px-3 py-1.5 rounded text-sm border border-[rgba(84,162,211,0.3)] text-slate-300 disabled:opacity-30 hover:bg-[rgba(10,16,104,0.6)] transition"
          style={{ background: "#03065A" }}>
          Next
        </button>
      </div>
    </div>
  );
}

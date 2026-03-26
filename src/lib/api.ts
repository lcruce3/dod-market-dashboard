// ============================================================
// USASpending.gov API v2 — COMPREHENSIVE data fetching
// Fetches ALL aggregated category data (no page caps)
// Awards are fetched on-demand via /api/contracts endpoint
// ============================================================

export interface CategoryResult {
  name: string;
  amount: number;
  code: string;
  id: number;
}

export interface AwardResult {
  "Award ID": string;
  "Recipient Name": string;
  "Award Amount": number;
  "Awarding Agency": string;
  "Awarding Sub Agency": string;
  "Description": string;
  "Place of Performance State Code": string;
  "Contract Award Type": string;
  "NAICS": { code: string; description: string } | null;
  "Start Date": string;
  "End Date": string;
  internal_id: number;
  generated_internal_id: string;
}

export interface DashboardData {
  recipients: CategoryResult[];
  naics: CategoryResult[];
  states: CategoryResult[];
  subAgencies: CategoryResult[];
  psc: CategoryResult[];
  awardingAgencies: CategoryResult[];
  kpiTotals: {
    totalObligated: number;
    totalAwards: number;
    totalRecipients: number;
    totalSubAgencies: number;
  };
  lastUpdated: string;
}

const BASE_URL = "https://api.usaspending.gov/api/v2";

// Current fiscal year date range: Jan 2025 to current
export const DOD_FILTERS = {
  agencies: [{ type: "funding", tier: "toptier", name: "Department of Defense" }],
  time_period: [{ start_date: "2025-01-01", end_date: "2026-03-31" }],
};

// Fetch ALL pages of a spending_by_category endpoint — NO CAPS
export async function fetchAllCategoryPages(
  category: string,
  filters: any = DOD_FILTERS,
  maxPages = 999
): Promise<CategoryResult[]> {
  const all: CategoryResult[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext && page <= maxPages) {
    try {
      const res = await fetch(`${BASE_URL}/search/spending_by_category/${category}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          category,
          limit: 100,
          page,
        }),
      });

      if (!res.ok) {
        console.error(`API error ${res.status} for ${category} page ${page}`);
        break;
      }

      const data = await res.json();
      const results = data.results || [];
      all.push(...results);
      hasNext = data.page_metadata?.hasNext ?? false;
      page++;
    } catch (err) {
      console.error(`Fetch error for ${category} page ${page}:`, err);
      break;
    }
  }

  return all;
}

// Fetch total award counts from dedicated endpoint
export async function fetchAwardCounts(filters: any = DOD_FILTERS): Promise<number> {
  try {
    const res = await fetch(`${BASE_URL}/search/spending_by_award_count/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const r = data.results;
    return (r.contracts || 0) + (r.direct_payments || 0) + (r.grants || 0) +
           (r.idvs || 0) + (r.loans || 0) + (r.other || 0);
  } catch {
    return 0;
  }
}

// Fetch a page of awards (used by /api/contracts for on-demand pagination)
export async function fetchAwardsPage(
  filters: any,
  page: number = 1,
  limit: number = 100,
  sort: string = "Award Amount",
  order: string = "desc"
): Promise<{ results: AwardResult[]; hasNext: boolean; page: number }> {
  const res = await fetch(`${BASE_URL}/search/spending_by_award/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: { ...filters, award_type_codes: ["A", "B", "C", "D"] },
      fields: [
        "Award ID", "Recipient Name", "Award Amount",
        "Awarding Agency", "Awarding Sub Agency",
        "Description", "Place of Performance State Code",
        "Contract Award Type", "NAICS",
        "Start Date", "End Date",
      ],
      limit,
      page,
      order,
      sort,
      subawards: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    results: data.results || [],
    hasNext: data.page_metadata?.hasNext ?? false,
    page: data.page_metadata?.page ?? page,
  };
}

// Main function: fetch ALL aggregated data (no caps)
export async function fetchAllDashboardData(): Promise<DashboardData> {
  console.log("[API] Fetching comprehensive DoD data from USASpending.gov...");
  const start = Date.now();

  const [recipients, naics, states, subAgencies, psc, awardingAgencies, totalAwards] =
    await Promise.all([
      fetchAllCategoryPages("recipient"),      // ALL recipients
      fetchAllCategoryPages("naics"),           // ALL NAICS codes
      fetchAllCategoryPages("state_territory"), // ALL states
      fetchAllCategoryPages("funding_subagency"), // ALL sub-agencies
      fetchAllCategoryPages("psc"),             // ALL product/service codes
      fetchAllCategoryPages("awarding_agency"), // ALL awarding agencies
      fetchAwardCounts(),                       // Total award count
    ]);

  const totalObligated = states.reduce((sum, s) => sum + s.amount, 0);
  const totalRecipients = recipients.length;
  const totalSubAgencies = subAgencies.length;

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[API] Fetched: ${totalRecipients} recipients, ${naics.length} NAICS, ${states.length} states, ${subAgencies.length} sub-agencies, ${psc.length} PSC codes in ${elapsed}s`);

  return {
    recipients,
    naics,
    states,
    subAgencies,
    psc,
    awardingAgencies,
    kpiTotals: { totalObligated, totalAwards, totalRecipients, totalSubAgencies },
    lastUpdated: new Date().toISOString(),
  };
}

// Format currency for display
export function formatCurrency(amount: number): string {
  if (Math.abs(amount) >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`;
  if (Math.abs(amount) >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
  if (Math.abs(amount) >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
  if (Math.abs(amount) >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

// Format number with smart abbreviations
export function formatNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

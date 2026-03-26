import { NextResponse } from "next/server";
import { fetchAwardsPage, DOD_FILTERS } from "@/lib/api";

export const maxDuration = 30;

// Live proxy to USASpending spending_by_award endpoint
// Fetches ONE page of awards at a time with server-side filtering
// This allows browsing ALL 4M+ awards without downloading them all
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      page = 1,
      limit = 50,
      sort = "Award Amount",
      order = "desc",
      stateCode,
      subAgency,
      naicsCode,
      recipientSearch,
    } = body;

    // Build filters
    const filters: any = {
      time_period: DOD_FILTERS.time_period,
      agencies: [
        { type: "funding", tier: "toptier", name: "Department of Defense" },
      ],
    };

    if (stateCode) {
      filters.place_of_performance_locations = [{ country: "USA", state: stateCode }];
    }

    if (subAgency) {
      filters.agencies.push({ type: "funding", tier: "subtier", name: subAgency });
    }

    if (naicsCode) {
      filters.naics_codes = [naicsCode];
    }

    if (recipientSearch) {
      filters.recipient_search_text = [recipientSearch];
    }

    const data = await fetchAwardsPage(filters, page, limit, sort, order);

    return NextResponse.json({
      results: data.results,
      hasNext: data.hasNext,
      page: data.page,
    });
  } catch (error: any) {
    console.error("[/api/contracts] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch contracts", message: error.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { fetchAllCategoryPages, fetchAwardCounts, DOD_FILTERS } from "@/lib/api";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stateCode, subAgency, naicsCode } = body;

    // Build filter object from base DoD filters + user selections
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

    // Fetch all categories in parallel with these filters
    const [recipients, naics, states, subAgencies, totalAwards] = await Promise.all([
      fetchAllCategoryPages("recipient", filters),
      fetchAllCategoryPages("naics", filters),
      fetchAllCategoryPages("state_territory", filters),
      fetchAllCategoryPages("funding_subagency", filters),
      fetchAwardCounts(filters),
    ]);

    const totalObligated = states.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);

    return NextResponse.json({
      recipients,
      naics,
      states,
      subAgencies,
      kpiTotals: {
        totalObligated,
        totalAwards,
        totalRecipients: recipients.length,
        totalSubAgencies: subAgencies.length,
      },
    });
  } catch (error: any) {
    console.error("[/api/filtered] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch filtered data", message: error.message },
      { status: 500 }
    );
  }
}

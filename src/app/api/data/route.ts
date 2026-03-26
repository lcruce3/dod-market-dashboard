import { NextResponse } from "next/server";
import { fetchAllDashboardData } from "@/lib/api";

// In-memory cache for aggregated category data
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const maxDuration = 60; // Vercel serverless max timeout

export async function GET() {
  try {
    const now = Date.now();

    // Return cached data if fresh
    if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json(cachedData);
    }

    // Fetch comprehensive data (all category pages, no caps)
    const data = await fetchAllDashboardData();
    cachedData = data;
    cacheTimestamp = now;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[/api/data] Error:", error.message);
    // If fetch fails but we have cache, return stale cache
    if (cachedData) {
      return NextResponse.json({ ...cachedData, stale: true });
    }
    return NextResponse.json(
      { error: "Failed to fetch data", message: error.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

// Error shape from docs/contracts.md §0
export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

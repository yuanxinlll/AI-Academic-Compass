import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/validation";

// Error shape from docs/contracts.md §0
export function apiError(status: number, code: string, message: string, field?: string) {
  return NextResponse.json({ error: { code, message, ...(field ? { field } : {}) } }, { status });
}

const MAX_BODY = 2_000_000; // bytes; the largest legitimate body is a 50-item collector batch

export async function readJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) throw new ValidationError("body", "Request body is too large");
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw new ValidationError("body", "Request body could not be read");
  }
  if (text.length > MAX_BODY) throw new ValidationError("body", "Request body is too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("body", "Request body must be valid JSON");
  }
}

/** Turns known errors into contract-shaped responses; logs and hides everything else. */
export function handleError(route: string, err: unknown) {
  if (err instanceof ValidationError) return apiError(400, "INVALID_INPUT", err.message, err.field);
  if (err instanceof AiServiceError) return apiError(err.status, err.code, err.message);
  console.error(`[${route}]`, err);
  return apiError(500, "INTERNAL_ERROR", "Something went wrong");
}

export class AiServiceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiError, handleError } from "@/lib/api";
import { callAiService } from "@/lib/ai-service";

const MAX_BYTES = 4 * 1024 * 1024; // contracts §4.3 (Vercel body limit ≈ 4.5MB)

// POST /api/resume/parse — validates the upload and forwards it to B's service.
// Parse only: nothing is stored. The client saves via POST /api/profile after the student confirms.
export async function POST(req: NextRequest) {
  try {
    const { error } = await requireUser(req);
    if (error) return error;

    if (!req.headers.get("content-type")?.startsWith("multipart/form-data"))
      return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Use multipart/form-data with a `file` field", "file");

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return apiError(400, "INVALID_UPLOAD", "Could not read the upload", "file");
    }
    const file = form.get("file");
    if (!(file instanceof File)) return apiError(400, "INVALID_UPLOAD", "Provide exactly one `file` field", "file");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
      return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Only PDF files are supported", "file");
    if (file.size === 0 || file.size > MAX_BYTES)
      return apiError(413, "FILE_TOO_LARGE", "The PDF must be between 1 byte and 4MB", "file");

    const forward = new FormData();
    forward.append("file", file, file.name);
    // Only send to Gemini when the student explicitly opted in.
    if (form.get("use_ai") === "true") forward.append("use_ai", "true");

    return NextResponse.json(await callAiService("/internal/resume/parse", forward, 60_000));
  } catch (err) {
    return handleError("POST /api/resume/parse", err);
  }
}

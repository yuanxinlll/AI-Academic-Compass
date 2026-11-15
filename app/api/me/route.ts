import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { currentUserView } from "@/lib/me";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

// GET /api/me — who is signed in (user: null when nobody), plus the demo account picker list.
export async function GET(req: NextRequest) {
  try {
    const u = await currentUser(req);
    const accounts = DEMO_ACCOUNTS.map(({ username, displayName, role, blurb }) => ({
      username,
      display_name: displayName,
      role,
      blurb,
    }));
    return NextResponse.json({ user: u ? await currentUserView(u.username) : null, accounts });
  } catch (err) {
    return handleError("GET /api/me", err);
  }
}

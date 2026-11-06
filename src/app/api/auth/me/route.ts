import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkUserCredits } from "@/lib/credits";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const credits = checkUserCredits(user.id);
  const { passwordHash: _, ...safeUser } = user;

  return NextResponse.json({
    authenticated: true,
    user: safeUser,
    credits,
  });
}


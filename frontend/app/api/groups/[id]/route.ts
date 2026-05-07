// app/api/groups/[id]/route.ts

import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

const API = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const res = await fetch(`${API}/groups/${id}`, {
    headers: { "X-User-Id": session.user.sub },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
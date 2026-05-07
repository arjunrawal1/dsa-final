
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

const API = "http://localhost:8000";

export async function GET() {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(`${API}/groups`, {
    headers: { "X-User-Id": session.user.sub },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const res = await fetch(`${API}/groups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": session.user.sub,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {

    console.error("Backend error:", data);  // add this
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data, { status: res.status });
}
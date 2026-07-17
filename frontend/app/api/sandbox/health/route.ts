import { NextResponse } from "next/server";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/sandbox/health`, {
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        status: "fallback",
        environment: "development",
        mode: "local",
        detail: error instanceof Error ? error.message : "Sandbox health proxy failed",
      },
      { status: 200 },
    );
  }
}

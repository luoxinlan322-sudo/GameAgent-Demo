import { NextResponse } from "next/server";
import { listDebugLogs } from "@/lib/debug-log";

export async function GET() {
  return NextResponse.json(
    { logs: listDebugLogs() },
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

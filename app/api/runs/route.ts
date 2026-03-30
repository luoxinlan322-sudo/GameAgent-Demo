import { NextResponse } from "next/server";
import { getRun, listRuns } from "@/lib/run-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  if (runId) {
    return NextResponse.json(
      { run: getRun(runId) ?? null },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  return NextResponse.json(
    { runs: listRuns() },
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

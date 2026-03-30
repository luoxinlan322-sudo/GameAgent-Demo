import { NextResponse } from "next/server";
import { createPlan } from "@/lib/planner";
import { PlanRequestSchema } from "@/lib/schemas";
import { ZodError } from "zod";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  try {
    const { persona } = PlanRequestSchema.parse(body);
    const plan = await createPlan(persona);
    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "项目简报参数校验失败",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "规划失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

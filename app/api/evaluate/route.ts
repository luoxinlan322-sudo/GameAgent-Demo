import { NextResponse } from "next/server";
import { evaluateProposal } from "@/lib/evaluator";
import { EvaluateRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const { persona, plan, proposal, creativePack } = EvaluateRequestSchema.parse(await request.json());
    if (!creativePack) {
      return NextResponse.json({ error: "缺少设计包 creativePack" }, { status: 400 });
    }
    const evaluation = await evaluateProposal(persona, proposal, creativePack, plan);
    return NextResponse.json({ evaluation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "评估失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

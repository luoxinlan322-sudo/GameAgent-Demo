import { NextResponse } from "next/server";
import { generateProposal } from "@/lib/generator";
import { GenerateRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const { persona, plan } = GenerateRequestSchema.parse(await request.json());
    if (!plan) {
      return NextResponse.json({ error: "缺少规划结果" }, { status: 400 });
    }
    const generation = await generateProposal(persona, plan);
    return NextResponse.json({ generation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

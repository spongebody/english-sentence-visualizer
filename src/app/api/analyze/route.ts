import { analyze, AnalysisError } from "@/lib/analyze-server";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 120;
const input = z.object({ sentence: z.string().trim().min(1).max(3000) });
export async function POST(request: Request) {
  try {
    const parsed = input.safeParse(await request.json());
    if (!parsed.success)
      throw new AnalysisError("请输入一个英语句子（最多 3000 个字符）。", 400);
    return Response.json(await analyze(parsed.data.sentence), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const known = error instanceof AnalysisError;
    return Response.json(
      { error: known ? error.message : "输入格式有误，请重新提交。" },
      {
        status: known ? error.status : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

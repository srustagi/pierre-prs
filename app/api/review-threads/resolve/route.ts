import { NextResponse } from "next/server";
import { resolveReviewThread, unresolveReviewThread } from "@/lib/github";

export async function POST(request: Request) {
  const input = (await request.json()) as {
    threadId?: string;
    resolved?: boolean;
  };

  if (!input.threadId || typeof input.resolved !== "boolean") {
    return NextResponse.json({ error: "Missing thread target" }, { status: 400 });
  }

  try {
    const result = input.resolved
      ? await resolveReviewThread(input.threadId)
      : await unresolveReviewThread(input.threadId);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update thread" },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { replyToReviewComment } from "@/lib/github";

export async function POST(request: Request) {
  const input = (await request.json()) as {
    owner?: string;
    repo?: string;
    pullNumber?: number;
    commentId?: number;
    body?: string;
  };

  if (!input.owner || !input.repo || !input.pullNumber || !input.commentId || !input.body) {
    return NextResponse.json({ error: "Missing reply target" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await replyToReviewComment(
        input.owner,
        input.repo,
        input.pullNumber,
        input.commentId,
        input.body,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reply" },
      { status: 400 },
    );
  }
}

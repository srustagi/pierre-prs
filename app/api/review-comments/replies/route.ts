import { NextResponse } from "next/server";
import { isGitHubSignInRequired } from "@/lib/auth";
import { replyToReviewComment } from "@/lib/github";

export async function POST(request: Request) {
  try {
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

    return NextResponse.json(
      await replyToReviewComment({
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
        commentId: input.commentId,
        body: input.body,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reply" },
      { status: isGitHubSignInRequired(error) ? 401 : 400 },
    );
  }
}

import { NextResponse } from "next/server";
import {
  createPendingReview,
  submitReview,
  type ReviewCommentDraft,
  type SubmitReviewInput,
} from "@/lib/github";

export async function POST(request: Request) {
  const input = (await request.json()) as SubmitReviewInput;

  if (!input.owner || !input.repo || !input.pullNumber || !input.event) {
    return NextResponse.json({ error: "Missing review target" }, { status: 400 });
  }

  const comments = input.comments.map((comment) => normalizeComment(comment));

  try {
    const pending = await createPendingReview({ ...input, comments });
    const submitted = await submitReview(
      input.owner,
      input.repo,
      input.pullNumber,
      pending.id,
      input.event,
      input.body,
    );

    return NextResponse.json(submitted);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit review" },
      { status: 400 },
    );
  }
}

function normalizeComment(comment: ReviewCommentDraft) {
  return {
    path: comment.path,
    body: comment.body,
    commit_id: comment.commit_id,
    line: comment.line,
    side: comment.side,
    ...(comment.start_line ? { start_line: comment.start_line } : {}),
    ...(comment.start_side ? { start_side: comment.start_side } : {}),
  };
}

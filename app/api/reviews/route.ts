import { NextResponse } from "next/server";
import { isGitHubSignInRequired } from "@/lib/auth";
import {
  createPendingReview,
  submitReview,
} from "@/lib/github";
import type { ReviewCommentDraft, SubmitReviewInput } from "@/lib/github-types";

export async function POST(request: Request) {
  try {
    const input = await request.json();

    if (!isSubmitReviewInput(input)) {
      return NextResponse.json({ error: "Missing review target" }, { status: 400 });
    }

    const comments = input.comments.map((comment) => normalizeComment(comment));
    const pending = await createPendingReview({ ...input, comments });
    const submitted = await submitReview({
      owner: input.owner,
      repo: input.repo,
      pullNumber: input.pullNumber,
      reviewId: pending.id,
      event: input.event,
      body: input.body,
    });

    return NextResponse.json(submitted);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit review" },
      { status: isGitHubSignInRequired(error) ? 401 : 400 },
    );
  }
}

function isSubmitReviewInput(input: unknown): input is SubmitReviewInput {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<SubmitReviewInput>;

  return (
    typeof candidate.owner === "string" &&
    typeof candidate.repo === "string" &&
    typeof candidate.pullNumber === "number" &&
    isReviewEvent(candidate.event) &&
    typeof candidate.body === "string" &&
    Array.isArray(candidate.comments) &&
    candidate.comments.every(isReviewCommentDraft)
  );
}

function isReviewEvent(event: unknown): event is SubmitReviewInput["event"] {
  return event === "COMMENT" || event === "APPROVE" || event === "REQUEST_CHANGES";
}

function isReviewCommentDraft(comment: unknown): comment is ReviewCommentDraft {
  if (!comment || typeof comment !== "object") {
    return false;
  }

  const candidate = comment as Partial<ReviewCommentDraft>;

  return (
    typeof candidate.path === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.commitId === "string" &&
    typeof candidate.line === "number" &&
    isReviewSide(candidate.side) &&
    (candidate.startLine === undefined || typeof candidate.startLine === "number") &&
    (candidate.startSide === undefined || isReviewSide(candidate.startSide))
  );
}

function isReviewSide(side: unknown): side is ReviewCommentDraft["side"] {
  return side === "LEFT" || side === "RIGHT";
}

function normalizeComment(comment: ReviewCommentDraft) {
  return {
    path: comment.path,
    body: comment.body,
    commitId: comment.commitId,
    line: comment.line,
    side: comment.side,
    ...(comment.startLine ? { startLine: comment.startLine } : {}),
    ...(comment.startSide ? { startSide: comment.startSide } : {}),
  };
}

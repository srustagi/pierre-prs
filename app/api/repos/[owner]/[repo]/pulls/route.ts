import { NextResponse } from "next/server";
import { isGitHubSignInRequired } from "@/lib/auth";
import { getPullRequests } from "@/lib/github";

export async function GET(
  request: Request,
  context: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await context.params;
  const { searchParams } = new URL(request.url);

  try {
    const pulls = await getPullRequests(owner, repo, searchParams.get("q") ?? undefined);
    return NextResponse.json(pulls);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load pull requests" },
      { status: isGitHubSignInRequired(error) ? 401 : 400 },
    );
  }
}

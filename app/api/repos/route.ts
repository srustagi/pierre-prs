import { NextResponse } from "next/server";
import { isGitHubSignInRequired } from "@/lib/auth";
import { getRepos } from "@/lib/github";

export async function GET() {
  try {
    return NextResponse.json(await getRepos());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load repositories" },
      { status: isGitHubSignInRequired(error) ? 401 : 400 },
    );
  }
}

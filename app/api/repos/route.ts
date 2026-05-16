import { NextResponse } from "next/server";
import { getRepos } from "@/lib/github";

export async function GET() {
  try {
    return NextResponse.json(await getRepos());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load repositories" },
      { status: 401 },
    );
  }
}

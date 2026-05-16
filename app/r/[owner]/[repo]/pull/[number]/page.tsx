import { redirect } from "next/navigation";
import { ReviewClient } from "@/components/review-client";
import { getAuthSession } from "@/lib/auth";
import { adaptPullFile } from "@/lib/diff-adapter";
import { getPullFiles, getPullRequest, getReviewThreads } from "@/lib/github";

export default async function PullReviewPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; number: string }>;
}) {
  const session = await getAuthSession();

  if (!session?.accessToken) {
    redirect("/");
  }

  const { owner, repo, number } = await params;
  const pullNumber = Number(number);
  const [pull, pullFiles, threads] = await Promise.all([
    getPullRequest(owner, repo, pullNumber),
    getPullFiles(owner, repo, pullNumber),
    getReviewThreads(owner, repo, pullNumber),
  ]);
  const files = pullFiles.map((file) => adaptPullFile(file, pull.headSha));

  return (
    <ReviewClient owner={owner} repo={repo} pull={pull} files={files} threads={threads} />
  );
}

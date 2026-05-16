import { HomeContent } from "@/components/home-content";
import { getAuthSession } from "@/lib/auth";
import { getRecentReposWithPullRequests, getRepos } from "@/lib/github";

export default async function Home() {
  const session = await getAuthSession();

  if (!session?.accessToken) {
    return <HomeContent signedIn={false} />;
  }

  const [repos, recentRepos] = await Promise.all([
    getRepos(),
    getRecentReposWithPullRequests().catch(() => []),
  ]);

  return <HomeContent signedIn repos={repos} recentRepos={recentRepos} />;
}

import { HomeContent } from "@/components/home-content";
import { getAuthSession } from "@/lib/auth";
import { getRepos } from "@/lib/github";

export default async function Home() {
  const session = await getAuthSession();

  if (!session?.accessToken) {
    return <HomeContent signedIn={false} />;
  }

  const repos = await getRepos();

  return <HomeContent signedIn repos={repos} />;
}

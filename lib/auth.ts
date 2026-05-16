import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

export function createAuthOptions(): NextAuthOptions {
  return {
    providers: [
      GitHubProvider({
        clientId: process.env.GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
        authorization: {
          params: {
            scope: "read:user user:email repo",
          },
        },
      }),
    ],
    callbacks: {
      jwt({ token, account }) {
        if (account?.access_token) {
          token.accessToken = account.access_token;
        }

        return token;
      },
      session({ session, token }) {
        session.accessToken = token.accessToken;
        return session;
      },
    },
  };
}

export function getAuthSession() {
  return getServerSession(createAuthOptions());
}

export async function requireAccessToken() {
  const session = await getAuthSession();

  if (!session?.accessToken) {
    throw new Error("GitHub sign-in required");
  }

  return session.accessToken;
}

export function isGitHubSignInRequired(error: unknown) {
  return error instanceof Error && error.message === "GitHub sign-in required";
}

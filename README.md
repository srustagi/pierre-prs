# 100% vibe coded. purely for convenience.

# Pierre PRs

Pierre PRs is a minimal GitHub pull request review UI built with Next.js, Chakra UI, NextAuth, Octokit, and `@pierre/diffs`.

It lets you sign in with GitHub, pick one of your repositories, open an active pull request, review the changed files in a focused diff view, draft line comments, reply to existing review threads, resolve or reopen threads, and submit the review back to GitHub.

## Features

- GitHub OAuth sign-in with repository access.
- Repository picker with recently updated open pull requests.
- PR lookup by GitHub URL, PR number, or title search.
- Diff rendering through `@pierre/diffs`.
- File review map with reviewed, unreviewed, and commented filters.
- Draft line comments and review summaries.
- Submit reviews as comment, approval, or request changes.
- Reply to review comments and resolve or unresolve review threads.
- Light and dark review themes.

## Getting Started

Install dependencies:

```bash
npm install
```

Create a `.env.local` file with GitHub OAuth credentials:

```bash
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

For local development, configure the GitHub OAuth app callback URL as:

```text
http://localhost:3000/api/auth/callback/github
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with GitHub, and choose a pull request to review.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Project Structure

- `app/page.tsx` loads the signed-in home experience and repository data.
- `app/r/[owner]/[repo]/pull/[number]/page.tsx` loads PR metadata, files, and review threads.
- `components/repo-picker.tsx` handles repository and pull request selection.
- `components/review-client.tsx` contains the review UI and client-side review actions.
- `lib/github.ts` wraps GitHub REST and GraphQL API calls.
- `lib/diff-adapter.ts` adapts GitHub patches into Pierre diff coordinates for line comments.
- `lib/auth.ts` configures GitHub sign-in through NextAuth.

## Notes

The GitHub OAuth scope is `read:user user:email repo`, so this app can read private repositories available to the signed-in user and write pull request review actions back to GitHub.

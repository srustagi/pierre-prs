import { Octokit } from "@octokit/rest";
import { requireAccessToken } from "@/lib/auth";

export type Repo = {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  updatedAt: string | null;
};

export type PullRequest = {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  updatedAt: string;
  htmlUrl: string;
  author: string | null;
  headSha: string;
  headRef: string;
  baseRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
};

export type PullRequestSummary = Pick<
  PullRequest,
  "number" | "title" | "draft" | "updatedAt" | "htmlUrl" | "author"
>;

export type RecentRepoWithPullRequests = Repo & {
  openPullRequestCount: number;
  latestPullUpdatedAt: string;
  recentPullRequests: PullRequestSummary[];
};

export type PullFile = {
  filename: string;
  previousFilename?: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blobUrl: string;
};

export type ReviewThreadComment = {
  id: string;
  databaseId: number | null;
  body: string;
  url: string;
  createdAt: string;
  author: {
    login: string;
    avatarUrl: string;
    url: string;
  } | null;
  path: string;
  line: number | null;
  side: "LEFT" | "RIGHT" | null;
  replyToDatabaseId?: number | null;
};

export type ReviewThread = {
  id: string;
  isResolved: boolean;
  path: string;
  line: number | null;
  side: "LEFT" | "RIGHT" | null;
  startLine: number | null;
  startSide: "LEFT" | "RIGHT" | null;
  comments: ReviewThreadComment[];
};

export type ReviewCommentDraft = {
  path: string;
  body: string;
  commit_id: string;
  line: number;
  side: "LEFT" | "RIGHT";
  start_line?: number;
  start_side?: "LEFT" | "RIGHT";
};

export type SubmitReviewInput = {
  owner: string;
  repo: string;
  pullNumber: number;
  event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
  body: string;
  comments: ReviewCommentDraft[];
};

export async function getRepos() {
  const octokit = await getOctokit();
  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    affiliation: "owner,collaborator,organization_member",
    sort: "updated",
    direction: "desc",
    per_page: 100,
  });

  return repos.map((repo) => ({
    id: repo.id,
    fullName: repo.full_name,
    owner: repo.owner.login,
    name: repo.name,
    private: repo.private,
    updatedAt: repo.updated_at,
  })) satisfies Repo[];
}

export async function getRecentReposWithPullRequests() {
  const octokit = await getOctokit();
  const result = await octokit.graphql<RecentReposWithPullRequestsResponse>(
    `query RecentReposWithPullRequests {
      viewer {
        repositories(
          first: 100
          affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
          orderBy: { field: UPDATED_AT, direction: DESC }
        ) {
          nodes {
            databaseId
            name
            nameWithOwner
            isPrivate
            updatedAt
            owner {
              login
            }
            pullRequests(
              states: OPEN
              first: 3
              orderBy: { field: UPDATED_AT, direction: DESC }
            ) {
              totalCount
              nodes {
                number
                title
                isDraft
                updatedAt
                url
                author {
                  login
                }
              }
            }
          }
        }
      }
    }`,
  );

  return result.viewer.repositories.nodes
    .filter((repo) => repo.pullRequests.nodes.length > 0)
    .map((repo) => ({
      id: repo.databaseId ?? 0,
      fullName: repo.nameWithOwner,
      owner: repo.owner.login,
      name: repo.name,
      private: repo.isPrivate,
      updatedAt: repo.updatedAt,
      openPullRequestCount: repo.pullRequests.totalCount,
      latestPullUpdatedAt: repo.pullRequests.nodes[0].updatedAt,
      recentPullRequests: repo.pullRequests.nodes.map((pull) => ({
        number: pull.number,
        title: pull.title,
        draft: pull.isDraft,
        updatedAt: pull.updatedAt,
        htmlUrl: pull.url,
        author: pull.author?.login ?? null,
      })),
    }))
    .sort((a, b) => Date.parse(b.latestPullUpdatedAt) - Date.parse(a.latestPullUpdatedAt))
    .slice(0, 10) satisfies RecentRepoWithPullRequests[];
}

export async function getPullRequests(owner: string, repo: string, search?: string) {
  const octokit = await getOctokit();
  const pulls = await octokit.paginate(octokit.rest.pulls.list, {
    owner,
    repo,
    state: "open",
    sort: "updated",
    direction: "desc",
    per_page: 30,
  });
  const query = search?.trim().toLowerCase();
  const filtered = query
    ? pulls.filter((pull) => {
        const numberMatch = String(pull.number) === query.replace(/^#/, "");
        return numberMatch || pull.title.toLowerCase().includes(query);
      })
    : pulls.slice(0, 10);

  return filtered.slice(0, 10).map(toPullRequest) satisfies PullRequest[];
}

export async function getPullRequest(owner: string, repo: string, pullNumber: number) {
  const octokit = await getOctokit();
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return toPullRequest(data);
}

export async function getPullFiles(owner: string, repo: string, pullNumber: number) {
  const octokit = await getOctokit();
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  return files.map((file) => ({
    filename: file.filename,
    previousFilename: file.previous_filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch,
    blobUrl: file.blob_url,
  })) satisfies PullFile[];
}

export async function getReviewThreads(owner: string, repo: string, pullNumber: number) {
  const octokit = await getOctokit();
  const threads: ReviewThreadNode[] = [];
  let threadCursor: string | null = null;
  let hasNextThreadPage = true;

  while (hasNextThreadPage) {
    const result: ReviewThreadsResponse = await octokit.graphql<ReviewThreadsResponse>(
      `query PullRequestReviewThreads($owner: String!, $repo: String!, $number: Int!, $threadCursor: String) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 100, after: $threadCursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                isResolved
                path
                line
                startLine
                diffSide
                startDiffSide
                comments(first: 100) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    id
                    databaseId
                    bodyText
                    url
                    createdAt
                    path
                    line
                    author {
                      login
                      avatarUrl
                      url
                    }
                    replyTo {
                      databaseId
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { owner, repo, number: pullNumber, threadCursor },
    );

    const connection: ReviewThreadConnection | undefined = result.repository.pullRequest?.reviewThreads;

    if (!connection) {
      return [];
    }

    threads.push(...connection.nodes);
    threadCursor = connection.pageInfo.endCursor;
    hasNextThreadPage = connection.pageInfo.hasNextPage;
  }

  const threadsWithComments = await Promise.all(
    threads.map(async (thread) => ({
      ...thread,
      comments: {
        ...thread.comments,
        nodes: thread.comments.pageInfo.hasNextPage
          ? await getRemainingReviewThreadComments(
              octokit,
              thread.id,
              thread.comments.pageInfo.endCursor,
              thread.comments.nodes,
            )
          : thread.comments.nodes,
      },
    })),
  );

  return threadsWithComments.map((thread) => ({
    id: thread.id,
    isResolved: thread.isResolved,
    path: thread.path,
    line: thread.line,
    side: thread.diffSide,
    startLine: thread.startLine,
    startSide: thread.startDiffSide,
    comments: thread.comments.nodes.map((comment) => ({
      id: comment.id,
      databaseId: comment.databaseId,
      body: comment.bodyText,
      url: comment.url,
      createdAt: comment.createdAt,
      author: comment.author,
      path: comment.path,
      line: comment.line,
      side: thread.diffSide,
      replyToDatabaseId: comment.replyTo?.databaseId,
    })),
  })) satisfies ReviewThread[];
}

async function getRemainingReviewThreadComments(
  octokit: Octokit,
  threadId: string,
  firstCursor: string | null,
  firstPage: ReviewThreadCommentNode[],
) {
  const comments = [...firstPage];
  let commentCursor = firstCursor;
  let hasNextCommentPage = true;

  while (hasNextCommentPage) {
    const result = await octokit.graphql<ReviewThreadCommentsResponse>(
      `query ReviewThreadComments($threadId: ID!, $commentCursor: String) {
        node(id: $threadId) {
          ... on PullRequestReviewThread {
            comments(first: 100, after: $commentCursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                databaseId
                bodyText
                url
                createdAt
                path
                line
                author {
                  login
                  avatarUrl
                  url
                }
                replyTo {
                  databaseId
                }
              }
            }
          }
        }
      }`,
      { threadId, commentCursor },
    );

    const connection = result.node.comments;
    comments.push(...connection.nodes);
    commentCursor = connection.pageInfo.endCursor;
    hasNextCommentPage = connection.pageInfo.hasNextPage;
  }

  return comments;
}

export async function createPendingReview(input: SubmitReviewInput) {
  const octokit = await getOctokit();
  const { data } = await octokit.rest.pulls.createReview({
    owner: input.owner,
    repo: input.repo,
    pull_number: input.pullNumber,
    commit_id: input.comments[0]?.commit_id,
    body: input.body,
    comments: input.comments.map(stripCommentCommitId),
  });

  return data;
}

export async function submitReview(
  owner: string,
  repo: string,
  pullNumber: number,
  reviewId: number,
  event: SubmitReviewInput["event"],
  body: string,
) {
  const octokit = await getOctokit();
  const { data } = await octokit.rest.pulls.submitReview({
    owner,
    repo,
    pull_number: pullNumber,
    review_id: reviewId,
    event,
    body,
  });

  return data;
}

export async function replyToReviewComment(
  owner: string,
  repo: string,
  pullNumber: number,
  commentId: number,
  body: string,
) {
  const octokit = await getOctokit();
  const { data } = await octokit.rest.pulls.createReplyForReviewComment({
    owner,
    repo,
    pull_number: pullNumber,
    comment_id: commentId,
    body,
  });

  return data;
}

export async function resolveReviewThread(threadId: string) {
  const octokit = await getOctokit();
  return octokit.graphql(
    `mutation ResolveReviewThread($threadId: ID!) {
      resolveReviewThread(input: { threadId: $threadId }) {
        thread {
          id
          isResolved
        }
      }
    }`,
    { threadId },
  );
}

export async function unresolveReviewThread(threadId: string) {
  const octokit = await getOctokit();
  return octokit.graphql(
    `mutation UnresolveReviewThread($threadId: ID!) {
      unresolveReviewThread(input: { threadId: $threadId }) {
        thread {
          id
          isResolved
        }
      }
    }`,
    { threadId },
  );
}

async function getOctokit() {
  const auth = await requireAccessToken();
  return new Octokit({ auth });
}

function toPullRequest(pull: {
  number: number;
  title: string;
  state: string;
  draft?: boolean;
  updated_at: string;
  html_url: string;
  user: { login: string } | null;
  head: { sha: string; ref: string };
  base: { ref: string };
  additions?: number;
  deletions?: number;
  changed_files?: number;
}) {
  return {
    number: pull.number,
    title: pull.title,
    state: pull.state,
    draft: pull.draft ?? false,
    updatedAt: pull.updated_at,
    htmlUrl: pull.html_url,
    author: pull.user?.login ?? null,
    headSha: pull.head.sha,
    headRef: pull.head.ref,
    baseRef: pull.base.ref,
    additions: pull.additions ?? 0,
    deletions: pull.deletions ?? 0,
    changedFiles: pull.changed_files ?? 0,
  };
}

function stripCommentCommitId(comment: ReviewCommentDraft) {
  return {
    path: comment.path,
    body: comment.body,
    line: comment.line,
    side: comment.side,
    ...(comment.start_line ? { start_line: comment.start_line } : {}),
    ...(comment.start_side ? { start_side: comment.start_side } : {}),
  };
}

type ReviewThreadsResponse = {
  repository: {
    pullRequest: {
      reviewThreads: ReviewThreadConnection;
    } | null;
  };
};

type ReviewThreadConnection = {
  pageInfo: PageInfo;
  nodes: ReviewThreadNode[];
};

type ReviewThreadCommentsResponse = {
  node: {
    comments: {
      pageInfo: PageInfo;
      nodes: ReviewThreadCommentNode[];
    };
  };
};

type ReviewThreadNode = {
  id: string;
  isResolved: boolean;
  path: string;
  line: number | null;
  startLine: number | null;
  diffSide: "LEFT" | "RIGHT" | null;
  startDiffSide: "LEFT" | "RIGHT" | null;
  comments: {
    pageInfo: PageInfo;
    nodes: ReviewThreadCommentNode[];
  };
};

type ReviewThreadCommentNode = {
  id: string;
  databaseId: number | null;
  bodyText: string;
  url: string;
  createdAt: string;
  path: string;
  line: number | null;
  author: {
    login: string;
    avatarUrl: string;
    url: string;
  } | null;
  replyTo?: {
    databaseId: number | null;
  } | null;
};

type PageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

type RecentReposWithPullRequestsResponse = {
  viewer: {
    repositories: {
      nodes: Array<{
        databaseId: number | null;
        name: string;
        nameWithOwner: string;
        isPrivate: boolean;
        updatedAt: string;
        owner: {
          login: string;
        };
        pullRequests: {
          totalCount: number;
          nodes: Array<{
            number: number;
            title: string;
            isDraft: boolean;
            updatedAt: string;
            url: string;
            author: {
              login: string;
            } | null;
          }>;
        };
      }>;
    };
  };
};

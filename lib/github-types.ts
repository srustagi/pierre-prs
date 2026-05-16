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
  commitId: string;
  line: number;
  side: "LEFT" | "RIGHT";
  startLine?: number;
  startSide?: "LEFT" | "RIGHT";
};

export type SubmitReviewInput = {
  owner: string;
  repo: string;
  pullNumber: number;
  event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
  body: string;
  comments: ReviewCommentDraft[];
};

export type SubmitReviewRequest = Omit<SubmitReviewInput, "comments"> & {
  reviewId: number;
};

export type ReviewCommentReplyInput = {
  owner: string;
  repo: string;
  pullNumber: number;
  commentId: number;
  body: string;
};

"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Link as ChakraLink,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatchDiff, type DiffLineAnnotation } from "@pierre/diffs/react";
import type { OnDiffLineClickProps, SelectedLineRange } from "@pierre/diffs";
import {
  coordinateForSelection,
  toPierreSide,
  type PierreSide,
  type RenderedDiffFile,
  type ReviewCoordinate,
} from "@/lib/diff-adapter";
import type { PullRequest, ReviewThread } from "@/lib/github";

type DraftComment = {
  id: string;
  path: string;
  side: PierreSide;
  line: number;
  body: string;
  coordinate: ReviewCoordinate;
};

type AnnotationMeta =
  | {
      kind: "thread";
      thread: ReviewThread;
    }
  | {
      kind: "draft";
      draft: DraftComment;
    }
  | {
      kind: "selection";
    };

type Props = {
  owner: string;
  repo: string;
  pull: PullRequest;
  files: RenderedDiffFile[];
  threads: ReviewThread[];
};

export function ReviewClient({ owner, repo, pull, files, threads }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<{
    path: string;
    side: PierreSide;
    start: number;
    end: number;
  } | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [drafts, setDrafts] = useState<DraftComment[]>([]);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const filesByPath = useMemo(() => new Map(files.map((file) => [file.filename, file])), [files]);

  function addDraft() {
    if (!selected || !draftBody.trim()) {
      return;
    }

    const file = filesByPath.get(selected.path);
    const coordinate = file
      ? coordinateForSelection(file, selected.start, selected.side, selected.end, selected.side)
      : null;

    if (!coordinate) {
      setMessage("That line cannot be commented on in GitHub.");
      return;
    }

    setDrafts((current) => [
      ...current,
      {
        id: `${selected.path}:${selected.side}:${selected.start}:${selected.end}:${Date.now()}`,
        path: selected.path,
        side: selected.side,
        line: coordinate.line,
        body: draftBody.trim(),
        coordinate,
      },
    ]);
    setDraftBody("");
    setSelected(null);
    setMessage("");
  }

  async function submitReview(event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES") {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          pullNumber: pull.number,
          event,
          body: summary,
          comments: drafts.map((draft) => ({
            ...draft.coordinate,
            body: draft.body,
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to submit review");
      }

      setDrafts([]);
      setSummary("");
      setMessage("Review submitted.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box minH="100vh" bg="gray.50" color="gray.950">
      <Flex align="stretch" direction={{ base: "column", lg: "row" }} minH="100vh">
        <Box
          as="aside"
          aria-label="Changed files"
          position={{ base: "static", lg: "sticky" }}
          top="0"
          h={{ base: "auto", lg: "100vh" }}
          w={{ base: "100%", lg: "300px" }}
          overflow="auto"
          bg="white"
          borderRightWidth={{ base: "0", lg: "1px" }}
          borderBottomWidth={{ base: "1px", lg: "0" }}
          borderColor="gray.200"
          p={5}
          flexShrink={0}
        >
          <ChakraLink asChild color="blue.600" fontWeight="semibold" mb={5} display="inline-flex">
            <Link href="/">Repos</Link>
          </ChakraLink>
          <Heading as="h2" size="md" mb={3}>
            Files
          </Heading>
          <Stack gap={1}>
          {files.map((file) => (
            <ChakraLink
              key={file.filename}
              href={`#${fileId(file.filename)}`}
              display="grid"
              gap={1}
              p={2}
              rounded="md"
              _hover={{ bg: "gray.50" }}
            >
              <Text overflowWrap="anywhere" fontSize="sm" fontWeight="medium">
                {file.displayPath}
              </Text>
              <Text color="gray.500" fontSize="xs">
                +{file.additions} -{file.deletions}
              </Text>
            </ChakraLink>
          ))}
          </Stack>
        </Box>

        <Box as="main" minW={0} flex="1" p={{ base: 4, lg: 6 }}>
          <Flex
            as="header"
            align={{ base: "stretch", md: "flex-start" }}
            justify="space-between"
            direction={{ base: "column", md: "row" }}
            gap={5}
            mb={4}
          >
            <Box>
              <Text color="gray.500" fontSize="sm" fontWeight="semibold">
              {owner}/{repo} #{pull.number}
              </Text>
              <Heading as="h1" size="2xl" lineHeight="1.15" letterSpacing="normal" mt={1} mb={2}>
                {pull.title}
              </Heading>
              <Text color="gray.600">
              {pull.headRef} into {pull.baseRef} by {pull.author ?? "unknown"}
              </Text>
            </Box>
            <Button asChild variant="outline">
              <a href={pull.htmlUrl} target="_blank" rel="noreferrer">
                GitHub PR
              </a>
            </Button>
          </Flex>

          <Card.Root as="section" aria-label="Submit review" mb={4} borderColor="gray.200" shadow="sm">
            <Card.Body gap={3}>
              <Flex align={{ base: "stretch", md: "center" }} justify="space-between" gap={3} direction={{ base: "column", md: "row" }}>
                <Box>
                  <Heading as="h2" size="sm">
                    Finish review
                  </Heading>
                  <Text color="gray.500" fontSize="sm">
                    {drafts.length} pending line comment{drafts.length === 1 ? "" : "s"}
                  </Text>
                </Box>
                <Button
                  alignSelf={{ base: "flex-start", md: "center" }}
                  variant="outline"
                  size="sm"
                  disabled={busy || drafts.length === 0}
                  onClick={() => setDrafts([])}
                >
                  Clear pending comments
                </Button>
              </Flex>
              <Textarea
                value={summary}
                minH="96px"
                resize="vertical"
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Optional review summary"
              />
              <Flex align={{ base: "stretch", md: "center" }} justify="space-between" gap={3} wrap="wrap">
                <Text color="gray.500" fontSize="sm">
                  Submit this review as
                </Text>
                <HStack gap={2} wrap="wrap" justify={{ base: "flex-start", md: "flex-end" }}>
                  <Button variant="outline" disabled={busy} onClick={() => submitReview("COMMENT")}>
                    General comment
                  </Button>
                  <Button colorPalette="blue" disabled={busy} onClick={() => submitReview("APPROVE")}>
                    Approval
                  </Button>
                  <Button
                    colorPalette="red"
                    disabled={busy}
                    onClick={() => submitReview("REQUEST_CHANGES")}
                  >
                    Changes requested
                  </Button>
                </HStack>
              </Flex>
              {message ? (
                <Text color="gray.600" fontSize="sm">
                  {message}
                </Text>
              ) : null}
            </Card.Body>
          </Card.Root>

        <Stack gap={4}>
          {files.map((file) => (
            <Box
              as="section"
              key={file.filename}
              id={fileId(file.filename)}
              className="diffFile"
              overflow="hidden"
              bg="white"
              borderWidth="1px"
              borderColor="gray.200"
              rounded="lg"
              shadow="sm"
            >
              {file.patchForPierre ? (
                <PatchDiff<AnnotationMeta>
                  patch={file.patchForPierre}
                  disableWorkerPool
                  lineAnnotations={annotationsForFile(file, threads, drafts, selected)}
                  selectedLines={selected?.path === file.filename ? selected : null}
                  renderAnnotation={(annotation) => (
                    <Annotation
                      annotation={annotation}
                      owner={owner}
                      repo={repo}
                      pullNumber={pull.number}
                      selected={selected}
                      draftBody={draftBody}
                      onDraftBodyChange={setDraftBody}
                      onCancelDraft={() => setSelected(null)}
                      onAddDraft={addDraft}
                      onChanged={() => router.refresh()}
                    />
                  )}
                  options={{
                    diffStyle: "split",
                    overflow: "scroll",
                    lineHoverHighlight: "both",
                    hunkSeparators: "line-info",
                    onLineClick: (line: OnDiffLineClickProps) => selectLine(file, line),
                    enableLineSelection: true,
                    onLineSelected: (range: SelectedLineRange | null) =>
                      selectRange(file, range),
                  }}
                />
              ) : (
                <Box p={4}>
                  <Text fontWeight="semibold">{file.displayPath}</Text>
                  <Text color="gray.500">{file.status} file has no text patch from GitHub.</Text>
                </Box>
              )}
            </Box>
          ))}
        </Stack>
        </Box>
      </Flex>
    </Box>
  );

  function selectLine(file: RenderedDiffFile, line: OnDiffLineClickProps) {
    if (!file.coordinates[`${line.annotationSide}:${line.lineNumber}`]) {
      return;
    }

    if (line.event.shiftKey && selected?.path === file.filename && selected.side === line.annotationSide) {
      setSelected({
        path: file.filename,
        side: line.annotationSide,
        start: selected.start,
        end: line.lineNumber,
      });
      setMessage("");
      return;
    }

    setSelected({
      path: file.filename,
      side: line.annotationSide,
      start: line.lineNumber,
      end: line.lineNumber,
    });
    setMessage("");
  }

  function selectRange(file: RenderedDiffFile, range: SelectedLineRange | null) {
    if (!range?.side) {
      return;
    }

    const endSide = range.endSide ?? range.side;

    if (range.side !== endSide) {
      setMessage("Select lines on one side of the diff to comment.");
      return;
    }

    setSelected({
      path: file.filename,
      side: range.side,
      start: range.start,
      end: range.end,
    });
    setMessage("");
  }
}

function annotationsForFile(
  file: RenderedDiffFile,
  threads: ReviewThread[],
  drafts: DraftComment[],
  selected: { path: string; side: PierreSide; start: number; end: number } | null,
) {
  const annotations: DiffLineAnnotation<AnnotationMeta>[] = [];

  for (const thread of threads) {
    if (thread.path !== file.filename || !thread.line || !thread.side) {
      continue;
    }

    annotations.push({
      side: toPierreSide(thread.side),
      lineNumber: thread.line,
      metadata: {
        kind: "thread",
        thread,
      },
    });
  }

  for (const draft of drafts) {
    if (draft.path !== file.filename) {
      continue;
    }

    annotations.push({
      side: draft.side,
      lineNumber: draft.line,
      metadata: {
        kind: "draft",
        draft,
      },
    });
  }

  if (selected?.path === file.filename) {
    annotations.push({
      side: selected.side,
      lineNumber: Math.max(selected.start, selected.end),
      metadata: {
        kind: "selection",
      },
    });
  }

  return annotations;
}

function Annotation({
  annotation,
  owner,
  repo,
  pullNumber,
  selected,
  draftBody,
  onDraftBodyChange,
  onCancelDraft,
  onAddDraft,
  onChanged,
}: {
  annotation: DiffLineAnnotation<AnnotationMeta>;
  owner: string;
  repo: string;
  pullNumber: number;
  selected: { path: string; side: PierreSide; start: number; end: number } | null;
  draftBody: string;
  onDraftBodyChange: (body: string) => void;
  onCancelDraft: () => void;
  onAddDraft: () => void;
  onChanged: () => void;
}) {
  if (!annotation.metadata) {
    return null;
  }

  if (annotation.metadata.kind === "draft") {
    return (
      <Card.Root
        maxW="780px"
        my={2}
        mx={3}
        bg="white"
        borderColor="yellow.300"
        shadow="sm"
      >
        <Card.Body gap={2}>
          <Badge colorPalette="yellow" width="fit-content">
            Pending
          </Badge>
          <Text whiteSpace="pre-wrap" color="gray.800">
            {annotation.metadata.draft.body}
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  if (annotation.metadata.kind === "selection") {
    if (!selected) {
      return null;
    }

    return (
      <Card.Root
        maxW="780px"
        my={2}
        mx={3}
        bg="white"
        borderColor="blue.300"
        shadow="sm"
      >
        <Card.Body gap={3}>
          <HStack gap={2} wrap="wrap">
            <Badge colorPalette="blue" variant="subtle">
              {selected.side}
            </Badge>
            <Text fontWeight="semibold">
              {selected.path}:{Math.min(selected.start, selected.end)}
              {selected.end !== selected.start ? `-${Math.max(selected.start, selected.end)}` : ""}
            </Text>
          </HStack>
          <Textarea
            value={draftBody}
            minH="96px"
            resize="vertical"
            onChange={(event) => onDraftBodyChange(event.target.value)}
            placeholder="Leave a line comment"
            autoFocus
          />
          <Flex justify="flex-end" gap={2} wrap="wrap">
            <Button variant="outline" onClick={onCancelDraft}>
              Cancel
            </Button>
            <Button colorPalette="blue" disabled={!draftBody.trim()} onClick={onAddDraft}>
              Add pending comment
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <ThreadAnnotation
      thread={annotation.metadata.thread}
      owner={owner}
      repo={repo}
      pullNumber={pullNumber}
      onChanged={onChanged}
    />
  );
}

function ThreadAnnotation({
  thread,
  owner,
  repo,
  pullNumber,
  onChanged,
}: {
  thread: ReviewThread;
  owner: string;
  repo: string;
  pullNumber: number;
  onChanged: () => void;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const rootCommentId = thread.comments[0]?.databaseId;

  async function sendReply() {
    if (!rootCommentId || !reply.trim()) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/review-comments/replies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          pullNumber,
          commentId: rootCommentId,
          body: reply.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to reply");
      }

      setReply("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleResolved() {
    setBusy(true);

    try {
      const response = await fetch("/api/review-threads/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          resolved: !thread.isResolved,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to update thread");
      }

      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card.Root maxW="780px" my={2} mx={3} bg="white" borderColor="gray.200" shadow="sm">
      <Card.Body gap={3}>
        <Flex align="center" justify="space-between" gap={3}>
          <Badge colorPalette={thread.isResolved ? "green" : "blue"} width="fit-content">
            {thread.isResolved ? "Resolved" : "Conversation"}
          </Badge>
          <Button variant="plain" colorPalette="blue" size="sm" disabled={busy} onClick={toggleResolved}>
          {thread.isResolved ? "Unresolve" : "Resolve"}
          </Button>
        </Flex>
      {thread.comments.map((comment) => (
        <Box
          as="article"
          key={comment.id}
          display="grid"
          gap={2}
          pb={3}
          borderBottomWidth="1px"
          borderColor="gray.200"
          _last={{ borderBottomWidth: "0", pb: 0 }}
        >
          <Flex align="center" justify="space-between" gap={3}>
            <Text color="gray.500" fontSize="xs" fontWeight="semibold">
              {comment.author?.login ?? "unknown"}
            </Text>
            <ChakraLink color="blue.600" fontSize="xs" fontWeight="semibold" href={comment.url} target="_blank" rel="noreferrer">
              GitHub
            </ChakraLink>
          </Flex>
          <Text color="gray.800" whiteSpace="pre-wrap" lineHeight="1.6">
            {comment.body}
          </Text>
        </Box>
      ))}
      <Textarea
        value={reply}
        minH="84px"
        resize="vertical"
        onChange={(event) => setReply(event.target.value)}
        placeholder="Reply"
      />
      <Button alignSelf="flex-start" variant="outline" disabled={busy || !reply.trim()} onClick={sendReply}>
        Reply
      </Button>
      </Card.Body>
    </Card.Root>
  );
}

function fileId(path: string) {
  return `file-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

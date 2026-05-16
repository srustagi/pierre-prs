"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  HStack,
  Link as ChakraLink,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useState } from "react";
import {
  FiCheck,
  FiCornerDownRight,
  FiEdit2,
  FiExternalLink,
  FiPlus,
  FiRotateCcw,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import type { DraftComment, SelectedReviewRange } from "@/components/review/review-types";
import type { ReviewThread } from "@/lib/github-types";

export function SelectionAnnotation({
  selected,
  draftBody,
  onDraftBodyChange,
  onCancelDraft,
  onAddDraft,
}: {
  selected: SelectedReviewRange;
  draftBody: string;
  onDraftBodyChange: (body: string) => void;
  onCancelDraft: () => void;
  onAddDraft: () => void;
}) {
  return (
    <Card.Root
      maxW="624px"
      my={2}
      mx={{ base: 2, md: 3 }}
      bg="var(--pr-surface)"
      borderWidth="0.5px"
      borderColor="rgba(94, 106, 210, 0.5)"
      rounded="8px"
      shadow="none"
    >
      <Card.Body p={3} gap={3}>
        <HStack gap={2} wrap="wrap">
          <Badge
            bg="var(--pr-accent-soft)"
            color="#b8bdf8"
            borderWidth="0.5px"
            borderColor="rgba(94, 106, 210, 0.36)"
          >
            {formatSelectedSides(selected)}
          </Badge>
          <Text color="var(--pr-text)" fontWeight="510" overflowWrap="anywhere">
            {formatSelectedRange(selected)}
          </Text>
        </HStack>
        <Textarea
          value={draftBody}
          minH="72px"
          resize="vertical"
          bg="var(--pr-surface-subtle)"
          color="var(--pr-text)"
          fontSize="13px"
          borderWidth="0.5px"
          borderColor="var(--pr-border)"
          rounded="6px"
          _placeholder={{ color: "var(--pr-text-subtle)" }}
          _hover={{ borderColor: "var(--pr-border-strong)" }}
          _focusVisible={{
            borderColor: "var(--pr-accent)",
            boxShadow: "0 0 0 1px var(--pr-accent)",
          }}
          onChange={(event) => onDraftBodyChange(event.target.value)}
          placeholder="Leave a line comment"
          autoFocus
        />
        <Flex justify="flex-end" gap={2} wrap="wrap">
          <Button
            variant="outline"
            bg="var(--pr-surface-subtle)"
            color="var(--pr-text)"
            h={{ base: "36px", md: "28px" }}
            px={2}
            borderWidth="0.5px"
            borderColor="var(--pr-border)"
            rounded="6px"
            fontSize="13px"
            fontWeight="510"
            _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
            onClick={onCancelDraft}
          >
            <FiX aria-hidden="true" />
            Cancel
          </Button>
          <Button
            bg="var(--pr-accent)"
            color="white"
            h={{ base: "36px", md: "28px" }}
            px={2}
            borderWidth="0.5px"
            borderColor="var(--pr-accent-hover)"
            rounded="6px"
            fontSize="13px"
            fontWeight="510"
            disabled={!draftBody.trim()}
            _hover={{ bg: "var(--pr-accent-hover)" }}
            onClick={onAddDraft}
          >
            <FiPlus aria-hidden="true" />
            Add pending comment
          </Button>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}

export function UnmappedThreads({
  title = "Conversations not anchored in the current diff",
  threads,
  owner,
  repo,
  pullNumber,
  onChanged,
}: {
  title?: string;
  threads: ReviewThread[];
  owner: string;
  repo: string;
  pullNumber: number;
  onChanged: () => void;
}) {
  return (
    <Box px={3} py={3} borderTopWidth="0.5px" borderColor="var(--pr-border)" bg="var(--pr-bg-elevated)">
      <Text color="var(--pr-text-muted)" fontSize="12px" fontWeight="510" mb={2}>
        {title}
      </Text>
      <Stack gap={2}>
        {threads.map((thread) => (
          <ThreadAnnotation
            key={thread.id}
            thread={thread}
            owner={owner}
            repo={repo}
            pullNumber={pullNumber}
            onChanged={onChanged}
          />
        ))}
      </Stack>
    </Box>
  );
}

export function DraftAnnotation({
  draft,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onUpdateDraft,
  onDeleteDraft,
}: {
  draft: DraftComment;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onUpdateDraft: (draftId: string, body: string) => void;
  onDeleteDraft: (draftId: string) => void;
}) {
  const [body, setBody] = useState(draft.body);

  return (
    <Card.Root
      maxW="624px"
      my={2}
      mx={{ base: 2, md: 3 }}
      bg="var(--pr-yellow-soft)"
      borderWidth="0.5px"
      borderColor="rgba(214, 169, 74, 0.38)"
      rounded="8px"
      shadow="none"
    >
      <Card.Body p={3} gap={3}>
        <Flex align="center" justify="space-between" gap={3}>
          <Badge
            bg="rgba(214, 169, 74, 0.14)"
            color="var(--pr-yellow)"
            borderWidth="0.5px"
            borderColor="rgba(214, 169, 74, 0.3)"
            width="fit-content"
          >
            Pending
          </Badge>
          <HStack gap={2}>
            <Button
              size="sm"
              variant="plain"
              h={{ base: "36px", md: "28px" }}
              px={2}
              rounded="6px"
              fontSize="13px"
              fontWeight="510"
              color="var(--pr-text-muted)"
              _hover={{ color: "var(--pr-text)", bg: "rgba(255, 255, 255, 0.06)" }}
              onClick={isEditing ? onCancelEdit : onStartEdit}
            >
              {isEditing ? <FiX aria-hidden="true" /> : <FiEdit2 aria-hidden="true" />}
              {isEditing ? "Cancel edit" : "Edit"}
            </Button>
            <Button
              size="sm"
              variant="plain"
              h={{ base: "36px", md: "28px" }}
              px={2}
              rounded="6px"
              fontSize="13px"
              fontWeight="510"
              color="var(--pr-red)"
              _hover={{ bg: "rgba(229, 104, 104, 0.12)" }}
              onClick={() => onDeleteDraft(draft.id)}
            >
              <FiTrash2 aria-hidden="true" />
              Remove
            </Button>
          </HStack>
        </Flex>

        {isEditing ? (
          <>
            <Textarea
              value={body}
              minH="72px"
              resize="vertical"
              bg="var(--pr-surface-subtle)"
              color="var(--pr-text)"
              fontSize="13px"
              borderWidth="0.5px"
              borderColor="var(--pr-border)"
              rounded="6px"
              _hover={{ borderColor: "var(--pr-border-strong)" }}
              _focusVisible={{
                borderColor: "var(--pr-accent)",
                boxShadow: "0 0 0 1px var(--pr-accent)",
              }}
              onChange={(event) => setBody(event.target.value)}
            />
            <Button
              alignSelf="flex-start"
              bg="var(--pr-accent)"
              color="white"
              h={{ base: "36px", md: "28px" }}
              px={2}
              borderWidth="0.5px"
              borderColor="var(--pr-accent-hover)"
              rounded="6px"
              fontSize="13px"
              fontWeight="510"
              disabled={!body.trim()}
              _hover={{ bg: "var(--pr-accent-hover)" }}
              onClick={() => onUpdateDraft(draft.id, body)}
            >
              <FiCheck aria-hidden="true" />
              Save comment
            </Button>
          </>
        ) : (
          <Text whiteSpace="pre-wrap" color="var(--pr-text)" lineHeight="1.6">
            {draft.body}
          </Text>
        )}
      </Card.Body>
    </Card.Root>
  );
}

export function ThreadAnnotation({
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
  const [error, setError] = useState("");
  const rootCommentId = thread.comments[0]?.databaseId;

  async function sendReply() {
    if (!rootCommentId || !reply.trim()) {
      return;
    }

    setBusy(true);
    setError("");

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
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to reply");
    } finally {
      setBusy(false);
    }
  }

  async function toggleResolved() {
    setBusy(true);
    setError("");

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
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Unable to update thread");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card.Root
      maxW="624px"
      my={2}
      mx={{ base: 2, md: 3 }}
      bg={thread.isResolved ? "var(--pr-green-soft)" : "var(--pr-surface)"}
      borderWidth="0.5px"
      borderColor={thread.isResolved ? "rgba(76, 183, 130, 0.34)" : "rgba(94, 106, 210, 0.42)"}
      rounded="8px"
      shadow="none"
    >
      <Card.Body p={3} gap={3}>
        <Flex align="center" justify="space-between" gap={3}>
          <HStack gap={2} wrap="wrap">
            <Badge
              bg={thread.isResolved ? "rgba(76, 183, 130, 0.14)" : "var(--pr-accent-soft)"}
              color={thread.isResolved ? "var(--pr-green)" : "#b8bdf8"}
              borderWidth="0.5px"
              borderColor={thread.isResolved ? "rgba(76, 183, 130, 0.3)" : "rgba(94, 106, 210, 0.36)"}
              width="fit-content"
            >
              {thread.isResolved ? "Resolved" : "Unresolved conversation"}
            </Badge>
            <Text color="var(--pr-text-muted)" fontSize="12px" overflowWrap="anywhere">
              {formatThreadRange(thread)}
            </Text>
          </HStack>
          <Button
            variant="outline"
            bg="var(--pr-surface-subtle)"
            color={thread.isResolved ? "var(--pr-text-muted)" : "var(--pr-green)"}
            h={{ base: "36px", md: "28px" }}
            px={2}
            borderWidth="0.5px"
            borderColor={thread.isResolved ? "var(--pr-border)" : "rgba(76, 183, 130, 0.34)"}
            rounded="6px"
            size="sm"
            fontSize="13px"
            fontWeight="510"
            disabled={busy}
            _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
            onClick={toggleResolved}
          >
            {thread.isResolved ? <FiRotateCcw aria-hidden="true" /> : <FiCheck aria-hidden="true" />}
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
            borderBottomWidth="0.5px"
            borderColor="var(--pr-border)"
            _last={{ borderBottomWidth: "0", pb: 0 }}
          >
            <Flex align="center" justify="space-between" gap={3}>
              <HStack gap={2} minW={0}>
                <Text color="var(--pr-text)" fontSize="sm" fontWeight="510" truncate>
                  {comment.author?.login ?? "unknown"}
                </Text>
                <Text color="var(--pr-text-subtle)" fontSize="xs">
                  {formatTimestamp(comment.createdAt)}
                </Text>
              </HStack>
              <ChakraLink
                color="#b8bdf8"
                fontSize="xs"
                fontWeight="510"
                href={comment.url}
                target="_blank"
                rel="noreferrer"
                display="inline-flex"
                alignItems="center"
                gap={1}
              >
                <FiExternalLink aria-hidden="true" />
                GitHub
              </ChakraLink>
            </Flex>
            <Text color="var(--pr-text)" whiteSpace="pre-wrap" lineHeight="1.6">
              {comment.body}
            </Text>
          </Box>
        ))}

        <Textarea
          value={reply}
          minH="67px"
          resize="vertical"
          bg="var(--pr-surface-subtle)"
          color="var(--pr-text)"
          fontSize="13px"
          borderWidth="0.5px"
          borderColor="var(--pr-border)"
          rounded="6px"
          _placeholder={{ color: "var(--pr-text-subtle)" }}
          _hover={{ borderColor: "var(--pr-border-strong)" }}
          _focusVisible={{
            borderColor: "var(--pr-accent)",
            boxShadow: "0 0 0 1px var(--pr-accent)",
          }}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Reply to this thread"
        />
        <Button
          alignSelf="flex-start"
          variant="outline"
          bg="var(--pr-surface-subtle)"
          color="var(--pr-text)"
          h={{ base: "36px", md: "28px" }}
          px={2}
          borderWidth="0.5px"
          borderColor="var(--pr-border)"
          rounded="6px"
          fontSize="13px"
          fontWeight="510"
          disabled={busy || !reply.trim()}
          loading={busy}
          _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
          onClick={sendReply}
        >
          <FiCornerDownRight aria-hidden="true" />
          Reply
        </Button>
        {error ? (
          <Text color="var(--pr-red)" fontSize="sm">
            {error}
          </Text>
        ) : null}
      </Card.Body>
    </Card.Root>
  );
}

function formatSelectedSides(selected: SelectedReviewRange) {
  const startSide = selected.side === "additions" ? "Right" : "Left";
  const endSide = (selected.endSide ?? selected.side) === "additions" ? "Right" : "Left";

  return startSide === endSide ? `${startSide} side` : `${startSide} to ${endSide}`;
}

function formatSelectedRange(selected: SelectedReviewRange) {
  const endSide = selected.endSide ?? selected.side;

  if (selected.side === endSide) {
    const first = Math.min(selected.start, selected.end);
    const last = Math.max(selected.start, selected.end);
    return `${selected.path}:${first}${first === last ? "" : `-${last}`}`;
  }

  return `${selected.path}:${selected.start} -> ${selected.end}`;
}

function formatThreadRange(thread: ReviewThread) {
  if (!thread.line) {
    return thread.path;
  }

  if (!thread.startLine) {
    return `${thread.path}:${thread.line}`;
  }

  if (thread.startLine === thread.line) {
    return `${thread.path}:${thread.line}`;
  }

  if (!thread.startSide || !thread.side || thread.startSide === thread.side) {
    return `${thread.path}:${thread.startLine}-${thread.line}`;
  }

  const start = formatGitHubThreadEndpoint(thread.startSide, thread.startLine);
  const end = formatGitHubThreadEndpoint(thread.side, thread.line);

  return `${thread.path}:${start} -> ${end}`;
}

function formatGitHubThreadEndpoint(side: ReviewThread["side"], line: number) {
  if (side === "LEFT") {
    return `old line ${line}`;
  }

  if (side === "RIGHT") {
    return `new line ${line}`;
  }

  return `line ${line}`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

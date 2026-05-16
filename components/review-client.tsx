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
  TreeView,
  createFileTreeCollection,
  type FilePathTreeNode,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatchDiff, type DiffLineAnnotation } from "@pierre/diffs/react";
import type { OnDiffLineClickProps, SelectedLineRange } from "@pierre/diffs";
import {
  FiAlertCircle,
  FiAlignLeft,
  FiArrowLeft,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiChevronUp,
  FiCircle,
  FiCornerDownRight,
  FiEdit2,
  FiExternalLink,
  FiFile,
  FiFolder,
  FiGithub,
  FiGitPullRequest,
  FiList,
  FiMessageSquare,
  FiMinus,
  FiMoon,
  FiMoreVertical,
  FiPlus,
  FiRotateCcw,
  FiSend,
  FiSun,
  FiThumbsUp,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { usePrTheme } from "@/app/provider";
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

type FileFilter = "all" | "unreviewed" | "commented";

type FileSummary = {
  threads: number;
  unresolved: number;
  drafts: number;
};

type Props = {
  owner: string;
  repo: string;
  pull: PullRequest;
  files: RenderedDiffFile[];
  threads: ReviewThread[];
};

const SIDEBAR_MIN_WIDTH = 208;
const SIDEBAR_MAX_WIDTH = 448;
const SIDEBAR_KEYBOARD_STEP = 20;

function useIsMobileReviewMode() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const syncMobileMode = () => setIsMobile(query.matches);

    syncMobileMode();
    query.addEventListener("change", syncMobileMode);

    return () => query.removeEventListener("change", syncMobileMode);
  }, []);

  return isMobile;
}

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
  const [reviewedPaths, setReviewedPaths] = useState<string[]>([]);
  const [collapsedPaths, setCollapsedPaths] = useState<string[]>([]);
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [activePath, setActivePath] = useState(files[0]?.filename ?? "");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [reviewMapWidth, setReviewMapWidth] = useState(256);
  const [unwrappedPaths, setUnwrappedPaths] = useState<string[]>([]);
  const { theme, toggleTheme } = usePrTheme();
  const lightMode = theme === "light";
  const mobileReviewMode = useIsMobileReviewMode();

  const filesByPath = useMemo(() => new Map(files.map((file) => [file.filename, file])), [files]);
  const fileSummaries = useMemo(
    () =>
      new Map(
        files.map((file) => {
          const fileThreads = threads.filter((thread) => thread.path === file.filename);
          const fileDrafts = drafts.filter((draft) => draft.path === file.filename);

          return [
            file.filename,
            {
              threads: fileThreads.length,
              unresolved: fileThreads.filter((thread) => !thread.isResolved).length,
              drafts: fileDrafts.length,
            },
          ];
        }),
      ),
    [drafts, files, threads],
  );
  const filteredFiles = files.filter((file) => {
    const summaryForFile = fileSummaries.get(file.filename);
    const reviewed = reviewedPaths.includes(file.filename);

    if (fileFilter === "unreviewed") {
      return !reviewed;
    }

    if (fileFilter === "commented") {
      return Boolean(summaryForFile && (summaryForFile.threads > 0 || summaryForFile.drafts > 0));
    }

    return true;
  });
  const fileTree = createFileTreeCollection(filteredFiles.map((file) => file.filename));
  const reviewedCount = files.filter((file) => reviewedPaths.includes(file.filename)).length;
  const unresolvedCount = threads.filter((thread) => !thread.isResolved).length;

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

  function cancelSelection() {
    setDraftBody("");
    setSelected(null);
  }

  function updateDraft(draftId: string, body: string) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === draftId ? { ...draft, body: body.trim() } : draft)),
    );
    setEditingDraftId(null);
  }

  function deleteDraft(draftId: string) {
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
    if (editingDraftId === draftId) {
      setEditingDraftId(null);
    }
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
    <Box minH="100vh" bg="var(--pr-bg)" color="var(--pr-text)">
      <Flex align="stretch" direction={{ base: "column", xl: "row" }} minH="100vh">
        <Box
          as="aside"
          aria-label="Review map"
          position="sticky"
          top="0"
          zIndex={{ base: 20, xl: "auto" }}
          h={{ base: "auto", xl: "100vh" }}
          maxH={{ base: "44vh", xl: "100vh" }}
          w={{ base: "100%", xl: `${reviewMapWidth}px` }}
          overflow="auto"
          bg="var(--pr-bg-elevated)"
          borderRightWidth={{ base: "0", xl: "0.5px" }}
          borderBottomWidth={{ base: "0.5px", xl: "0" }}
          borderColor="var(--pr-border)"
          p={{ base: 2, xl: 3 }}
          flexShrink={0}
        >
          <Box display={{ base: "none", xl: "block" }}>
            <SidebarResizeHandle
              edge="right"
              label="Resize review map"
              onPointerDown={(event) => startSidebarResize("left", event, setReviewMapWidth)}
              onKeyDown={(event) => resizeSidebarWithKeyboard("left", event, setReviewMapWidth)}
            />
          </Box>

          <HStack justify="space-between" gap={2} mb={{ base: 2, xl: 4 }} wrap="wrap">
            <ChakraLink
              asChild
              color="var(--pr-text-muted)"
              fontSize="13px"
              fontWeight="510"
              display="inline-flex"
              alignItems="center"
              gap={2}
              h="28px"
              _hover={{ color: "var(--pr-text)" }}
            >
              <Link href="/">
                <FiArrowLeft aria-hidden="true" />
                Repos
              </Link>
            </ChakraLink>
            <HStack gap={1.5} flexShrink={0}>
              <Button
                variant="outline"
                aria-pressed={lightMode}
                bg={lightMode ? "var(--pr-surface-hover)" : "var(--pr-surface)"}
                color="var(--pr-text)"
                h="28px"
                px={2}
                borderWidth="0.5px"
                borderColor={lightMode ? "var(--pr-border-strong)" : "var(--pr-border)"}
                rounded="6px"
                fontSize="13px"
                fontWeight="510"
                _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
                onClick={toggleTheme}
              >
                {lightMode ? <FiMoon aria-hidden="true" /> : <FiSun aria-hidden="true" />}
                {lightMode ? "Dark mode" : "Light mode"}
              </Button>
              <Button
                asChild
                variant="outline"
                bg="var(--pr-surface)"
                color="var(--pr-text)"
                h="28px"
                px={2}
                borderWidth="0.5px"
                borderColor="var(--pr-border)"
                rounded="6px"
                fontSize="13px"
                fontWeight="510"
                _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
              >
                <a href={pull.htmlUrl} target="_blank" rel="noreferrer">
                  <FiGithub aria-hidden="true" />
                  Open on GitHub
                </a>
              </Button>
            </HStack>
          </HStack>

          <Stack gap={3}>
            <Box>
              <HStack gap={2} color="var(--pr-text)">
                <FiGitPullRequest aria-hidden="true" />
                <Heading as="h2" size="sm" fontWeight="510">
                  Review map
                </Heading>
              </HStack>
              <Text color="var(--pr-text-muted)" fontSize="12px" mt={1}>
                {reviewedCount}/{files.length} files reviewed, {unresolvedCount} unresolved
              </Text>
            </Box>

            <HStack
              bg="var(--pr-surface-subtle)"
              borderWidth="0.5px"
              borderColor="var(--pr-border)"
              p={1}
              rounded="6px"
              width="fit-content"
              maxW="100%"
              wrap="wrap"
            >
              {(["all", "unreviewed", "commented"] as const).map((filter) => (
                <Button
                  key={filter}
                  size="xs"
                  variant="ghost"
                  h="24px"
                  px={2}
                  bg={fileFilter === filter ? "var(--pr-surface)" : "transparent"}
                  color={fileFilter === filter ? "var(--pr-text)" : "var(--pr-text-muted)"}
                  borderWidth="0.5px"
                  borderColor={fileFilter === filter ? "var(--pr-border-strong)" : "transparent"}
                  rounded="5px"
                  fontSize="12px"
                  fontWeight="510"
                  _hover={{ bg: "var(--pr-surface-hover)", color: "var(--pr-text)" }}
                  onClick={() => setFileFilter(filter)}
                >
                  {filterIcon(filter)}
                  {filterLabel(filter)}
                </Button>
              ))}
            </HStack>

            <ReviewFileTree
              collection={fileTree}
              activePath={activePath}
              reviewedPaths={reviewedPaths}
              fileSummaries={fileSummaries}
              filesByPath={filesByPath}
              onFileActivate={setActivePath}
              onReviewedChange={setReviewedPath}
            />
          </Stack>
        </Box>

        <Box as="main" minW={0} flex="1" p={{ base: 3, lg: 4 }} pb={{ base: "88px", xl: 4 }}>
          <Flex
            as="header"
            align={{ base: "stretch", md: "flex-start" }}
            justify="space-between"
            direction={{ base: "column", md: "row" }}
            gap={4}
            mb={4}
          >
            <Box minW={0}>
              <Text color="var(--pr-text-muted)" fontSize="13px" fontWeight="510">
                {owner}/{repo} #{pull.number}
              </Text>
              <Heading as="h1" fontSize="22px" lineHeight="1.2" letterSpacing="normal" mt={1} mb={2} fontWeight="510">
                {pull.title}
              </Heading>
              <HStack gap={2} color="var(--pr-text-muted)" fontSize="13px" wrap="wrap">
                <Text>{pull.headRef}</Text>
                <Text>into</Text>
                <Text>{pull.baseRef}</Text>
                <Text>by {pull.author ?? "unknown"}</Text>
                <Badge
                  bg={pull.draft ? "var(--pr-yellow-soft)" : "var(--pr-green-soft)"}
                  color={pull.draft ? "var(--pr-yellow)" : "var(--pr-green)"}
                  borderWidth="0.5px"
                  borderColor={pull.draft ? "rgba(214, 169, 74, 0.32)" : "rgba(76, 183, 130, 0.32)"}
                >
                  {pull.draft ? "Draft" : pull.state}
                </Badge>
              </HStack>
            </Box>
          </Flex>

          <Stack gap={3}>
            {filteredFiles.map((file) => {
              const reviewed = reviewedPaths.includes(file.filename);
              const collapsed = collapsedPaths.includes(file.filename);
              const wrapped = !unwrappedPaths.includes(file.filename);
              const summaryForFile = fileSummaries.get(file.filename);

              return (
                <Box
                  as="section"
                  key={file.filename}
                  id={fileId(file.filename)}
                  className="diffFile"
                  overflow="hidden"
                  bg="var(--pr-bg-elevated)"
                  borderWidth="0.5px"
                  borderColor={activePath === file.filename ? "rgba(94, 106, 210, 0.5)" : "var(--pr-border)"}
                  rounded="8px"
                  scrollMarginTop={{ base: "160px", xl: "12px" }}
                  shadow={activePath === file.filename ? "0 0 0 1px rgba(94, 106, 210, 0.18)" : "none"}
                  onMouseEnter={() => setActivePath(file.filename)}
                >
                  <Flex
                    align="flex-start"
                    justify="space-between"
                    gap={3}
                    px={3}
                    py={2}
                    borderBottomWidth={collapsed ? "0" : "0.5px"}
                    borderColor="var(--pr-border)"
                    bg={reviewed ? "var(--pr-green-soft)" : "var(--pr-surface)"}
                  >
                    <Flex align="flex-start" gap={2} minW={0} flex="1">
                      <Button
                        aria-label={collapsed ? "Expand diff" : "Collapse diff"}
                        title={collapsed ? "Expand diff" : "Collapse diff"}
                        variant="plain"
                        w="24px"
                        minW="24px"
                        h="24px"
                        p={0}
                        mt="1px"
                        rounded="5px"
                        color="var(--pr-text-muted)"
                        _hover={{ bg: "var(--pr-surface-hover)", color: "var(--pr-text)" }}
                        onClick={() => togglePath(file.filename, collapsedPaths, setCollapsedPaths)}
                      >
                        {collapsed ? <FiPlus aria-hidden="true" /> : <FiMinus aria-hidden="true" />}
                      </Button>
                      <Stack gap={1} minW={0}>
                        <HStack gap={2} wrap="wrap">
                          <Badge borderWidth="0.5px" {...statusBadgeStyle(file.status)}>
                            {file.status}
                          </Badge>
                          {summaryForFile?.unresolved ? (
                            <Badge
                              bg="var(--pr-accent-soft)"
                              color="#b8bdf8"
                              borderWidth="0.5px"
                              borderColor="rgba(94, 106, 210, 0.36)"
                            >
                              {summaryForFile.unresolved} unresolved
                            </Badge>
                          ) : null}
                          {summaryForFile?.drafts ? (
                            <Badge
                              bg="var(--pr-yellow-soft)"
                              color="var(--pr-yellow)"
                              borderWidth="0.5px"
                              borderColor="rgba(214, 169, 74, 0.32)"
                            >
                              {summaryForFile.drafts} pending
                            </Badge>
                          ) : null}
                        </HStack>
                        <Text color="var(--pr-text)" fontSize="13px" fontWeight="510" overflowWrap="anywhere">
                          {file.displayPath}
                        </Text>
                        <Text color="var(--pr-text-muted)" fontSize="12px">
                          <Text as="span" color="var(--pr-green)">
                            +{file.additions}
                          </Text>{" "}
                          <Text as="span" color="var(--pr-red)">
                            -{file.deletions}
                          </Text>{" "}
                          across {file.changes} changed lines
                        </Text>
                      </Stack>
                    </Flex>

                    <HStack gap={1.5} flexShrink={0} justify="flex-end">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={wrapped ? "Disable line wrap" : "Enable line wrap"}
                        aria-pressed={wrapped}
                        title={wrapped ? "Disable line wrap" : "Enable line wrap"}
                        bg={wrapped ? "var(--pr-surface-hover)" : "var(--pr-surface-subtle)"}
                        color={wrapped ? "var(--pr-text)" : "var(--pr-text-muted)"}
                        minW={{ base: "32px", md: "auto" }}
                        h={{ base: "32px", md: "28px" }}
                        px={{ base: 0, md: 2 }}
                        borderWidth="0.5px"
                        borderColor={wrapped ? "var(--pr-border-strong)" : "var(--pr-border)"}
                        rounded="6px"
                        fontSize="13px"
                        fontWeight="510"
                        _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
                        onClick={() => togglePath(file.filename, unwrappedPaths, setUnwrappedPaths)}
                      >
                        <FiAlignLeft aria-hidden="true" />
                        <Text as="span" display={{ base: "none", md: "inline" }}>
                          Wrap
                        </Text>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={reviewed ? "Mark file unreviewed" : "Mark file reviewed"}
                        title={reviewed ? "Mark file unreviewed" : "Mark file reviewed"}
                        bg={reviewed ? "rgba(76, 183, 130, 0.14)" : "var(--pr-surface-subtle)"}
                        color={reviewed ? "var(--pr-green)" : "var(--pr-text)"}
                        minW={{ base: "32px", md: "auto" }}
                        h={{ base: "32px", md: "28px" }}
                        px={{ base: 0, md: 2 }}
                        borderWidth="0.5px"
                        borderColor={reviewed ? "rgba(76, 183, 130, 0.34)" : "var(--pr-border)"}
                        rounded="6px"
                        fontSize="13px"
                        fontWeight="510"
                        _hover={{ bg: reviewed ? "rgba(76, 183, 130, 0.2)" : "var(--pr-surface-hover)" }}
                        onClick={() => toggleReviewedPath(file.filename)}
                      >
                        <FiCheck aria-hidden="true" />
                        <Text as="span" display={{ base: "none", md: "inline" }}>
                          {reviewed ? "Reviewed" : "Mark reviewed"}
                        </Text>
                      </Button>
                    </HStack>
                  </Flex>

                  {!collapsed && file.patchForPierre ? (
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
                          editingDraftId={editingDraftId}
                          onDraftBodyChange={setDraftBody}
                          onCancelDraft={cancelSelection}
                          onAddDraft={addDraft}
                          onUpdateDraft={updateDraft}
                          onDeleteDraft={deleteDraft}
                          onStartEditDraft={setEditingDraftId}
                          onChanged={() => router.refresh()}
                        />
                      )}
                      renderGutterUtility={(getHoveredLine) => (
                        <CommentAffordance
                          onClick={() => {
                            const hoveredLine = getHoveredLine();

                            if (hoveredLine) {
                              selectHoveredLine(file, hoveredLine.lineNumber, hoveredLine.side);
                            }
                          }}
                        />
                      )}
                      options={{
                        diffStyle: mobileReviewMode ? "unified" : "split",
                        overflow: wrapped ? "wrap" : "scroll",
                        themeType: theme,
                        lineHoverHighlight: "both",
                        hunkSeparators: "line-info",
                        enableGutterUtility: true,
                        disableLineNumbers: mobileReviewMode,
                        onLineClick: (line: OnDiffLineClickProps) => selectLine(file, line),
                        enableLineSelection: true,
                        onLineSelected: (range: SelectedLineRange | null) => selectRange(file, range),
                      }}
                    />
                  ) : null}

                  {!collapsed && !file.patchForPierre ? (
                    <Box p={4}>
                      <Text color="var(--pr-text-muted)">{file.status} file has no text patch from GitHub.</Text>
                    </Box>
                  ) : null}
                </Box>
              );
            })}
          </Stack>
        </Box>

        <ReviewTray
          drafts={drafts}
          summary={summary}
          busy={busy}
          message={message}
          reviewedCount={reviewedCount}
          fileCount={files.length}
          unresolvedCount={unresolvedCount}
          onSummaryChange={setSummary}
          onSubmit={submitReview}
          onClearDrafts={() => {
            setDrafts([]);
            setEditingDraftId(null);
          }}
        />
      </Flex>
    </Box>
  );

  function selectLine(file: RenderedDiffFile, line: OnDiffLineClickProps) {
    if (!file.coordinates[`${line.annotationSide}:${line.lineNumber}`]) {
      return;
    }

    setActivePath(file.filename);

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

    setActivePath(file.filename);
    setSelected({
      path: file.filename,
      side: range.side,
      start: range.start,
      end: range.end,
    });
    setMessage("");
  }

  function selectHoveredLine(file: RenderedDiffFile, lineNumber: number, side: PierreSide) {
    if (!file.coordinates[`${side}:${lineNumber}`]) {
      return;
    }

    setActivePath(file.filename);
    setSelected({
      path: file.filename,
      side,
      start: lineNumber,
      end: lineNumber,
    });
    setMessage("");
  }

  function setReviewedPath(path: string, reviewed: boolean) {
    setReviewedPaths((current) => {
      if (reviewed) {
        return current.includes(path) ? current : [...current, path];
      }

      return current.filter((currentPath) => currentPath !== path);
    });
  }

  function toggleReviewedPath(path: string) {
    setReviewedPaths((current) =>
      current.includes(path) ? current.filter((currentPath) => currentPath !== path) : [...current, path],
    );
  }
}

function ReviewFileTree({
  collection,
  activePath,
  reviewedPaths,
  fileSummaries,
  filesByPath,
  onFileActivate,
  onReviewedChange,
}: {
  collection: ReturnType<typeof createFileTreeCollection>;
  activePath: string;
  reviewedPaths: string[];
  fileSummaries: Map<string, FileSummary>;
  filesByPath: Map<string, RenderedDiffFile>;
  onFileActivate: (path: string) => void;
  onReviewedChange: (path: string, reviewed: boolean) => void;
}) {
  if (collection.getNodeChildren(collection.rootNode).length === 0) {
    return (
      <Text color="var(--pr-text-muted)" fontSize="13px">
        No files match this filter.
      </Text>
    );
  }

  return (
    <TreeView.Root
      collection={collection}
      defaultExpandedValue={collection.getBranchValues()}
      pb={{ base: 1, xl: 0 }}
      variant="subtle"
    >
      <TreeView.Tree>
        <TreeView.Node
          indentGuide={<TreeView.BranchIndentGuide borderColor="var(--pr-border)" />}
          render={({ node, nodeState }) => (
            <ReviewFileTreeRow
              node={node}
              isBranch={nodeState.isBranch}
              isExpanded={nodeState.expanded}
              activePath={activePath}
              reviewedPaths={reviewedPaths}
              fileSummaries={fileSummaries}
              filesByPath={filesByPath}
              onFileActivate={onFileActivate}
              onReviewedChange={onReviewedChange}
            />
          )}
        />
      </TreeView.Tree>
    </TreeView.Root>
  );
}

function ReviewFileTreeRow({
  node,
  isBranch,
  isExpanded,
  activePath,
  reviewedPaths,
  fileSummaries,
  filesByPath,
  onFileActivate,
  onReviewedChange,
}: {
  node: FilePathTreeNode<{ label: string; value: string }>;
  isBranch: boolean;
  isExpanded: boolean;
  activePath: string;
  reviewedPaths: string[];
  fileSummaries: Map<string, FileSummary>;
  filesByPath: Map<string, RenderedDiffFile>;
  onFileActivate: (path: string) => void;
  onReviewedChange: (path: string, reviewed: boolean) => void;
}) {
  if (isBranch) {
    return (
      <TreeView.BranchControl
        h="28px"
        gap={1.5}
        rounded="6px"
        color="var(--pr-text-muted)"
        fontSize="13px"
        fontWeight="510"
        _hover={{ bg: "var(--pr-surface-hover)", color: "var(--pr-text)" }}
      >
        <TreeView.BranchTrigger color="inherit">
          {isExpanded ? <FiChevronDown aria-hidden="true" /> : <FiChevronRight aria-hidden="true" />}
        </TreeView.BranchTrigger>
        <FiFolder aria-hidden="true" />
        <TreeView.BranchText asChild>
          <Text as="span" truncate>
            {node.label}
          </Text>
        </TreeView.BranchText>
      </TreeView.BranchControl>
    );
  }

  const file = filesByPath.get(node.value);

  if (!file) {
    return null;
  }

  const summaryForFile = fileSummaries.get(file.filename);
  const reviewed = reviewedPaths.includes(file.filename);
  const isActive = activePath === file.filename;

  return (
    <TreeView.Item
      display="grid"
      gridTemplateColumns="auto 1fr"
      gap={2}
      py={1.5}
      pr={1.5}
      rounded="6px"
      bg={isActive ? "var(--pr-accent-soft)" : "transparent"}
      borderWidth="0.5px"
      borderColor={isActive ? "rgba(94, 106, 210, 0.42)" : "transparent"}
    >
      <input
        type="checkbox"
        checked={reviewed}
        aria-label={`Mark ${file.displayPath} reviewed`}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onReviewedChange(file.filename, event.currentTarget.checked)}
      />
      <ChakraLink
        href={`#${fileId(file.filename)}`}
        display="grid"
        gap={1}
        minW={0}
        onClick={() => onFileActivate(file.filename)}
      >
        <HStack gap={1.5} minW={0} align="flex-start">
          <Box as={FiFile} aria-hidden="true" color="var(--pr-text-subtle)" flexShrink={0} mt="2px" />
          <TreeView.ItemText asChild>
            <Text overflowWrap="anywhere" fontSize="13px" fontWeight="510">
              {node.label}
            </Text>
          </TreeView.ItemText>
        </HStack>
        <HStack gap={2} wrap="wrap">
          <Badge size="sm" borderWidth="0.5px" {...statusBadgeStyle(file.status)}>
            {file.status}
          </Badge>
          <Text color="var(--pr-text-subtle)" fontSize="xs">
            +{file.additions} -{file.deletions}
          </Text>
          {summaryForFile?.unresolved ? (
            <Badge
              size="sm"
              bg="var(--pr-accent-soft)"
              color="#b8bdf8"
              borderWidth="0.5px"
              borderColor="rgba(94, 106, 210, 0.36)"
            >
              {summaryForFile.unresolved} open
            </Badge>
          ) : null}
          {summaryForFile?.drafts ? (
            <Badge
              size="sm"
              bg="var(--pr-yellow-soft)"
              color="var(--pr-yellow)"
              borderWidth="0.5px"
              borderColor="rgba(214, 169, 74, 0.32)"
            >
              {summaryForFile.drafts} pending
            </Badge>
          ) : null}
        </HStack>
      </ChakraLink>
    </TreeView.Item>
  );
}

function ReviewTray({
  drafts,
  summary,
  busy,
  message,
  reviewedCount,
  fileCount,
  unresolvedCount,
  onSummaryChange,
  onSubmit,
  onClearDrafts,
}: {
  drafts: DraftComment[];
  summary: string;
  busy: boolean;
  message: string;
  reviewedCount: number;
  fileCount: number;
  unresolvedCount: number;
  onSummaryChange: (summary: string) => void;
  onSubmit: (event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES") => void;
  onClearDrafts: () => void;
}) {
  const [trayWidth, setTrayWidth] = useState(288);
  const [mobileTrayOpen, setMobileTrayOpen] = useState(false);

  return (
    <Box
      as="aside"
      aria-label="Submit review"
      position={{ base: "fixed", xl: "sticky" }}
      top={{ base: "auto", xl: "0" }}
      bottom={{ base: "0", xl: "auto" }}
      left={{ base: "0", xl: "auto" }}
      right={{ base: "0", xl: "auto" }}
      zIndex={{ base: 30, xl: "auto" }}
      h={{ base: "auto", xl: "100vh" }}
      maxH={{ base: mobileTrayOpen ? "78vh" : "64px", xl: "100vh" }}
      w={{ base: "100%", xl: `${trayWidth}px` }}
      overflow="hidden"
      bg="var(--pr-bg-elevated)"
      borderLeftWidth={{ base: "0", xl: "0.5px" }}
      borderTopWidth={{ base: "0.5px", xl: "0" }}
      borderColor="var(--pr-border)"
      roundedTop={{ base: "14px", xl: "0" }}
      shadow={{ base: "0 -16px 40px rgba(0, 0, 0, 0.42)", xl: "none" }}
      p={{ base: 0, xl: 3 }}
      flexShrink={0}
    >
      <Box display={{ base: "none", xl: "block" }}>
        <SidebarResizeHandle
          edge="left"
          label="Resize review tray"
          onPointerDown={(event) => startSidebarResize("right", event, setTrayWidth)}
          onKeyDown={(event) => resizeSidebarWithKeyboard("right", event, setTrayWidth)}
        />
      </Box>

      <Button
        display={{ base: "flex", xl: "none" }}
        variant="plain"
        w="100%"
        h="56px"
        px={3}
        roundedTop="14px"
        justifyContent="space-between"
        color="var(--pr-text)"
        bg="var(--pr-bg-elevated)"
        _hover={{ bg: "var(--pr-surface-hover)" }}
        onClick={() => setMobileTrayOpen((open) => !open)}
      >
        <HStack gap={2} minW={0}>
          <FiSend aria-hidden="true" />
          <Box textAlign="left" minW={0}>
            <Text fontSize="13px" fontWeight="510">
              Review tray
            </Text>
            <Text color="var(--pr-text-muted)" fontSize="12px" truncate>
              {drafts.length} pending, {reviewedCount}/{fileCount} files reviewed
            </Text>
          </Box>
        </HStack>
        {mobileTrayOpen ? <FiChevronDown aria-hidden="true" /> : <FiChevronUp aria-hidden="true" />}
      </Button>

      <Stack
        gap={3}
        display={{ base: mobileTrayOpen ? "flex" : "none", xl: "flex" }}
        maxH={{ base: "calc(78vh - 56px)", xl: "none" }}
        overflowY={{ base: "auto", xl: "visible" }}
        px={{ base: 3, xl: 0 }}
        pb={{ base: "calc(12px + env(safe-area-inset-bottom))", xl: 0 }}
      >
        <Box display={{ base: "none", xl: "block" }}>
          <HStack gap={2} color="var(--pr-text)">
            <FiSend aria-hidden="true" />
            <Heading as="h2" size="sm" fontWeight="510">
              Review tray
            </Heading>
          </HStack>
          <Text color="var(--pr-text-muted)" fontSize="12px" mt={1}>
            {drafts.length} pending line comment{drafts.length === 1 ? "" : "s"} ready to send
          </Text>
        </Box>

        <Card.Root bg="var(--pr-surface-subtle)" borderWidth="0.5px" borderColor="var(--pr-border)" rounded="6px">
          <Card.Body p={3} gap={2}>
            <HStack justify="space-between">
              <Text color="var(--pr-text-muted)" fontSize="13px">
                Files reviewed
              </Text>
              <Text color="var(--pr-text)" fontSize="13px" fontWeight="510">
                {reviewedCount}/{fileCount}
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="var(--pr-text-muted)" fontSize="13px">
                Unresolved threads
              </Text>
              <Text color="var(--pr-text)" fontSize="13px" fontWeight="510">
                {unresolvedCount}
              </Text>
            </HStack>
          </Card.Body>
        </Card.Root>

        {drafts.length > 0 ? (
          <Stack gap={2}>
            {drafts.map((draft) => (
              <Box
                key={draft.id}
                rounded="6px"
                borderWidth="0.5px"
                borderColor="rgba(214, 169, 74, 0.34)"
                bg="var(--pr-yellow-soft)"
                p={3}
              >
                <Text color="var(--pr-yellow)" fontSize="xs" fontWeight="510" overflowWrap="anywhere">
                  {draft.path}:{draft.line}
                </Text>
                <Text color="var(--pr-text)" fontSize="sm" mt={1} lineClamp={3} whiteSpace="pre-wrap">
                  {draft.body}
                </Text>
              </Box>
            ))}
            <Button
              size="sm"
              variant="outline"
              bg="var(--pr-surface)"
              color="var(--pr-text)"
              h={{ base: "40px", xl: "28px" }}
              px={2}
              borderWidth="0.5px"
              borderColor="var(--pr-border)"
              rounded="6px"
              fontSize="13px"
              fontWeight="510"
              disabled={busy}
              _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
              onClick={onClearDrafts}
            >
              <FiTrash2 aria-hidden="true" />
              Clear all pending comments
            </Button>
          </Stack>
        ) : null}

        <Textarea
          value={summary}
          minH="88px"
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
          onChange={(event) => onSummaryChange(event.target.value)}
          placeholder="Optional review summary"
        />

        <Stack gap={2}>
          <Button
            variant="outline"
            bg="var(--pr-surface)"
            color="var(--pr-text)"
            h={{ base: "40px", xl: "28px" }}
            px={2}
            borderWidth="0.5px"
            borderColor="var(--pr-border)"
            rounded="6px"
            fontSize="13px"
            fontWeight="510"
            disabled={busy}
            loading={busy}
            _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
            onClick={() => onSubmit("COMMENT")}
          >
            <FiMessageSquare aria-hidden="true" />
            Comment
          </Button>
          <Button
            bg="var(--pr-accent)"
            color="white"
            h={{ base: "40px", xl: "28px" }}
            px={2}
            borderWidth="0.5px"
            borderColor="var(--pr-accent-hover)"
            rounded="6px"
            fontSize="13px"
            fontWeight="510"
            disabled={busy}
            loading={busy}
            _hover={{ bg: "var(--pr-accent-hover)" }}
            onClick={() => onSubmit("APPROVE")}
          >
            <FiThumbsUp aria-hidden="true" />
            Approve
          </Button>
          <Button
            bg="var(--pr-red-soft)"
            color="var(--pr-red)"
            h={{ base: "40px", xl: "28px" }}
            px={2}
            borderWidth="0.5px"
            borderColor="rgba(229, 104, 104, 0.38)"
            rounded="6px"
            fontSize="13px"
            fontWeight="510"
            disabled={busy}
            loading={busy}
            _hover={{ bg: "rgba(229, 104, 104, 0.16)" }}
            onClick={() => onSubmit("REQUEST_CHANGES")}
          >
            <FiAlertCircle aria-hidden="true" />
            Request changes
          </Button>
        </Stack>

        {message ? (
          <Text color={message === "Review submitted." ? "var(--pr-green)" : "var(--pr-red)"} fontSize="sm">
            {message}
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
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
  editingDraftId,
  onDraftBodyChange,
  onCancelDraft,
  onAddDraft,
  onUpdateDraft,
  onDeleteDraft,
  onStartEditDraft,
  onChanged,
}: {
  annotation: DiffLineAnnotation<AnnotationMeta>;
  owner: string;
  repo: string;
  pullNumber: number;
  selected: { path: string; side: PierreSide; start: number; end: number } | null;
  draftBody: string;
  editingDraftId: string | null;
  onDraftBodyChange: (body: string) => void;
  onCancelDraft: () => void;
  onAddDraft: () => void;
  onUpdateDraft: (draftId: string, body: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onStartEditDraft: (draftId: string | null) => void;
  onChanged: () => void;
}) {
  if (!annotation.metadata) {
    return null;
  }

  if (annotation.metadata.kind === "draft") {
    const draft = annotation.metadata.draft;

    return (
      <DraftAnnotation
        draft={draft}
        isEditing={editingDraftId === draft.id}
        onStartEdit={() => onStartEditDraft(draft.id)}
        onCancelEdit={() => onStartEditDraft(null)}
        onUpdateDraft={onUpdateDraft}
        onDeleteDraft={onDeleteDraft}
      />
    );
  }

  if (annotation.metadata.kind === "selection") {
    if (!selected) {
      return null;
    }

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
            <Badge bg="var(--pr-accent-soft)" color="#b8bdf8" borderWidth="0.5px" borderColor="rgba(94, 106, 210, 0.36)">
              {selected.side === "additions" ? "Right side" : "Left side"}
            </Badge>
            <Text color="var(--pr-text)" fontWeight="510" overflowWrap="anywhere">
              {selected.path}:{Math.min(selected.start, selected.end)}
              {selected.end !== selected.start ? `-${Math.max(selected.start, selected.end)}` : ""}
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

function DraftAnnotation({
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
          <Badge bg="rgba(214, 169, 74, 0.14)" color="var(--pr-yellow)" borderWidth="0.5px" borderColor="rgba(214, 169, 74, 0.3)" width="fit-content">
            Pending
          </Badge>
          <HStack gap={2}>
            <Button size="sm" variant="plain" h={{ base: "36px", md: "28px" }} px={2} rounded="6px" fontSize="13px" fontWeight="510" color="var(--pr-text-muted)" _hover={{ color: "var(--pr-text)", bg: "rgba(255, 255, 255, 0.06)" }} onClick={isEditing ? onCancelEdit : onStartEdit}>
              {isEditing ? <FiX aria-hidden="true" /> : <FiEdit2 aria-hidden="true" />}
              {isEditing ? "Cancel edit" : "Edit"}
            </Button>
            <Button size="sm" variant="plain" h={{ base: "36px", md: "28px" }} px={2} rounded="6px" fontSize="13px" fontWeight="510" color="var(--pr-red)" _hover={{ bg: "rgba(229, 104, 104, 0.12)" }} onClick={() => onDeleteDraft(draft.id)}>
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
          <Badge
            bg={thread.isResolved ? "rgba(76, 183, 130, 0.14)" : "var(--pr-accent-soft)"}
            color={thread.isResolved ? "var(--pr-green)" : "#b8bdf8"}
            borderWidth="0.5px"
            borderColor={thread.isResolved ? "rgba(76, 183, 130, 0.3)" : "rgba(94, 106, 210, 0.36)"}
            width="fit-content"
          >
            {thread.isResolved ? "Resolved" : "Unresolved conversation"}
          </Badge>
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

function CommentAffordance({ onClick }: { onClick: () => void }) {
  return (
    <Button
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      minW={{ base: "28px", md: "16px" }}
      w={{ base: "28px", md: "16px" }}
      h={{ base: "28px", md: "16px" }}
      p={0}
      rounded="4px"
      fontSize="12px"
      fontWeight="bold"
      title="Add line comment"
      aria-label="Add line comment"
      bg="var(--pr-accent)"
      color="white"
      borderWidth="0.5px"
      borderColor="var(--pr-accent-hover)"
      _hover={{ bg: "var(--pr-accent-hover)" }}
      onClick={onClick}
    >
      <FiPlus aria-hidden="true" />
    </Button>
  );
}

function SidebarResizeHandle({
  edge,
  label,
  onPointerDown,
  onKeyDown,
}: {
  edge: "left" | "right";
  label: string;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <Box
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      tabIndex={0}
      display={{ base: "none", xl: "flex" }}
      alignItems="center"
      justifyContent="center"
      position="absolute"
      top="0"
      bottom="0"
      left={edge === "left" ? "-4px" : undefined}
      right={edge === "right" ? "-4px" : undefined}
      w="8px"
      color="var(--pr-text-subtle)"
      cursor="col-resize"
      zIndex={2}
      _hover={{ color: "var(--pr-text)", bg: "var(--pr-surface-hover)" }}
      _focusVisible={{ outline: "2px solid var(--pr-accent)", outlineOffset: "-2px" }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <FiMoreVertical aria-hidden="true" />
    </Box>
  );
}

function startSidebarResize(
  side: "left" | "right",
  event: React.PointerEvent<HTMLDivElement>,
  setWidth: React.Dispatch<React.SetStateAction<number>>,
) {
  event.preventDefault();

  const sidebar = event.currentTarget.parentElement;

  if (!sidebar) {
    return;
  }

  const bounds = sidebar.getBoundingClientRect();

  function updateWidth(pointerEvent: PointerEvent) {
    const width = side === "left" ? pointerEvent.clientX - bounds.left : bounds.right - pointerEvent.clientX;

    setWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)));
  }

  function stopResize() {
    window.removeEventListener("pointermove", updateWidth);
    window.removeEventListener("pointerup", stopResize);
    window.removeEventListener("pointercancel", stopResize);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", updateWidth);
  window.addEventListener("pointerup", stopResize);
  window.addEventListener("pointercancel", stopResize);
}

function resizeSidebarWithKeyboard(
  side: "left" | "right",
  event: React.KeyboardEvent<HTMLDivElement>,
  setWidth: React.Dispatch<React.SetStateAction<number>>,
) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }

  event.preventDefault();

  const direction = event.key === "ArrowRight" ? 1 : -1;
  const multiplier = side === "left" ? direction : -direction;

  setWidth((width) =>
    Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width + multiplier * SIDEBAR_KEYBOARD_STEP)),
  );
}

function togglePath(
  path: string,
  paths: string[],
  setPaths: React.Dispatch<React.SetStateAction<string[]>>,
) {
  setPaths(paths.includes(path) ? paths.filter((current) => current !== path) : [...paths, path]);
}

function filterLabel(filter: FileFilter) {
  if (filter === "unreviewed") {
    return "Unreviewed";
  }

  if (filter === "commented") {
    return "Commented";
  }

  return "All";
}

function filterIcon(filter: FileFilter) {
  if (filter === "unreviewed") {
    return <FiCircle aria-hidden="true" />;
  }

  if (filter === "commented") {
    return <FiMessageSquare aria-hidden="true" />;
  }

  return <FiList aria-hidden="true" />;
}

function statusBadgeStyle(status: string) {
  if (status === "added") {
    return {
      bg: "var(--pr-green-soft)",
      color: "var(--pr-green)",
      borderColor: "rgba(76, 183, 130, 0.32)",
    };
  }

  if (status === "removed") {
    return {
      bg: "var(--pr-red-soft)",
      color: "var(--pr-red)",
      borderColor: "rgba(229, 104, 104, 0.32)",
    };
  }

  if (status === "renamed") {
    return {
      bg: "var(--pr-accent-soft)",
      color: "#b8bdf8",
      borderColor: "rgba(94, 106, 210, 0.32)",
    };
  }

  return {
    bg: "var(--pr-surface-subtle)",
    color: "var(--pr-text-muted)",
    borderColor: "var(--pr-border)",
  };
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function fileId(path: string) {
  return `file-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

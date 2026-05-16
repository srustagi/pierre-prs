"use client";

import {
  Badge,
  Box,
  HStack,
  Link as ChakraLink,
  Text,
  TreeView,
  type FilePathTreeNode,
  type createFileTreeCollection,
} from "@chakra-ui/react";
import { FiChevronDown, FiChevronRight, FiFile, FiFolder } from "react-icons/fi";

export type FileSummary = {
  threads: number;
  unresolved: number;
  drafts: number;
};

export type ReviewFileTreeRowView = {
  path: string;
  label: string;
  displayPath: string;
  status: string;
  additions: number;
  deletions: number;
  reviewed: boolean;
  active: boolean;
  summary?: FileSummary;
};

export function ReviewFileTree({
  collection,
  rowsByPath,
  onFileActivate,
  onReviewedChange,
}: {
  collection: ReturnType<typeof createFileTreeCollection>;
  rowsByPath: Map<string, ReviewFileTreeRowView>;
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
              row={rowsByPath.get(node.value)}
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
  row,
  onFileActivate,
  onReviewedChange,
}: {
  node: FilePathTreeNode<{ label: string; value: string }>;
  isBranch: boolean;
  isExpanded: boolean;
  row?: ReviewFileTreeRowView;
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

  if (!row) {
    return null;
  }

  return (
    <TreeView.Item
      display="grid"
      gridTemplateColumns="auto 1fr"
      gap={2}
      py={1.5}
      pr={1.5}
      rounded="6px"
      bg={row.active ? "var(--pr-accent-soft)" : "transparent"}
      borderWidth="0.5px"
      borderColor={row.active ? "rgba(94, 106, 210, 0.42)" : "transparent"}
    >
      <input
        type="checkbox"
        checked={row.reviewed}
        aria-label={`Mark ${row.displayPath} reviewed`}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onReviewedChange(row.path, event.currentTarget.checked)}
      />
      <ChakraLink href={`#${fileId(row.path)}`} display="grid" gap={1} minW={0} onClick={() => onFileActivate(row.path)}>
        <HStack gap={1.5} minW={0} align="flex-start">
          <Box as={FiFile} aria-hidden="true" color="var(--pr-text-subtle)" flexShrink={0} mt="2px" />
          <TreeView.ItemText asChild>
            <Text overflowWrap="anywhere" fontSize="13px" fontWeight="510">
              {row.label}
            </Text>
          </TreeView.ItemText>
        </HStack>
        <HStack gap={2} wrap="wrap">
          <Badge size="sm" borderWidth="0.5px" {...statusBadgeStyle(row.status)}>
            {row.status}
          </Badge>
          <Text color="var(--pr-text-subtle)" fontSize="xs">
            +{row.additions} -{row.deletions}
          </Text>
          {row.summary?.unresolved ? (
            <Badge
              size="sm"
              bg="var(--pr-accent-soft)"
              color="#b8bdf8"
              borderWidth="0.5px"
              borderColor="rgba(94, 106, 210, 0.36)"
            >
              {row.summary.unresolved} open
            </Badge>
          ) : null}
          {row.summary?.drafts ? (
            <Badge
              size="sm"
              bg="var(--pr-yellow-soft)"
              color="var(--pr-yellow)"
              borderWidth="0.5px"
              borderColor="rgba(214, 169, 74, 0.32)"
            >
              {row.summary.drafts} pending
            </Badge>
          ) : null}
        </HStack>
      </ChakraLink>
    </TreeView.Item>
  );
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

function fileId(path: string) {
  return `file-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

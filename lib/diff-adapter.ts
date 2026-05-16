import type { PullFile, ReviewThread } from "@/lib/github-types";

export type DiffSide = "LEFT" | "RIGHT";
export type PierreSide = "deletions" | "additions";

export type ReviewCoordinate = {
  path: string;
  commitId: string;
  line: number;
  side: DiffSide;
  startLine?: number;
  startSide?: DiffSide;
  diffIndex: number;
};

export type RenderedDiffFile = PullFile & {
  displayPath: string;
  patchForPierre: string | null;
  coordinates: Record<string, ReviewCoordinate>;
};

export function toPierreSide(side: DiffSide | string | null | undefined): PierreSide {
  return side === "LEFT" ? "deletions" : "additions";
}

export function toGitHubSide(side: PierreSide): DiffSide {
  return side === "deletions" ? "LEFT" : "RIGHT";
}

export function coordinateKey(side: PierreSide, line: number) {
  return `${side}:${line}`;
}

export function canSelectCoordinate(file: RenderedDiffFile, side: PierreSide, line: number) {
  return Boolean(file.coordinates[coordinateKey(side, line)]);
}

export function coordinateForThread(file: RenderedDiffFile, thread: ReviewThread) {
  if (thread.path !== file.filename || !thread.line || !thread.side) {
    return null;
  }

  const side = toPierreSide(thread.side);
  const directCoordinate = file.coordinates[coordinateKey(side, thread.line)];

  if (directCoordinate) {
    return { side, line: thread.line };
  }

  if (thread.side === "RIGHT") {
    const contextCoordinate = Object.entries(file.coordinates).find(
      ([key, coordinate]) =>
        key.startsWith("deletions:") && coordinate.side === "RIGHT" && coordinate.line === thread.line,
    );

    if (contextCoordinate) {
      return { side: "deletions" as const, line: Number(contextCoordinate[0].split(":")[1]) };
    }
  }

  return null;
}

export function adaptPullFile(file: PullFile, commitId: string): RenderedDiffFile {
  const displayPath = file.filename;
  const patchForPierre = buildPatch(file);

  return {
    ...file,
    displayPath,
    patchForPierre,
    coordinates: file.patch ? buildCoordinates(file, commitId) : {},
  };
}

export function coordinateForSelection(
  file: RenderedDiffFile,
  start: number,
  side: PierreSide,
  end?: number,
  endSide?: PierreSide,
) {
  const normalizedEnd = end ?? start;
  const normalizedEndSide = endSide ?? side;
  const startAnchor = file.coordinates[coordinateKey(side, start)];
  const endAnchor = file.coordinates[coordinateKey(normalizedEndSide, normalizedEnd)];

  if (!startAnchor || !endAnchor) {
    return null;
  }

  const [rangeStart, rangeEnd] =
    startAnchor.diffIndex <= endAnchor.diffIndex ? [startAnchor, endAnchor] : [endAnchor, startAnchor];

  if (rangeStart.line !== rangeEnd.line || rangeStart.side !== rangeEnd.side) {
    return {
      ...rangeEnd,
      startLine: rangeStart.line,
      startSide: rangeStart.side,
    };
  }

  return rangeEnd;
}

function buildPatch(file: PullFile) {
  if (!file.patch) {
    return null;
  }

  const oldPath = file.previousFilename ?? file.filename;
  const newPath = file.filename;
  const oldHeader = file.status === "added" ? "/dev/null" : `a/${oldPath}`;
  const newHeader = file.status === "removed" ? "/dev/null" : `b/${newPath}`;
  const metadata = [`diff --git a/${oldPath} b/${newPath}`];

  if (file.status === "renamed" && file.previousFilename) {
    metadata.push(`rename from ${file.previousFilename}`);
    metadata.push(`rename to ${file.filename}`);
  }

  metadata.push(`--- ${oldHeader}`);
  metadata.push(`+++ ${newHeader}`);

  return `${metadata.join("\n")}\n${file.patch}`;
}

function buildCoordinates(file: PullFile, commitId: string) {
  const coordinates: Record<string, ReviewCoordinate> = {};
  let oldLine = 0;
  let newLine = 0;
  let diffIndex = 0;

  for (const rawLine of file.patch?.split("\n") ?? []) {
    if (rawLine === "") {
      continue;
    }

    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(rawLine);

    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      continue;
    }

    if (rawLine.startsWith("\\ No newline")) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      coordinates[coordinateKey("additions", newLine)] = {
        path: file.filename,
        commitId,
        line: newLine,
        side: "RIGHT",
        diffIndex,
      };
      newLine += 1;
      diffIndex += 1;
      continue;
    }

    if (rawLine.startsWith("-")) {
      coordinates[coordinateKey("deletions", oldLine)] = {
        path: file.filename,
        commitId,
        line: oldLine,
        side: "LEFT",
        diffIndex,
      };
      oldLine += 1;
      diffIndex += 1;
      continue;
    }

    coordinates[coordinateKey("deletions", oldLine)] = {
      path: file.filename,
      commitId,
      line: newLine,
      side: "RIGHT",
      diffIndex,
    };
    coordinates[coordinateKey("additions", newLine)] = {
      path: file.filename,
      commitId,
      line: newLine,
      side: "RIGHT",
      diffIndex,
    };
    oldLine += 1;
    newLine += 1;
    diffIndex += 1;
  }

  return coordinates;
}

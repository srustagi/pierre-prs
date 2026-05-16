import type { PullFile } from "@/lib/github";

export type DiffSide = "LEFT" | "RIGHT";
export type PierreSide = "deletions" | "additions";

export type ReviewCoordinate = {
  path: string;
  commit_id: string;
  line: number;
  side: DiffSide;
  start_line?: number;
  start_side?: DiffSide;
  diff_index: number;
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
    startAnchor.diff_index <= endAnchor.diff_index ? [startAnchor, endAnchor] : [endAnchor, startAnchor];

  if (rangeStart.line !== rangeEnd.line || rangeStart.side !== rangeEnd.side) {
    return {
      ...rangeEnd,
      start_line: rangeStart.line,
      start_side: rangeStart.side,
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
        commit_id: commitId,
        line: newLine,
        side: "RIGHT",
        diff_index: diffIndex,
      };
      newLine += 1;
      diffIndex += 1;
      continue;
    }

    if (rawLine.startsWith("-")) {
      coordinates[coordinateKey("deletions", oldLine)] = {
        path: file.filename,
        commit_id: commitId,
        line: oldLine,
        side: "LEFT",
        diff_index: diffIndex,
      };
      oldLine += 1;
      diffIndex += 1;
      continue;
    }

    coordinates[coordinateKey("deletions", oldLine)] = {
      path: file.filename,
      commit_id: commitId,
      line: newLine,
      side: "RIGHT",
      diff_index: diffIndex,
    };
    coordinates[coordinateKey("additions", newLine)] = {
      path: file.filename,
      commit_id: commitId,
      line: newLine,
      side: "RIGHT",
      diff_index: diffIndex,
    };
    oldLine += 1;
    newLine += 1;
    diffIndex += 1;
  }

  return coordinates;
}

import type { DiffLineAnnotation } from "@pierre/diffs/react";
import type { PierreSide, ReviewCoordinate } from "@/lib/diff-adapter";
import type { ReviewThread } from "@/lib/github-types";

export type DraftComment = {
  id: string;
  path: string;
  side: PierreSide;
  line: number;
  startSide: PierreSide;
  start: number;
  end: number;
  endSide?: PierreSide;
  body: string;
  coordinate: ReviewCoordinate;
};

export type SelectedReviewRange = {
  path: string;
  side: PierreSide;
  start: number;
  end: number;
  endSide?: PierreSide;
};

export type AnnotationMeta =
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

export type ReviewAnnotation = DiffLineAnnotation<AnnotationMeta>;

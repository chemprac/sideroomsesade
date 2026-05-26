/** First paint batch — covers preview rows + paywall banner for unpaid users. */
export const MATCH_TABLE_INITIAL_VISIBLE = 28;

/** Rows appended each time the scroll sentinel enters view. */
export const MATCH_TABLE_LOAD_MORE = 20;

/**
 * Prefetch margin — loads the next batch before the user reaches the bottom.
 * Equivalent to ~3–4 row heights of runway while scrolling.
 */
export const MATCH_TABLE_ROOT_MARGIN = "520px 0px";

export const MATCH_TABLE_INTERSECTION_THRESHOLD = 0;

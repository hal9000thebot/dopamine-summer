export const APP_VERSION = "1.12";

export type ChangelogEntry = {
  version: string;
  date: string;
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.12",
    date: "May 5, 2026",
    changes: [
      "Blocked search indexing with noindex metadata and robots.txt."
    ]
  },
  {
    version: "1.11",
    date: "May 5, 2026",
    changes: [
      "Added Open Graph preview image for shared app links."
    ]
  },
  {
    version: "1.10",
    date: "May 5, 2026",
    changes: [
      "Moved changelog to the main nav and refreshed the Guide for the current workflow."
    ]
  },
  {
    version: "1.9",
    date: "May 5, 2026",
    changes: [
      "Improved Admin Create topic layout and stopped planning panels from stretching."
    ]
  },
  {
    version: "1.8",
    date: "May 4, 2026",
    changes: [
      "Unified freeform and topic generation into one Create post workflow."
    ]
  },
  {
    version: "1.7",
    date: "May 4, 2026",
    changes: [
      "Improved source-grounded recap generation and renamed Generic team member to Balanced team voice."
    ]
  },
  {
    version: "1.6",
    date: "May 4, 2026",
    changes: [
      "Added per-post persona override for campaign and freeform generation."
    ]
  },
  {
    version: "1.5",
    date: "May 4, 2026",
    changes: [
      "Formatted X posts with each sentence on a new line."
    ]
  },
  {
    version: "1.4",
    date: "May 4, 2026",
    changes: [
      "Updated the freeform link field label."
    ]
  },
  {
    version: "1.3",
    date: "May 4, 2026",
    changes: [
      "Added link reading for freeform post generation."
    ]
  },
  {
    version: "1.2",
    date: "May 1, 2026",
    changes: [
      "Added freeform post generation outside campaigns with stronger user-brief guidance."
    ]
  },
  {
    version: "1.1",
    date: "April 30, 2026",
    changes: [
      "Added automated version and changelog source of truth.",
      "Added npm run release for decimal version bumps and changelog entry generation.",
      "The app header and Admin Change log now read from release data instead of hardcoded text."
    ]
  },
  {
    version: "1.0",
    date: "April 30, 2026",
    changes: [
      "Added the visible v1.0 badge in the main app header.",
      "Generated post cards now show the additional prompt context used for that generation.",
      "Removed user rating fields from the save flow; saving a post now marks it as good enough.",
      "Additional prompt exact-match enforcement now only applies to quoted phrases.",
      "Reference posts can be saved, reviewed as cards, and deleted from Admin.",
      "Added the in-app Guide with GitBook-style navigation."
    ]
  }
];

import type { PromptQualityControls } from "@/lib/types";

export const DEFAULT_PROMPT_QUALITY_CONTROLS: PromptQualityControls = {
  bannedPhrases: [
    "revolutionizing finance",
    "game changer",
    "mass adoption is here",
    "next billion users"
  ],
  preferredPhrases: [
    "practical self-custody",
    "clearer wallet flows",
    "wallet UX",
    "security-conscious"
  ],
  neverClaim: [
    "Ambire removes all user responsibility.",
    "Ambire guarantees users cannot make mistakes.",
    "Ambire is risk-free.",
    "Ambire has audits, partnerships, metrics, or roadmap commitments not present in context."
  ],
  channelStyleRules: {
    x: [
      "Keep it tight and direct.",
      "Use one clear idea per post.",
      "Avoid corporate announcement language."
    ],
    linkedin: [
      "Use a more complete thought while staying concise.",
      "Make the professional takeaway explicit.",
      "Avoid empty thought-leadership phrasing."
    ]
  }
};

function stringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean)
    : fallback;
}

export function normalizePromptQualityControls(value: unknown): PromptQualityControls {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_PROMPT_QUALITY_CONTROLS;
  }

  const record = value as Record<string, unknown>;
  const channelStyleRules =
    record.channelStyleRules && typeof record.channelStyleRules === "object" && !Array.isArray(record.channelStyleRules)
      ? (record.channelStyleRules as Record<string, unknown>)
      : {};

  return {
    bannedPhrases: stringArray(record.bannedPhrases, DEFAULT_PROMPT_QUALITY_CONTROLS.bannedPhrases),
    preferredPhrases: stringArray(record.preferredPhrases, DEFAULT_PROMPT_QUALITY_CONTROLS.preferredPhrases),
    neverClaim: stringArray(record.neverClaim, DEFAULT_PROMPT_QUALITY_CONTROLS.neverClaim),
    channelStyleRules: {
      x: stringArray(channelStyleRules.x, DEFAULT_PROMPT_QUALITY_CONTROLS.channelStyleRules.x),
      linkedin: stringArray(
        channelStyleRules.linkedin,
        DEFAULT_PROMPT_QUALITY_CONTROLS.channelStyleRules.linkedin
      )
    }
  };
}

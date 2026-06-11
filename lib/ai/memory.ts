import type {
  AiWarning,
  Channel,
  GeneratedVariant,
  PostEvaluation,
  StoredGeneratedPost
} from "@/lib/types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
  "without"
]);

export type MemoryPost = {
  id: string;
  content: string;
  editedContent?: string;
  angle: string;
  topicId: string;
  personaId: string;
  channel: Channel;
  createdAt: string;
};

export type GenerationMemory = {
  usedAngles: string[];
  recentSavedPosts: MemoryPost[];
};

export type DuplicateRisk = "low" | "medium" | "high";

export type VariantMemoryCheck = {
  risk: DuplicateRisk;
  similarityScore: number;
  similarToPostId?: string;
  similarToContent?: string;
  repeatedAngle: boolean;
  reasons: string[];
  aiWarning?: AiWarning;
  postEvaluation?: PostEvaluation;
};

export type VariantWithMemory = GeneratedVariant & {
  memoryCheck: VariantMemoryCheck;
};

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function jaccardSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
}

export function buildMemoryFromPosts({
  posts,
  topicId,
  personaId,
  channel,
  limit = 12
}: {
  posts: StoredGeneratedPost[];
  topicId: string;
  personaId: string;
  channel: Channel;
  limit?: number;
}): GenerationMemory {
  const relevantPosts = posts
    .filter((post) => post.topicId === topicId && post.personaId === personaId && post.channel === channel)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  const usedAngles = Array.from(new Set(relevantPosts.map((post) => post.angle).filter(Boolean)));
  const recentSavedPosts = relevantPosts
    .filter((post) => post.selectedPost || post.status === "copied")
    .slice(0, limit)
    .map((post) => ({
      id: post.id,
      content: post.content,
      editedContent: post.selectedPost?.editedContent,
      angle: post.angle,
      topicId: post.topicId,
      personaId: post.personaId,
      channel: post.channel,
      createdAt: post.selectedPost?.copiedAt ?? post.createdAt
    }));

  return { usedAngles, recentSavedPosts };
}

export function checkVariantAgainstMemory(
  variant: GeneratedVariant,
  memory: GenerationMemory
): VariantMemoryCheck {
  const normalizedAngle = variant.angle.trim().toLowerCase();
  const repeatedAngle = memory.usedAngles.some((angle) => angle.trim().toLowerCase() === normalizedAngle);

  let bestScore = 0;
  let bestPost: MemoryPost | undefined;

  for (const post of memory.recentSavedPosts) {
    const contentToCompare = post.editedContent ?? post.content;
    const score = jaccardSimilarity(variant.content, contentToCompare);

    if (score > bestScore) {
      bestScore = score;
      bestPost = post;
    }
  }

  const reasons: string[] = [];

  if (repeatedAngle) {
    reasons.push("Repeats an angle already used for this topic, persona, and channel.");
  }

  if (bestScore >= 0.42) {
    reasons.push("Strong text overlap with a saved post.");
  } else if (bestScore >= 0.28) {
    reasons.push("Moderate text overlap with a saved post.");
  }

  let risk: DuplicateRisk = "low";
  if (bestScore >= 0.42 || (repeatedAngle && bestScore >= 0.28)) {
    risk = "high";
  } else if (repeatedAngle || bestScore >= 0.28) {
    risk = "medium";
  }

  return {
    risk,
    similarityScore: Number(bestScore.toFixed(3)),
    similarToPostId: bestPost?.id,
    similarToContent: bestPost ? bestPost.editedContent ?? bestPost.content : undefined,
    repeatedAngle,
    reasons
  };
}

export function annotateVariantsWithMemory(
  variants: GeneratedVariant[],
  memory: GenerationMemory
): VariantWithMemory[] {
  return variants.map((variant) => ({
    ...variant,
    memoryCheck: checkVariantAgainstMemory(variant, memory)
  }));
}

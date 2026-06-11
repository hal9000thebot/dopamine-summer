import { normalizePromptQualityControls } from "@/lib/ai/promptRules";
import type { GeneratePostInput } from "@/lib/types";

export function buildPromptContext(input: GeneratePostInput) {
  const promptQualityControls = normalizePromptQualityControls(input.promptQualityControls);
  const sourceLinkTask = detectSourceLinkTask(input.additionalContext);

  return {
    company: {
      name: "Ambire",
      category: "Web3 wallet",
      positioning: ["UX-first", "security-conscious", "practical self-custody"]
    },
    brandContext: input.brandContext.map((section) => ({
      title: section.title,
      category: section.category,
      content: section.content
    })),
    topic: {
      title: input.topic.title,
      summary: input.topic.summary,
      audience: input.topic.audience,
      talkingPoints: input.topic.talkingPoints
    },
    persona: {
      name: input.persona.name,
      description: input.persona.description,
      toneRules: input.persona.toneRules,
      framingRules: input.persona.framingRules
    },
    channel: input.channel,
    promptQualityControls: {
      bannedPhrases: promptQualityControls.bannedPhrases,
      preferredPhrases: promptQualityControls.preferredPhrases,
      neverClaim: promptQualityControls.neverClaim,
      channelStyleRules: promptQualityControls.channelStyleRules[input.channel]
    },
    referencePosts: {
      examplesToLearnFrom:
        input.referencePosts
          ?.filter((post) => post.label !== "avoid_example")
          .map((post) => ({
            source: post.source,
            label: post.label,
            author: post.author ?? "",
            content: post.content,
            notes: post.notes ?? ""
          })) ?? [],
      patternsToAvoid:
        input.referencePosts
          ?.filter((post) => post.label === "avoid_example")
          .map((post) => ({
            source: post.source,
            author: post.author ?? "",
            content: post.content,
            notes: post.notes ?? ""
          })) ?? []
    },
    sourceLinkTask,
    sourceLinks: {
      fetched:
        input.linkContext
          ?.filter((link) => link.status === "fetched")
          .map((link) => ({
            url: link.url,
            title: link.title ?? "",
            headings: link.headings ?? [],
            excerpt: link.excerpt ?? ""
          })) ?? [],
      failed:
        input.linkContext
          ?.filter((link) => link.status === "failed")
          .map((link) => ({
            url: link.url,
            error: link.error ?? "Could not fetch link."
          })) ?? []
    },
    additionalUserContext: input.additionalContext ?? "",
    memory: {
      usedAnglesToAvoid: input.memory?.usedAngles ?? [],
      recentSavedPostsToAvoidCopying:
        input.memory?.recentSavedPosts.map((post) => ({
          angle: post.angle,
          content: post.editedContent ?? post.content
        })) ?? []
    }
  };
}

function detectSourceLinkTask(additionalContext?: string) {
  const normalized = additionalContext?.toLowerCase() ?? "";

  if (/\b(recap|summari[sz]e|summary|tl;?dr|break down|what happened|key points)\b/.test(normalized)) {
    return "recap";
  }

  if (/\b(use|read|based on|from this article|from the article|from this link)\b/.test(normalized)) {
    return "source-guided";
  }

  return "background";
}

"use client";

import { useMemo, useState } from "react";
import { buildMemoryFromPosts } from "@/lib/ai/memory";
import { buildPromptContext } from "@/lib/ai/promptContext";
import type {
  BrandContextSection,
  Channel,
  Persona,
  PromptQualityControls,
  ReferencePost,
  StoredGeneratedPost,
  Topic,
  User
} from "@/lib/types";

type PromptContext = ReturnType<typeof buildPromptContext>;

function renderMarkdownPreview(preview: PromptContext) {
  return [
    "# Prompt Context",
    "",
    "## Company",
    `- **Name:** ${preview.company.name}`,
    `- **Category:** ${preview.company.category}`,
    `- **Positioning:** ${preview.company.positioning.join(", ")}`,
    "",
    "## Brand Context",
    ...preview.brandContext.flatMap((section) => [
      `### ${section.title}`,
      `- **Category:** ${section.category}`,
      `- ${section.content}`,
      ""
    ]),
    "## Topic",
    `- **Title:** ${preview.topic.title}`,
    `- **Summary:** ${preview.topic.summary}`,
    `- **Audience:** ${preview.topic.audience.join(", ") || "Not specified"}`,
    "",
    "### Talking Points",
    ...preview.topic.talkingPoints.map(
      (point) => `- **${point.type}**${point.importance !== undefined ? ` (${point.importance})` : ""}: ${point.content}`
    ),
    "",
    "## Persona",
    `- **Name:** ${preview.persona.name}`,
    `- **Description:** ${preview.persona.description}`,
    `- **Tone Rules:** ${preview.persona.toneRules.join(", ") || "Not specified"}`,
    `- **Framing Rules:** ${preview.persona.framingRules.join(", ") || "Not specified"}`,
    "",
    "## Generation",
    `- **Channel:** ${preview.channel}`,
    `- **Additional User Context:** ${preview.additionalUserContext || "None"}`,
    "",
    "## Prompt Quality Controls",
    "### Banned Phrases",
    ...(preview.promptQualityControls.bannedPhrases.length
      ? preview.promptQualityControls.bannedPhrases.map((phrase) => `- ${phrase}`)
      : ["- None"]),
    "",
    "### Preferred Phrases",
    ...(preview.promptQualityControls.preferredPhrases.length
      ? preview.promptQualityControls.preferredPhrases.map((phrase) => `- ${phrase}`)
      : ["- None"]),
    "",
    "### Never Claim",
    ...(preview.promptQualityControls.neverClaim.length
      ? preview.promptQualityControls.neverClaim.map((claim) => `- ${claim}`)
      : ["- None"]),
    "",
    "### Active Channel Style Rules",
    ...(preview.promptQualityControls.channelStyleRules.length
      ? preview.promptQualityControls.channelStyleRules.map((rule) => `- ${rule}`)
      : ["- None"]),
    "",
    "## Reference Posts",
    "### Examples To Learn From",
    ...(preview.referencePosts.examplesToLearnFrom.length
      ? preview.referencePosts.examplesToLearnFrom.flatMap((post) => [
          `- **${post.label} / ${post.source}${post.author ? ` / ${post.author}` : ""}:** ${post.content}`,
          post.notes ? `  - Notes: ${post.notes}` : ""
        ]).filter(Boolean)
      : ["- None"]),
    "",
    "### Patterns To Avoid",
    ...(preview.referencePosts.patternsToAvoid.length
      ? preview.referencePosts.patternsToAvoid.flatMap((post) => [
          `- **${post.source}${post.author ? ` / ${post.author}` : ""}:** ${post.content}`,
          post.notes ? `  - Notes: ${post.notes}` : ""
        ]).filter(Boolean)
      : ["- None"]),
    "",
    "## Memory",
    "### Used Angles To Avoid",
    ...(preview.memory.usedAnglesToAvoid.length
      ? preview.memory.usedAnglesToAvoid.map((angle) => `- ${angle}`)
      : ["- None"]),
    "",
    "### Recent Saved Posts To Avoid Copying",
    ...(preview.memory.recentSavedPostsToAvoidCopying.length
      ? preview.memory.recentSavedPostsToAvoidCopying.flatMap((post) => [
          `- **${post.angle}:** ${post.content}`
        ])
      : ["- None"])
  ].join("\n");
}

export function PromptPreview({
  brandContext,
  generatedPosts,
  personas,
  promptQualityControls,
  referencePosts,
  topics,
  user
}: {
  brandContext: BrandContextSection[];
  generatedPosts: StoredGeneratedPost[];
  personas: Persona[];
  promptQualityControls: PromptQualityControls;
  referencePosts: ReferencePost[];
  topics: Topic[];
  user: User;
}) {
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? "");
  const [channel, setChannel] = useState<Channel>("x");
  const [additionalContext, setAdditionalContext] = useState("");

  const preview = useMemo<PromptContext | null>(() => {
    const topic = topics.find((item) => item.id === topicId) ?? topics[0];
    const persona = personas.find((item) => item.id === personaId) ?? personas[0];

    if (!topic || !persona) {
      return null;
    }

    const memory = buildMemoryFromPosts({
      posts: generatedPosts,
      topicId: topic.id,
      personaId: persona.id,
      channel
    });

    return buildPromptContext({
      user: { ...user, personaId: persona.id },
      persona,
      topic,
      brandContext,
      promptQualityControls,
      referencePosts: referencePosts
        .filter((post) => post.channel === channel)
        .filter((post) => !post.topicId || post.topicId === topic.id)
        .filter((post) => !post.personaId || post.personaId === persona.id)
        .slice(0, 8),
      channel,
      additionalContext,
      memory
    });
  }, [
    additionalContext,
    brandContext,
    channel,
    generatedPosts,
    personaId,
    personas,
    promptQualityControls,
    referencePosts,
    topicId,
    topics,
    user
  ]);

  return (
    <section className="panel">
      <h2>Prompt preview</h2>
      <p className="muted">
        This is the structured context injected into the OpenAI prompt for the selected topic, persona, and channel.
      </p>
      <div className="grid two">
        <div className="form-row">
          <label htmlFor="preview-topic">Topic</label>
          <select id="preview-topic" value={topicId} onChange={(event) => setTopicId(event.target.value)}>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
          <label htmlFor="preview-persona">Persona</label>
          <select
            id="preview-persona"
            value={personaId}
            onChange={(event) => setPersonaId(event.target.value)}
          >
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </select>
          <label htmlFor="preview-channel">Channel</label>
          <select
            id="preview-channel"
            value={channel}
            onChange={(event) => setChannel(event.target.value as Channel)}
          >
            <option value="x">X</option>
            <option value="linkedin">LinkedIn</option>
          </select>
          <label htmlFor="preview-additional-context">Additional user context</label>
          <textarea
            id="preview-additional-context"
            value={additionalContext}
            onChange={(event) => setAdditionalContext(event.target.value)}
            placeholder="Optional per-generation context"
          />
        </div>
        <pre className="markdown-preview">{preview ? renderMarkdownPreview(preview) : "No preview available."}</pre>
      </div>
    </section>
  );
}

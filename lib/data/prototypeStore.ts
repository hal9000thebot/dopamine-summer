import { createContentGenerator } from "@/lib/ai/contentGenerator";
import { formatPostForChannel } from "@/lib/ai/postFormatting";
import { DEFAULT_PROMPT_QUALITY_CONTROLS } from "@/lib/ai/promptRules";
import { AI_MODEL_OPTIONS, DEFAULT_AI_SETTINGS } from "@/lib/ai/settings";
import {
  brandContext,
  campaigns,
  generatedPosts,
  personas,
  referencePosts,
  recommendations,
  topics,
  users
} from "@/lib/data/seedData";
import type { Channel, SelectedPost, StoredGeneratedPost } from "@/lib/types";

const selectedPosts: SelectedPost[] = [];

export function getPrototypeData(userId = "builder") {
  const user = users.find((item) => item.id === userId) ?? users[0];
  const persona = personas.find((item) => item.id === user.personaId) ?? personas[0];
  const recommendedTopicIds = new Set(
    recommendations.filter((item) => item.userId === user.id).map((item) => item.topicId)
  );

  return {
    users,
    user,
    persona,
    personas,
    brandContext,
    campaigns,
    topics,
    recommendations,
    referencePosts,
    recommendedTopicIds,
    generatedPosts,
    selectedPosts,
    aiSettings: DEFAULT_AI_SETTINGS,
    promptQualityControls: DEFAULT_PROMPT_QUALITY_CONTROLS,
    aiModelOptions: AI_MODEL_OPTIONS
  };
}

export async function generatePrototypePosts({
  userId,
  topicId,
  channel,
  additionalContext,
  personaOverrideId
}: {
  userId: string;
  topicId: string;
  channel: Channel;
  additionalContext?: string;
  personaOverrideId?: string;
}) {
  const user = users.find((item) => item.id === userId) ?? users[0];
  const persona = personas.find((item) => item.id === personaOverrideId) ??
    personas.find((item) => item.id === user.personaId) ??
    personas[0];
  const topic = topics.find((item) => item.id === topicId) ?? topics[0];
  removeUnsavedPrototypePosts(user.id);
  const generator = createContentGenerator();
  const result = await generator.generatePostVariants({
    user,
    persona,
    topic,
    brandContext,
    promptQualityControls: DEFAULT_PROMPT_QUALITY_CONTROLS,
    referencePosts,
    channel,
    additionalContext
  });

  const stored = result.variants.map<StoredGeneratedPost>((variant) => ({
    ...variant,
    content: formatPostForChannel(variant.content, channel),
    userId: user.id,
    topicId: topic.id,
    personaId: persona.id,
    channel,
    status: "generated",
    createdAt: new Date().toISOString(),
    additionalContext
  }));

  generatedPosts.unshift(...stored);

  return stored;
}

export function storeSelectedPost({
  generatedPostId,
  editedContent
}: {
  generatedPostId: string;
  editedContent: string;
}) {
  const post = generatedPosts.find((item) => item.id === generatedPostId);
  if (!post) {
    throw new Error("Generated post not found");
  }

  post.status = "copied";
  const selected: SelectedPost = {
    id: crypto.randomUUID(),
    generatedPostId,
    userId: post.userId,
    topicId: post.topicId,
    originalContent: post.content,
    editedContent,
    channel: post.channel,
    copiedAt: new Date().toISOString(),
    wasEdited: post.content.trim() !== editedContent.trim()
  };
  selectedPosts.unshift(selected);
  removeUnsavedPrototypePosts(post.userId, post.id);
  return selected;
}

function removeUnsavedPrototypePosts(userId: string, exceptPostId?: string) {
  for (let index = generatedPosts.length - 1; index >= 0; index -= 1) {
    const post = generatedPosts[index];
    if (post.userId === userId && post.status === "generated" && post.id !== exceptPostId) {
      generatedPosts.splice(index, 1);
    }
  }
}

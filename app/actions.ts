"use server";

import { revalidatePath } from "next/cache";
import {
  createBrandContextSection,
  createCampaign,
  createPersona,
  createReferencePost,
  createTalkingPoint,
  createTopic,
  deleteCampaign,
  deleteGeneratedPost,
  deletePersona,
  deleteRecommendation,
  deleteReferencePost,
  deleteTalkingPoint,
  deleteTopic,
  deleteUser,
  dismissGeneratedPost,
  generateFreeformPosts,
  generatePosts,
  recommendTopic,
  saveEditedPost,
  updateAiSettings,
  updateBrandContextSection,
  updateCampaign,
  updatePersonaDefinition,
  updatePromptQualityControls,
  updateTalkingPoint,
  updateTeamUser,
  updateTopic,
  updateUserPersona
} from "@/lib/data/appData";
import { normalizeAiSettings } from "@/lib/ai/settings";
import { parseSourceLinks } from "@/lib/ai/linkContext";
import { requireAdmin, requireOwner, requireUser } from "@/lib/auth/guards";
import type { Channel, Role } from "@/lib/types";
import type { ReferencePost } from "@/lib/types";

export async function generatePostsAction(formData: FormData) {
  const user = await requireUser();
  const topicId = String(formData.get("topicId") ?? "signing-anxiety");
  const channel = String(formData.get("channel") ?? "x") as Channel;
  const personaId = String(formData.get("personaId") ?? "").trim();
  const additionalContext = String(formData.get("additionalContext") ?? "").trim();

  await generatePosts({ userId: user.id, topicId, channel, additionalContext, personaOverrideId: personaId });
  revalidatePath("/dashboard");
}

export async function generateFreeformPostsAction(formData: FormData) {
  const user = await requireUser();
  const channel = String(formData.get("channel") ?? "x") as Channel;
  const personaId = String(formData.get("personaId") ?? "").trim();
  const brief = String(formData.get("freeformBrief") ?? "").trim();
  const sourceLinks = parseSourceLinks(String(formData.get("sourceLinks") ?? ""));

  if (brief) {
    await generateFreeformPosts({ userId: user.id, channel, brief, personaOverrideId: personaId, sourceLinks });
  }

  revalidatePath("/dashboard");
}

export async function saveEditedPostAction(formData: FormData) {
  await requireUser();
  const generatedPostId = String(formData.get("generatedPostId"));
  const editedContent = String(formData.get("editedContent") ?? "");

  if (generatedPostId && editedContent.trim()) {
    await saveEditedPost({
      generatedPostId,
      editedContent
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function dismissGeneratedPostAction(formData: FormData) {
  await requireUser();
  const generatedPostId = String(formData.get("generatedPostId") ?? "");

  if (generatedPostId) {
    await dismissGeneratedPost(generatedPostId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function deleteGeneratedPostAction(formData: FormData) {
  await requireAdmin();
  const generatedPostId = String(formData.get("generatedPostId") ?? "");

  if (generatedPostId) {
    await deleteGeneratedPost(generatedPostId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function deleteCampaignAction(formData: FormData) {
  await requireAdmin();
  const campaignId = String(formData.get("campaignId") ?? "");

  if (campaignId) {
    await deleteCampaign(campaignId);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function deleteRecommendationAction(formData: FormData) {
  await requireAdmin();
  const recommendationId = String(formData.get("recommendationId") ?? "");

  if (recommendationId) {
    await deleteRecommendation(recommendationId);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function deleteTopicAction(formData: FormData) {
  await requireAdmin();
  const topicId = String(formData.get("topicId") ?? "");

  if (topicId) {
    await deleteTopic(topicId);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function deleteTalkingPointAction(formData: FormData) {
  await requireAdmin();
  const talkingPointId = String(formData.get("talkingPointId") ?? "");

  if (talkingPointId) {
    await deleteTalkingPoint(talkingPointId);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updatePersonaAction(formData: FormData) {
  const user = await requireUser();
  const personaId = String(formData.get("personaId"));

  if (user.id && personaId) {
    await updateUserPersona(user.id, personaId);
  }

  revalidatePath("/dashboard");
}

export async function updateTeamUserPersonaAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const personaId = String(formData.get("personaId") ?? "");

  if (userId && personaId) {
    await updateTeamUser({ userId, personaId });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updateTeamUserRoleAction(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "member") as Role;

  if (userId && ["owner", "admin", "member"].includes(role)) {
    await updateTeamUser({ userId, role });
  }

  revalidatePath("/admin");
  if (owner.id === userId) {
    revalidatePath("/dashboard");
  }
}

export async function deleteUserAction(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");

  if (userId && owner.id !== userId) {
    await deleteUser(userId);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createCampaignAction(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();

  if (title && summary) {
    await createCampaign(title, summary);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updateCampaignAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();

  if (id && title && summary) {
    await updateCampaign({ id, title, summary });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createBrandContextAction(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (title && category && content) {
    await createBrandContextSection(title, category, content);
  }

  revalidatePath("/admin");
}

export async function updateBrandContextAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (id && title && category && content) {
    await updateBrandContextSection({ id, title, category, content });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createTopicAction(formData: FormData) {
  await requireAdmin();
  const campaignId = String(formData.get("campaignId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const audience = String(formData.get("audience") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const talkingPoints = String(formData.get("talkingPoints") ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (title && summary && talkingPoints.length > 0) {
    await createTopic({ campaignId, title, summary, audience, talkingPoints });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updateTopicAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const audience = String(formData.get("audience") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (id && title && summary) {
    await updateTopic({ id, campaignId, title, summary, audience });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updateTalkingPointAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "fact").trim();
  const content = String(formData.get("content") ?? "").trim();
  const importance = Number(formData.get("importance") ?? 0);

  if (id && type && content) {
    await updateTalkingPoint({ id, type, content, importance });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createTalkingPointAction(formData: FormData) {
  await requireAdmin();
  const topicId = String(formData.get("topicId") ?? "");
  const type = String(formData.get("type") ?? "fact").trim();
  const content = String(formData.get("content") ?? "").trim();
  const importance = Number(formData.get("importance") ?? 0);

  if (topicId && type && content) {
    await createTalkingPoint({ topicId, type, content, importance });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function recommendTopicAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (userId && topicId) {
    await recommendTopic(userId, topicId, note);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updateAiSettingsAction(formData: FormData) {
  await requireAdmin();
  const provider = String(formData.get("provider") ?? "openai");
  const model = String(formData.get("model") ?? "gpt-4.1-mini");
  const settings = normalizeAiSettings(provider, model);

  await updateAiSettings(settings.provider, settings.model);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

function parseTextareaList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createPersonaAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const toneRules = parseTextareaList(formData.get("toneRules"));
  const framingRules = parseTextareaList(formData.get("framingRules"));

  if (name && description) {
    await createPersona({ name, description, toneRules, framingRules });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updatePersonaDefinitionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const toneRules = parseTextareaList(formData.get("toneRules"));
  const framingRules = parseTextareaList(formData.get("framingRules"));

  if (id && name && description) {
    await updatePersonaDefinition({ id, name, description, toneRules, framingRules });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function deletePersonaAction(formData: FormData) {
  await requireAdmin();
  const personaId = String(formData.get("personaId") ?? "");

  if (personaId) {
    await deletePersona(personaId);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updatePromptQualityControlsAction(formData: FormData) {
  await requireAdmin();
  await updatePromptQualityControls({
    bannedPhrases: parseTextareaList(formData.get("bannedPhrases")),
    preferredPhrases: parseTextareaList(formData.get("preferredPhrases")),
    neverClaim: parseTextareaList(formData.get("neverClaim")),
    channelStyleRules: {
      x: parseTextareaList(formData.get("xStyleRules")),
      linkedin: parseTextareaList(formData.get("linkedinStyleRules"))
    }
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createReferencePostAction(formData: FormData) {
  await requireAdmin();
  const content = String(formData.get("content") ?? "").trim();

  if (!content) {
    return { ok: false, error: "Paste the reference post content before saving." };
  }

  try {
    await createReferencePost({
      source: String(formData.get("source") ?? "manual") as ReferencePost["source"],
      channel: String(formData.get("channel") ?? "x") as Channel,
      label: String(formData.get("label") ?? "good_example") as ReferencePost["label"],
      author: String(formData.get("author") ?? "").trim() || undefined,
      url: String(formData.get("url") ?? "").trim() || undefined,
      content,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      personaId: String(formData.get("personaId") ?? "") || undefined,
      topicId: String(formData.get("topicId") ?? "") || undefined,
      campaignId: String(formData.get("campaignId") ?? "") || undefined
    });
  } catch (error) {
    console.error("Failed to create reference post", error);
    return {
      ok: false,
      error: "Could not save the reference post. Check that the database is migrated and try again."
    };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteReferencePostAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  if (id) {
    await deleteReferencePost(id);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

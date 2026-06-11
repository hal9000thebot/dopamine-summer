import {
  Channel as PrismaChannel,
  GeneratedPostStatus,
  TopicStatus,
  type Prisma,
  type UserRole
} from "@prisma/client";
import { createContentGenerator } from "@/lib/ai/contentGenerator";
import {
  annotateVariantsWithMemory,
  buildMemoryFromPosts,
  type VariantMemoryCheck
} from "@/lib/ai/memory";
import {
  AI_MODEL_OPTIONS,
  DEFAULT_AI_SETTINGS,
  normalizeAiSettings,
  type AiProvider
} from "@/lib/ai/settings";
import {
  DEFAULT_PROMPT_QUALITY_CONTROLS,
  normalizePromptQualityControls
} from "@/lib/ai/promptRules";
import { createPostEvaluator } from "@/lib/ai/postEvaluator";
import { fetchLinkContexts } from "@/lib/ai/linkContext";
import { formatPostForChannel } from "@/lib/ai/postFormatting";
import { prisma, isDatabaseConfigured } from "@/lib/db/prisma";
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
import {
  generatePrototypePosts,
  getPrototypeData,
  storeSelectedPost
} from "@/lib/data/prototypeStore";
import type {
  BrandContextSection,
  Campaign,
  Channel,
  LinkContext,
  Persona,
  PromptQualityControls,
  ReferencePost,
  SelectedPost,
  StoredGeneratedPost,
  Topic,
  User
} from "@/lib/types";

const FREEFORM_TOPIC_TITLE = "Freeform prompt";

function toDbChannel(channel: Channel) {
  return channel === "linkedin" ? PrismaChannel.LINKEDIN : PrismaChannel.X;
}

function toUiChannel(channel: PrismaChannel): Channel {
  return channel === PrismaChannel.LINKEDIN ? "linkedin" : "x";
}

function normalizeRole(role: UserRole): User["role"] {
  if (role === "INVITED") {
    return "member";
  }

  return role.toLowerCase() as User["role"];
}

function normalizePersonaName(name: string) {
  return name === "Generic team member" ? "Balanced team voice" : name;
}

function jsonStringArray(value: Prisma.JsonValue | null | undefined) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function mapPersona(persona: {
  id: string;
  name: string;
  description: string;
  toneRules: Prisma.JsonValue;
  framingRules: Prisma.JsonValue | null;
}): Persona {
  return {
    id: persona.id,
    name: normalizePersonaName(persona.name),
    description: persona.description,
    toneRules: jsonStringArray((persona.toneRules as { style?: string | string[] })?.style ?? persona.toneRules),
    framingRules: jsonStringArray(
      (persona.framingRules as { prefers?: string[] } | null)?.prefers ?? persona.framingRules
    )
  };
}

function parseMemoryCheck(value: Prisma.JsonValue | null | undefined): VariantMemoryCheck | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const risk = record.risk;

  if (risk !== "low" && risk !== "medium" && risk !== "high") {
    return undefined;
  }

  const memoryCheck: VariantMemoryCheck = {
    risk,
    similarityScore: typeof record.similarityScore === "number" ? record.similarityScore : 0,
    similarToPostId: typeof record.similarToPostId === "string" ? record.similarToPostId : undefined,
    similarToContent: typeof record.similarToContent === "string" ? record.similarToContent : undefined,
    repeatedAngle: Boolean(record.repeatedAngle),
    reasons: Array.isArray(record.reasons) ? record.reasons.map(String) : []
  };

  const aiWarning = record.aiWarning;
  if (aiWarning && typeof aiWarning === "object" && !Array.isArray(aiWarning)) {
    const warningRecord = aiWarning as Record<string, unknown>;
    memoryCheck.aiWarning = {
      aiFallback: Boolean(warningRecord.aiFallback),
      attemptedProvider:
        typeof warningRecord.attemptedProvider === "string" ? warningRecord.attemptedProvider : "openai",
      attemptedModel:
        typeof warningRecord.attemptedModel === "string" ? warningRecord.attemptedModel : "unknown",
      fallbackProvider:
        typeof warningRecord.fallbackProvider === "string" ? warningRecord.fallbackProvider : "mock",
      reason: typeof warningRecord.reason === "string" ? warningRecord.reason : "Unknown OpenAI error."
    };
  }

  const postEvaluation = record.postEvaluation;
  if (postEvaluation && typeof postEvaluation === "object" && !Array.isArray(postEvaluation)) {
    const evaluationRecord = postEvaluation as Record<string, unknown>;
    memoryCheck.postEvaluation = {
      provider: typeof evaluationRecord.provider === "string" ? evaluationRecord.provider : "unknown",
      model: typeof evaluationRecord.model === "string" ? evaluationRecord.model : "unknown",
      specificity: typeof evaluationRecord.specificity === "number" ? evaluationRecord.specificity : 3,
      brandFit: typeof evaluationRecord.brandFit === "number" ? evaluationRecord.brandFit : 3,
      originality: typeof evaluationRecord.originality === "number" ? evaluationRecord.originality : 3,
      factualRisk: typeof evaluationRecord.factualRisk === "number" ? evaluationRecord.factualRisk : 3,
      repetitionRisk:
        typeof evaluationRecord.repetitionRisk === "number" ? evaluationRecord.repetitionRisk : 3,
      warnings: Array.isArray(evaluationRecord.warnings) ? evaluationRecord.warnings.map(String) : [],
      evaluationWarning:
        typeof evaluationRecord.evaluationWarning === "string"
          ? evaluationRecord.evaluationWarning
          : undefined
    };
  }

  return memoryCheck;
}

function parseAdditionalContext(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const additionalContext = (value as Record<string, unknown>).additionalContext;
  return typeof additionalContext === "string" ? additionalContext.trim() : "";
}

function parseLinkContext(value: Prisma.JsonValue | null | undefined): LinkContext[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const linkContext = (value as Record<string, unknown>).linkContext;
  if (!Array.isArray(linkContext)) {
    return [];
  }

  const parsed: LinkContext[] = [];

  for (const item of linkContext) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const status = record.status === "fetched" ? "fetched" : record.status === "failed" ? "failed" : undefined;
    const url = typeof record.url === "string" ? record.url : "";

    if (!status || !url) {
      continue;
    }

    parsed.push({
        url,
        title: typeof record.title === "string" ? record.title : undefined,
        headings: Array.isArray(record.headings) ? record.headings.map(String) : undefined,
        excerpt: typeof record.excerpt === "string" ? record.excerpt : undefined,
        status,
      error: typeof record.error === "string" ? record.error : undefined
    });
  }

  return parsed;
}

async function ensureFreeformTopic() {
  const existingTopic = await prisma.topic.findFirst({
    where: { title: FREEFORM_TOPIC_TITLE },
    include: { talkingPoints: true }
  });

  if (existingTopic) {
    return existingTopic;
  }

  return prisma.topic.create({
    data: {
      title: FREEFORM_TOPIC_TITLE,
      summary: "User-directed one-off post not tied to a campaign.",
      status: TopicStatus.DRAFT,
      priority: -100,
      audience: ["Ambire users", "Web3 wallet users"],
      channels: [PrismaChannel.X, PrismaChannel.LINKEDIN],
      talkingPoints: {
        create: [
          {
            type: "angle",
            content: "Follow the user's brief as the primary direction.",
            importance: 10
          },
          {
            type: "avoid",
            content: "Do not turn this into a generic campaign post unless the brief asks for it.",
            importance: 9
          }
        ]
      }
    },
    include: { talkingPoints: true }
  });
}

export async function getAppData(userId?: string) {
  if (!isDatabaseConfigured()) {
    return getPrototypeData(userId);
  }

  const [
    dbUsers,
    dbPersonas,
    dbBrandContext,
    dbCampaigns,
    dbTopics,
    dbRecommendations,
    dbGeneratedPosts,
    dbSelectedPosts,
    dbFeedback,
    dbReferencePosts,
    dbSettings
  ] = await Promise.all([
    prisma.user.findMany({ include: { persona: true }, orderBy: { createdAt: "asc" } }),
    prisma.persona.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.brandContextSection.findMany({ where: { isActive: true }, orderBy: [{ priority: "asc" }, { title: "asc" }] }),
    prisma.campaign.findMany({ include: { topics: true }, orderBy: { createdAt: "desc" } }),
    prisma.topic.findMany({
      where: {
        OR: [{ status: TopicStatus.ACTIVE }, { title: FREEFORM_TOPIC_TITLE }]
      },
      include: { talkingPoints: { orderBy: { importance: "desc" } } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
    }),
    prisma.topicRecommendation.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.generatedPost.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.selectedPost.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.postFeedback.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.referencePost.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.appSetting.findMany()
  ]);
  const settingsByKey = new Map(dbSettings.map((setting) => [setting.key, setting.value]));
  const aiSettings = normalizeAiSettings(
    String(settingsByKey.get("ai_provider") ?? process.env.AI_PROVIDER ?? DEFAULT_AI_SETTINGS.provider),
    String(settingsByKey.get("ai_model") ?? process.env.AI_MODEL ?? DEFAULT_AI_SETTINGS.model)
  );
  const promptQualityControls = normalizePromptQualityControls(
    settingsByKey.get("prompt_quality_controls") ?? DEFAULT_PROMPT_QUALITY_CONTROLS
  );

  const mappedUsers: User[] = dbUsers.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    personaId: user.personaId ?? dbPersonas[0]?.id ?? ""
  }));
  const activeUser = mappedUsers.find((user) => user.id === userId) ?? mappedUsers[0];
  const mappedPersonas = dbPersonas.map(mapPersona);
  const activePersona =
    mappedPersonas.find((persona) => persona.id === activeUser?.personaId) ?? mappedPersonas[0];

  const mappedTopics: Topic[] = dbTopics.map((topic) => ({
    id: topic.id,
    campaignId: topic.campaignId ?? "",
    title: topic.title,
    summary: topic.summary,
    priority: topic.priority,
    audience: topic.audience,
    channels: topic.channels.map(toUiChannel),
    talkingPoints: topic.talkingPoints.map((point) => ({
      id: point.id,
      type: point.type as Topic["talkingPoints"][number]["type"],
      content: point.content,
      importance: point.importance
    }))
  }));

  const mappedCampaigns: Campaign[] = dbCampaigns.map((campaign) => ({
    id: campaign.id,
    title: campaign.title,
    summary: campaign.summary,
    topicIds: campaign.topics.map((topic) => topic.id)
  }));

  const mappedBrandContext: BrandContextSection[] = dbBrandContext.map((section) => ({
    id: section.id,
    title: section.title,
    category: section.category,
    content: section.content
  }));

  const mappedSelectedPosts: SelectedPost[] = dbSelectedPosts.map((post) => ({
    id: post.id,
    generatedPostId: post.generatedPostId,
    userId: post.userId,
    topicId: post.topicId,
    originalContent: post.originalContent,
    editedContent: post.editedContent,
    channel: toUiChannel(post.intendedChannel),
    copiedAt: (post.copiedAt ?? post.createdAt).toISOString(),
    wasEdited: post.wasEdited
  }));

  const mappedFeedback = dbFeedback.map((feedback) => ({
    id: feedback.id,
    generatedPostId: feedback.generatedPostId,
    userId: feedback.userId,
    originalityScore: feedback.originalityScore,
    accuracyScore: feedback.accuracyScore,
    qualityScore: feedback.qualityScore,
    createdAt: feedback.createdAt.toISOString()
  }));

  const selectedPostsByGeneratedId = new Map(
    mappedSelectedPosts.map((post) => [post.generatedPostId, post])
  );
  const feedbackByGeneratedId = new Map<string, (typeof mappedFeedback)[number]>();

  for (const feedback of mappedFeedback) {
    if (!feedbackByGeneratedId.has(feedback.generatedPostId)) {
      feedbackByGeneratedId.set(feedback.generatedPostId, feedback);
    }
  }

  const mappedGeneratedPosts: StoredGeneratedPost[] = dbGeneratedPosts.map((post) => ({
    id: post.id,
    userId: post.userId,
    topicId: post.topicId,
    personaId: post.personaId,
    channel: toUiChannel(post.channel),
    status: post.status.toLowerCase() as StoredGeneratedPost["status"],
    angle: post.angle,
    rationale: post.rationale,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    additionalContext: parseAdditionalContext(post.inputConfig),
    linkContext: parseLinkContext(post.inputConfig),
    selectedPost: selectedPostsByGeneratedId.get(post.id),
    latestFeedback: feedbackByGeneratedId.get(post.id),
    memoryCheck: parseMemoryCheck(post.qualityFlags)
  }));

  const mappedRecommendations = dbRecommendations.map((recommendation) => ({
    id: recommendation.id,
    userId: recommendation.userId,
    topicId: recommendation.topicId,
    note: recommendation.note ?? ""
  }));

  const mappedReferencePosts: ReferencePost[] = dbReferencePosts.map((post) => ({
    id: post.id,
    source: post.source as ReferencePost["source"],
    channel: toUiChannel(post.channel),
    label: post.label as ReferencePost["label"],
    author: post.author ?? undefined,
    url: post.url ?? undefined,
    content: post.content,
    notes: post.notes ?? undefined,
    personaId: post.personaId ?? undefined,
    topicId: post.topicId ?? undefined,
    campaignId: post.campaignId ?? undefined,
    createdAt: post.createdAt.toISOString()
  }));

  return {
    users: mappedUsers,
    user: activeUser,
    persona: activePersona,
    personas: mappedPersonas,
    brandContext: mappedBrandContext,
    campaigns: mappedCampaigns,
    topics: mappedTopics,
    recommendations: mappedRecommendations,
    referencePosts: mappedReferencePosts,
    recommendedTopicIds: new Set(
      mappedRecommendations.filter((item) => item.userId === activeUser?.id).map((item) => item.topicId)
    ),
    generatedPosts: mappedGeneratedPosts,
    selectedPosts: mappedSelectedPosts,
    feedback: mappedFeedback,
    aiSettings,
    promptQualityControls,
    aiModelOptions: AI_MODEL_OPTIONS
  };
}

export async function getAiSettings() {
  if (!isDatabaseConfigured()) {
    return normalizeAiSettings(process.env.AI_PROVIDER, process.env.AI_MODEL);
  }

  const settings = await prisma.appSetting.findMany({
    where: { key: { in: ["ai_provider", "ai_model"] } }
  });
  const settingsByKey = new Map(settings.map((setting) => [setting.key, setting.value]));

  return normalizeAiSettings(
    String(settingsByKey.get("ai_provider") ?? process.env.AI_PROVIDER ?? DEFAULT_AI_SETTINGS.provider),
    String(settingsByKey.get("ai_model") ?? process.env.AI_MODEL ?? DEFAULT_AI_SETTINGS.model)
  );
}

export async function updateAiSettings(provider: AiProvider, model: string) {
  const settings = normalizeAiSettings(provider, model);

  if (!isDatabaseConfigured()) {
    process.env.AI_PROVIDER = settings.provider;
    process.env.AI_MODEL = settings.model;
    return settings;
  }

  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: "ai_provider" },
      update: { value: settings.provider },
      create: { key: "ai_provider", value: settings.provider }
    }),
    prisma.appSetting.upsert({
      where: { key: "ai_model" },
      update: { value: settings.model },
      create: { key: "ai_model", value: settings.model }
    })
  ]);

  return settings;
}

export async function getPromptQualityControls() {
  if (!isDatabaseConfigured()) {
    return DEFAULT_PROMPT_QUALITY_CONTROLS;
  }

  const setting = await prisma.appSetting.findUnique({
    where: { key: "prompt_quality_controls" }
  });

  return normalizePromptQualityControls(setting?.value ?? DEFAULT_PROMPT_QUALITY_CONTROLS);
}

export async function updatePromptQualityControls(controls: PromptQualityControls) {
  const normalized = normalizePromptQualityControls(controls);

  if (!isDatabaseConfigured()) {
    return normalized;
  }

  await prisma.appSetting.upsert({
    where: { key: "prompt_quality_controls" },
    update: { value: normalized },
    create: { key: "prompt_quality_controls", value: normalized }
  });

  return normalized;
}

export async function generatePosts({
  userId,
  topicId,
  channel,
  additionalContext,
  freeformBrief,
  personaOverrideId,
  linkContext = []
}: {
  userId: string;
  topicId: string;
  channel: Channel;
  additionalContext?: string;
  freeformBrief?: string;
  personaOverrideId?: string;
  linkContext?: LinkContext[];
}) {
  if (!isDatabaseConfigured()) {
    return generatePrototypePosts({ userId, topicId, channel, additionalContext, personaOverrideId });
  }

  await prisma.generatedPost.deleteMany({
    where: {
      userId,
      status: GeneratedPostStatus.GENERATED
    }
  });

  const [user, topic, personaOverride, dbBrandContext, dbReferencePosts, recentPosts] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { persona: true } }),
    prisma.topic.findUniqueOrThrow({ where: { id: topicId }, include: { talkingPoints: true } }),
    personaOverrideId ? prisma.persona.findUnique({ where: { id: personaOverrideId } }) : Promise.resolve(null),
    prisma.brandContextSection.findMany({ where: { isActive: true }, orderBy: [{ priority: "asc" }] }),
    prisma.referencePost.findMany({
      where: { channel: toDbChannel(channel) },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.generatedPost.findMany({
      where: {
        topicId,
        status: { in: [GeneratedPostStatus.COPIED, GeneratedPostStatus.SELECTED] }
      },
      include: { selectedPost: true },
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ]);

  if (!user.persona) {
    throw new Error("User must select a persona before generating posts.");
  }
  const selectedPersona = personaOverride ?? user.persona;
  const defaultPersonaId = user.personaId ?? user.persona.id;

  const topicForPrompt: Topic = freeformBrief
    ? {
        id: topic.id,
        campaignId: "",
        title: FREEFORM_TOPIC_TITLE,
        summary: freeformBrief,
        priority: topic.priority,
        audience: ["Ambire users", "Web3 wallet users"],
        channels: [channel],
        talkingPoints: [
          {
            id: "freeform-brief",
            type: "angle",
            content: freeformBrief,
            importance: 10
          },
          {
            id: "freeform-avoid-generic",
            type: "avoid",
            content: "Do not drift into a generic product or campaign post. Answer the user's brief directly.",
            importance: 9
          }
        ]
      }
    : {
        id: topic.id,
        campaignId: topic.campaignId ?? "",
        title: topic.title,
        summary: topic.summary,
        priority: topic.priority,
        audience: topic.audience,
        channels: topic.channels.map(toUiChannel),
        talkingPoints: topic.talkingPoints.map((point) => ({
          id: point.id,
          type: point.type as Topic["talkingPoints"][number]["type"],
          content: point.content,
          importance: point.importance
        }))
      };
  const additionalContextForPrompt = freeformBrief
    ? [
        `User-directed freeform brief: ${freeformBrief}`,
        "Treat this brief as the main subject. Use persona, brand context, reference posts, and prompt quality rules as constraints/supporting context."
      ].join("\n")
    : additionalContext;
  const aiSettings = await getAiSettings();
  const promptQualityControls = await getPromptQualityControls();
  const generator = createContentGenerator(aiSettings);
  const evaluator = createPostEvaluator(aiSettings);
  const personaId = selectedPersona.id;
  const memory = buildMemoryFromPosts({
    posts: recentPosts.map((post) => ({
      id: post.id,
      userId: post.userId,
      topicId: post.topicId,
      personaId: post.personaId,
      channel: toUiChannel(post.channel),
      status: post.status.toLowerCase() as StoredGeneratedPost["status"],
      angle: post.angle,
      rationale: post.rationale,
      content: post.content,
      createdAt: post.createdAt.toISOString(),
      selectedPost: post.selectedPost
        ? {
            id: post.selectedPost.id,
            generatedPostId: post.selectedPost.generatedPostId,
            userId: post.selectedPost.userId,
            topicId: post.selectedPost.topicId,
            originalContent: post.selectedPost.originalContent,
            editedContent: post.selectedPost.editedContent,
            channel: toUiChannel(post.selectedPost.intendedChannel),
            copiedAt: (post.selectedPost.copiedAt ?? post.selectedPost.createdAt).toISOString(),
            wasEdited: post.selectedPost.wasEdited
          }
        : undefined
    })),
    topicId,
    personaId,
    channel
  });

  const generationInput = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      personaId
    },
    persona: mapPersona(selectedPersona),
    topic: topicForPrompt,
    brandContext: dbBrandContext.map((section) => ({
      id: section.id,
      title: section.title,
      category: section.category,
      content: section.content
    })),
    promptQualityControls,
    referencePosts: dbReferencePosts
      .filter((post) => !post.topicId || post.topicId === topic.id)
      .filter((post) => !post.personaId || post.personaId === personaId)
      .slice(0, 8)
      .map((post) => ({
        id: post.id,
        source: post.source as ReferencePost["source"],
        channel: toUiChannel(post.channel),
        label: post.label as ReferencePost["label"],
        author: post.author ?? undefined,
        url: post.url ?? undefined,
        content: post.content,
        notes: post.notes ?? undefined,
        personaId: post.personaId ?? undefined,
        topicId: post.topicId ?? undefined,
        campaignId: post.campaignId ?? undefined,
        createdAt: post.createdAt.toISOString()
      })),
    linkContext,
    channel,
    additionalContext: additionalContextForPrompt,
    memory
  };
  const result = await generator.generatePostVariants(generationInput);
  const formattedResultVariants = result.variants.map((variant) => ({
    ...variant,
    content: formatPostForChannel(variant.content, channel)
  }));
  const variants = await evaluator.evaluate(generationInput, annotateVariantsWithMemory(formattedResultVariants, memory));

  await prisma.generatedPost.createMany({
    data: variants.map((variant, index) => {
      const qualityFlags = result.aiWarning
        ? { ...variant.memoryCheck, aiWarning: result.aiWarning }
        : variant.memoryCheck;

      return {
        userId: user.id,
        topicId: topic.id,
        personaId: selectedPersona.id,
        channel: toDbChannel(channel),
        variantIndex: index,
        inputConfig: {
          channel,
          additionalContext: additionalContext ?? "",
          mode: freeformBrief ? "freeform" : "topic",
          personaId: selectedPersona.id,
          defaultPersonaId,
          linkContext,
          promptQualityControls,
          aiWarning: result.aiWarning ?? null
        },
        promptVersion: result.promptVersion,
        provider: result.provider,
        model: result.model,
        content: variant.content,
        angle: variant.angle,
        rationale: variant.rationale,
        similarityScore: variant.memoryCheck.similarityScore,
        duplicateOfPostId: variant.memoryCheck.similarToPostId,
        qualityFlags
      };
    })
  });
}

export async function generateFreeformPosts({
  userId,
  channel,
  brief,
  personaOverrideId,
  sourceLinks = []
}: {
  userId: string;
  channel: Channel;
  brief: string;
  personaOverrideId?: string;
  sourceLinks?: string[];
}) {
  const trimmedBrief = brief.trim();

  if (!trimmedBrief) {
    throw new Error("Freeform brief is required.");
  }

  if (!isDatabaseConfigured()) {
    const fallbackTopicId = topics[0]?.id ?? "freeform-prompt";
    return generatePrototypePosts({
      userId,
      topicId: fallbackTopicId,
      channel,
      additionalContext: trimmedBrief,
      personaOverrideId
    });
  }

  const topic = await ensureFreeformTopic();
  const linkContext = await fetchLinkContexts(sourceLinks);

  return generatePosts({
    userId,
    topicId: topic.id,
    channel,
    additionalContext: trimmedBrief,
    freeformBrief: trimmedBrief,
    personaOverrideId,
    linkContext
  });
}

export async function saveEditedPost({
  generatedPostId,
  editedContent
}: {
  generatedPostId: string;
  editedContent: string;
}) {
  if (!isDatabaseConfigured()) {
    return storeSelectedPost({ generatedPostId, editedContent });
  }

  const post = await prisma.generatedPost.findUniqueOrThrow({ where: { id: generatedPostId } });
  const wasEdited = post.content.trim() !== editedContent.trim();

  await prisma.$transaction([
    prisma.generatedPost.update({
      where: { id: generatedPostId },
      data: { status: GeneratedPostStatus.COPIED }
    }),
    prisma.selectedPost.upsert({
      where: { generatedPostId },
      update: {
        editedContent,
        wasEdited,
        copiedAt: new Date()
      },
      create: {
        generatedPostId,
        userId: post.userId,
        topicId: post.topicId,
        originalContent: post.content,
        editedContent,
        wasEdited,
        intendedChannel: post.channel,
        copiedAt: new Date()
      }
    }),
    prisma.generatedPost.deleteMany({
      where: {
        userId: post.userId,
        status: GeneratedPostStatus.GENERATED,
        id: { not: generatedPostId }
      }
    })
  ]);
}

export async function dismissGeneratedPost(generatedPostId: string) {
  if (!isDatabaseConfigured()) {
    const post = generatedPosts.find((item) => item.id === generatedPostId);
    if (post && post.status === "generated") {
      post.status = "rejected";
    }
    return;
  }

  await prisma.generatedPost.update({
    where: { id: generatedPostId },
    data: { status: GeneratedPostStatus.REJECTED }
  });
}

export async function deleteGeneratedPost(generatedPostId: string) {
  if (!isDatabaseConfigured()) {
    const index = generatedPosts.findIndex((item) => item.id === generatedPostId);
    if (index >= 0) {
      generatedPosts.splice(index, 1);
    }
    return;
  }

  await prisma.$transaction([
    prisma.postFeedback.deleteMany({ where: { generatedPostId } }),
    prisma.selectedPost.deleteMany({ where: { generatedPostId } }),
    prisma.generatedPost.delete({ where: { id: generatedPostId } })
  ]);
}

export async function deleteCampaign(campaignId: string) {
  if (!isDatabaseConfigured()) {
    const index = campaigns.findIndex((item) => item.id === campaignId);
    if (index >= 0) {
      campaigns.splice(index, 1);
    }
    for (const topic of topics) {
      if (topic.campaignId === campaignId) {
        topic.campaignId = "";
      }
    }
    return;
  }

  await prisma.$transaction([
    prisma.topic.updateMany({
      where: { campaignId },
      data: { campaignId: null }
    }),
    prisma.referencePost.updateMany({
      where: { campaignId },
      data: { campaignId: null }
    }),
    prisma.campaign.delete({ where: { id: campaignId } })
  ]);
}

export async function deleteRecommendation(recommendationId: string) {
  if (!isDatabaseConfigured()) {
    const index = recommendations.findIndex((item) => item.id === recommendationId);
    if (index >= 0) {
      recommendations.splice(index, 1);
    }
    return;
  }

  await prisma.topicRecommendation.delete({ where: { id: recommendationId } });
}

export async function deleteTopic(topicId: string) {
  if (!isDatabaseConfigured()) {
    const index = topics.findIndex((item) => item.id === topicId);
    if (index >= 0) {
      topics.splice(index, 1);
    }
    for (const campaign of campaigns) {
      campaign.topicIds = campaign.topicIds.filter((id) => id !== topicId);
    }
    return;
  }

  const posts = await prisma.generatedPost.findMany({
    where: { topicId },
    select: { id: true }
  });
  const generatedPostIds = posts.map((post) => post.id);

  await prisma.$transaction([
    prisma.postFeedback.deleteMany({
      where: { generatedPostId: { in: generatedPostIds } }
    }),
    prisma.selectedPost.deleteMany({ where: { topicId } }),
    prisma.generatedPost.deleteMany({ where: { topicId } }),
    prisma.topicRecommendation.deleteMany({ where: { topicId } }),
    prisma.referencePost.updateMany({
      where: { topicId },
      data: { topicId: null }
    }),
    prisma.talkingPoint.deleteMany({ where: { topicId } }),
    prisma.topic.delete({ where: { id: topicId } })
  ]);
}

export async function deleteUnsavedGeneratedPosts() {
  if (!isDatabaseConfigured()) {
    return;
  }

  await prisma.generatedPost.deleteMany({
    where: { status: GeneratedPostStatus.GENERATED }
  });
}

export async function updateUserPersona(userId: string, personaId: string) {
  if (!isDatabaseConfigured()) {
    const user = users.find((item) => item.id === userId);
    if (user) user.personaId = personaId;
    return;
  }

  await prisma.user.update({ where: { id: userId }, data: { personaId } });
}

export async function updateTeamUser({
  userId,
  role,
  personaId
}: {
  userId: string;
  role?: User["role"];
  personaId?: string;
}) {
  if (!isDatabaseConfigured()) {
    const user = users.find((item) => item.id === userId);
    if (user) {
      if (role) user.role = role;
      if (personaId) user.personaId = personaId;
    }
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(role ? { role: role.toUpperCase() as UserRole } : {}),
      ...(personaId ? { personaId } : {})
    }
  });
}

export async function deleteUser(userId: string) {
  if (!isDatabaseConfigured()) {
    const target = users.find((item) => item.id === userId);
    if (!target) {
      return;
    }

    const ownerCount = users.filter((item) => item.role === "owner").length;
    if (target.role === "owner" && ownerCount <= 1) {
      throw new Error("Cannot delete the last owner.");
    }

    const userIndex = users.findIndex((item) => item.id === userId);
    if (userIndex >= 0) {
      users.splice(userIndex, 1);
    }

    for (let index = generatedPosts.length - 1; index >= 0; index -= 1) {
      if (generatedPosts[index].userId === userId) {
        generatedPosts.splice(index, 1);
      }
    }

    for (let index = recommendations.length - 1; index >= 0; index -= 1) {
      if (recommendations[index].userId === userId) {
        recommendations.splice(index, 1);
      }
    }
    return;
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (!target) {
    return;
  }

  if (target.role === "OWNER") {
    const ownerCount = await prisma.user.count({ where: { role: "OWNER" } });
    if (ownerCount <= 1) {
      throw new Error("Cannot delete the last owner.");
    }
  }

  const posts = await prisma.generatedPost.findMany({
    where: { userId },
    select: { id: true }
  });
  const generatedPostIds = posts.map((post) => post.id);
  const generatedPostFilters = generatedPostIds.length
    ? [{ generatedPostId: { in: generatedPostIds } }]
    : [];

  await prisma.$transaction([
    prisma.postFeedback.deleteMany({
      where: { OR: [{ userId }, ...generatedPostFilters] }
    }),
    prisma.selectedPost.deleteMany({
      where: { OR: [{ userId }, ...generatedPostFilters] }
    }),
    prisma.generatedPost.deleteMany({ where: { userId } }),
    prisma.topicRecommendation.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } })
  ]);
}

export async function createPersona({
  name,
  description,
  toneRules,
  framingRules
}: {
  name: string;
  description: string;
  toneRules: string[];
  framingRules: string[];
}) {
  if (!isDatabaseConfigured()) {
    personas.push({
      id: crypto.randomUUID(),
      name,
      description,
      toneRules,
      framingRules
    });
    return;
  }

  await prisma.persona.create({
    data: {
      name,
      description,
      toneRules: { style: toneRules },
      framingRules: { prefers: framingRules }
    }
  });
}

export async function updatePersonaDefinition({
  id,
  name,
  description,
  toneRules,
  framingRules
}: {
  id: string;
  name: string;
  description: string;
  toneRules: string[];
  framingRules: string[];
}) {
  if (!isDatabaseConfigured()) {
    const persona = personas.find((item) => item.id === id);
    if (persona) {
      persona.name = name;
      persona.description = description;
      persona.toneRules = toneRules;
      persona.framingRules = framingRules;
    }
    return;
  }

  await prisma.persona.update({
    where: { id },
    data: {
      name,
      description,
      toneRules: { style: toneRules },
      framingRules: { prefers: framingRules }
    }
  });
}

export async function deletePersona(id: string) {
  if (!isDatabaseConfigured()) {
    if (personas.length <= 1) {
      return;
    }

    const fallback = personas.find((item) => item.id !== id);
    if (!fallback) {
      return;
    }

    const index = personas.findIndex((item) => item.id === id);
    if (index >= 0) {
      personas.splice(index, 1);
    }

    for (const user of users) {
      if (user.personaId === id) {
        user.personaId = fallback.id;
      }
    }

    for (const post of generatedPosts) {
      if (post.personaId === id) {
        post.personaId = fallback.id;
      }
    }
    return;
  }

  const fallback = await prisma.persona.findFirst({
    where: { id: { not: id } },
    orderBy: { createdAt: "asc" }
  });

  if (!fallback) {
    throw new Error("Cannot delete the last persona.");
  }

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { personaId: id },
      data: { personaId: fallback.id }
    }),
    prisma.generatedPost.updateMany({
      where: { personaId: id },
      data: { personaId: fallback.id }
    }),
    prisma.referencePost.updateMany({
      where: { personaId: id },
      data: { personaId: null }
    }),
    prisma.persona.delete({ where: { id } })
  ]);
}

export async function createCampaign(title: string, summary: string) {
  if (!isDatabaseConfigured()) {
    campaigns.unshift({ id: crypto.randomUUID(), title, summary, topicIds: [] });
    return;
  }

  await prisma.campaign.create({ data: { title, summary, status: TopicStatus.ACTIVE } });
}

export async function updateCampaign({
  id,
  title,
  summary
}: {
  id: string;
  title: string;
  summary: string;
}) {
  if (!isDatabaseConfigured()) {
    const campaign = campaigns.find((item) => item.id === id);
    if (campaign) {
      campaign.title = title;
      campaign.summary = summary;
    }
    return;
  }

  await prisma.campaign.update({
    where: { id },
    data: { title, summary }
  });
}

export async function createBrandContextSection(title: string, category: string, content: string) {
  if (!isDatabaseConfigured()) {
    brandContext.unshift({ id: crypto.randomUUID(), title, category, content });
    return;
  }

  await prisma.brandContextSection.upsert({
    where: { title },
    update: { category, content, isActive: true },
    create: { title, category, content, isActive: true }
  });
}

export async function updateBrandContextSection({
  id,
  title,
  category,
  content
}: {
  id: string;
  title: string;
  category: string;
  content: string;
}) {
  if (!isDatabaseConfigured()) {
    const section = brandContext.find((item) => item.id === id);
    if (section) {
      section.title = title;
      section.category = category;
      section.content = content;
    }
    return;
  }

  await prisma.brandContextSection.update({
    where: { id },
    data: { title, category, content }
  });
}

export async function createTopic({
  campaignId,
  title,
  summary,
  audience,
  talkingPoints
}: {
  campaignId: string;
  title: string;
  summary: string;
  audience: string[];
  talkingPoints: string[];
}) {
  if (!isDatabaseConfigured()) {
    const id = crypto.randomUUID();
    topics.unshift({
      id,
      campaignId,
      title,
      summary,
      priority: 0,
      audience,
      channels: ["x", "linkedin"],
      talkingPoints: talkingPoints.map((content) => ({
        id: crypto.randomUUID(),
        type: "angle",
        content
      }))
    });
    campaigns.find((campaign) => campaign.id === campaignId)?.topicIds.unshift(id);
    return;
  }

  await prisma.topic.create({
    data: {
      campaignId: campaignId || null,
      title,
      summary,
      status: TopicStatus.ACTIVE,
      audience,
      channels: [PrismaChannel.X, PrismaChannel.LINKEDIN],
      talkingPoints: {
        create: talkingPoints.map((content, index) => ({
          type: index === 0 ? "angle" : "fact",
          content,
          importance: 10 - index
        }))
      }
    }
  });
}

export async function updateTopic({
  id,
  campaignId,
  title,
  summary,
  audience
}: {
  id: string;
  campaignId: string;
  title: string;
  summary: string;
  audience: string[];
}) {
  if (!isDatabaseConfigured()) {
    const topic = topics.find((item) => item.id === id);
    if (topic) {
      topic.campaignId = campaignId;
      topic.title = title;
      topic.summary = summary;
      topic.audience = audience;
    }
    return;
  }

  await prisma.topic.update({
    where: { id },
    data: {
      campaignId: campaignId || null,
      title,
      summary,
      audience
    }
  });
}

export async function updateTalkingPoint({
  id,
  type,
  content,
  importance
}: {
  id: string;
  type: string;
  content: string;
  importance: number;
}) {
  if (!isDatabaseConfigured()) {
    for (const topic of topics) {
      const point = topic.talkingPoints.find((item) => item.id === id);
      if (point) {
        point.type = type as typeof point.type;
        point.content = content;
        point.importance = importance;
        return;
      }
    }
    return;
  }

  await prisma.talkingPoint.update({
    where: { id },
    data: { type, content, importance }
  });
}

export async function deleteTalkingPoint(id: string) {
  if (!isDatabaseConfigured()) {
    for (const topic of topics) {
      const index = topic.talkingPoints.findIndex((item) => item.id === id);
      if (index >= 0) {
        topic.talkingPoints.splice(index, 1);
        return;
      }
    }
    return;
  }

  await prisma.talkingPoint.delete({ where: { id } });
}

export async function createTalkingPoint({
  topicId,
  type,
  content,
  importance
}: {
  topicId: string;
  type: string;
  content: string;
  importance: number;
}) {
  if (!isDatabaseConfigured()) {
    const topic = topics.find((item) => item.id === topicId);
    topic?.talkingPoints.unshift({
      id: crypto.randomUUID(),
      type: type as Topic["talkingPoints"][number]["type"],
      content,
      importance
    });
    return;
  }

  await prisma.talkingPoint.create({
    data: { topicId, type, content, importance }
  });
}

export async function recommendTopic(userId: string, topicId: string, note: string) {
  if (!isDatabaseConfigured()) {
    recommendations.unshift({ id: crypto.randomUUID(), userId, topicId, note });
    return;
  }

  await prisma.topicRecommendation.upsert({
    where: { userId_topicId: { userId, topicId } },
    update: { note },
    create: { userId, topicId, note }
  });
}

export async function createReferencePost({
  source,
  channel,
  label,
  author,
  url,
  content,
  notes,
  personaId,
  topicId,
  campaignId
}: {
  source: ReferencePost["source"];
  channel: Channel;
  label: ReferencePost["label"];
  author?: string;
  url?: string;
  content: string;
  notes?: string;
  personaId?: string;
  topicId?: string;
  campaignId?: string;
}) {
  const referencePost: ReferencePost = {
    id: crypto.randomUUID(),
    source,
    channel,
    label,
    author,
    url,
    content,
    notes,
    personaId,
    topicId,
    campaignId,
    createdAt: new Date().toISOString()
  };

  if (!isDatabaseConfigured()) {
    referencePosts.unshift(referencePost);
    return;
  }

  await prisma.referencePost.create({
    data: {
      source,
      channel: toDbChannel(channel),
      label,
      author: author || null,
      url: url || null,
      content,
      notes: notes || null,
      personaId: personaId || null,
      topicId: topicId || null,
      campaignId: campaignId || null
    }
  });
}

export async function deleteReferencePost(id: string) {
  if (!isDatabaseConfigured()) {
    const index = referencePosts.findIndex((item) => item.id === id);
    if (index >= 0) {
      referencePosts.splice(index, 1);
    }
    return;
  }

  await prisma.referencePost.delete({ where: { id } });
}

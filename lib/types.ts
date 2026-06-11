export type Role = "owner" | "admin" | "member";
export type Channel = "x" | "linkedin";

export type Persona = {
  id: string;
  name: string;
  description: string;
  toneRules: string[];
  framingRules: string[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  personaId: string;
};

export type BrandContextSection = {
  id: string;
  title: string;
  category: string;
  content: string;
};

export type Campaign = {
  id: string;
  title: string;
  summary: string;
  topicIds: string[];
};

export type Topic = {
  id: string;
  campaignId: string;
  title: string;
  summary: string;
  priority: number;
  audience: string[];
  channels: Channel[];
  talkingPoints: TalkingPoint[];
};

export type TalkingPoint = {
  id: string;
  type: "angle" | "fact" | "avoid" | "cta" | "proof";
  content: string;
  importance?: number;
};

export type TopicRecommendation = {
  id: string;
  userId: string;
  topicId: string;
  note: string;
};

export type ReferencePost = {
  id: string;
  source: "x" | "linkedin" | "manual";
  channel: Channel;
  label: "good_example" | "avoid_example" | "brand_voice" | "high_performing" | "competitor";
  author?: string;
  url?: string;
  content: string;
  notes?: string;
  personaId?: string;
  topicId?: string;
  campaignId?: string;
  createdAt: string;
};

export type LinkContext = {
  url: string;
  title?: string;
  headings?: string[];
  excerpt?: string;
  status: "fetched" | "failed";
  error?: string;
};

export type GeneratePostInput = {
  user: User;
  persona: Persona;
  topic: Topic;
  brandContext: BrandContextSection[];
  promptQualityControls?: PromptQualityControls;
  referencePosts?: ReferencePost[];
  linkContext?: LinkContext[];
  channel: Channel;
  additionalContext?: string;
  memory?: {
    usedAngles: string[];
    recentSavedPosts: {
      id: string;
      content: string;
      editedContent?: string;
      angle: string;
      createdAt: string;
    }[];
  };
};

export type PromptQualityControls = {
  bannedPhrases: string[];
  preferredPhrases: string[];
  neverClaim: string[];
  channelStyleRules: {
    x: string[];
    linkedin: string[];
  };
};

export type GeneratedVariant = {
  id: string;
  content: string;
  angle: string;
  rationale: string;
};

export type GeneratePostResult = {
  provider: string;
  model: string;
  promptVersion: string;
  variants: GeneratedVariant[];
  aiWarning?: AiWarning;
};

export type AiWarning = {
  aiFallback: boolean;
  attemptedProvider: string;
  attemptedModel: string;
  fallbackProvider: string;
  reason: string;
};

export type PostEvaluation = {
  provider: string;
  model: string;
  specificity: number;
  brandFit: number;
  originality: number;
  factualRisk: number;
  repetitionRisk: number;
  warnings: string[];
  evaluationWarning?: string;
};

export type StoredGeneratedPost = GeneratedVariant & {
  userId: string;
  topicId: string;
  personaId: string;
  channel: Channel;
  status: "generated" | "selected" | "copied" | "rejected";
  createdAt: string;
  additionalContext?: string;
  linkContext?: LinkContext[];
  selectedPost?: SelectedPost;
  latestFeedback?: PostFeedback;
  memoryCheck?: {
    risk: "low" | "medium" | "high";
    similarityScore: number;
    similarToPostId?: string;
    similarToContent?: string;
    repeatedAngle: boolean;
    reasons: string[];
    aiWarning?: AiWarning;
    postEvaluation?: PostEvaluation;
  };
};

export type SelectedPost = {
  id: string;
  generatedPostId: string;
  userId: string;
  topicId: string;
  originalContent: string;
  editedContent: string;
  channel: Channel;
  copiedAt: string;
  wasEdited: boolean;
};

export type PostFeedback = {
  id: string;
  generatedPostId: string;
  userId: string;
  originalityScore: number;
  accuracyScore: number;
  qualityScore: number;
  createdAt: string;
};

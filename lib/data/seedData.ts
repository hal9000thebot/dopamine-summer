import type {
  BrandContextSection,
  Campaign,
  Persona,
  ReferencePost,
  StoredGeneratedPost,
  Topic,
  TopicRecommendation,
  User
} from "@/lib/types";

export const personas: Persona[] = [
  {
    id: "founder",
    name: "Founder",
    description: "Strategic, opinionated, market-aware, but grounded in concrete product reality.",
    toneRules: ["Confident", "Direct", "Calm"],
    framingRules: ["Category direction", "Company belief", "User outcomes"]
  },
  {
    id: "technical-builder",
    name: "Technical builder",
    description: "Precise and practical, with useful technical detail and low tolerance for fluff.",
    toneRules: ["Specific", "Thoughtful", "Lightly opinionated"],
    framingRules: ["Tradeoffs", "Implementation details", "Technical user impact"]
  },
  {
    id: "ux-advocate",
    name: "UX advocate",
    description: "Frames posts around clarity, trust, onboarding, and reduced friction.",
    toneRules: ["Clear", "User-centered", "Practical"],
    framingRules: ["User confusion", "Decision fatigue", "Clarity"]
  },
  {
    id: "marketer",
    name: "Marketer / non-technical",
    description: "Accessible, benefits-led, and concrete without sounding salesy.",
    toneRules: ["Plainspoken", "Useful", "Polished"],
    framingRules: ["Benefits", "Pain points", "Simple examples"]
  },
  {
    id: "generic-team-member",
    name: "Balanced team voice",
    description: "Balanced voice with no strong technical, UX, or founder bias.",
    toneRules: ["Natural", "Concise", "Human"],
    framingRules: ["Practical observations", "Team learnings", "Product usefulness"]
  }
];

export const users: User[] = [
  { id: "owner", name: "Ambire Owner", email: "owner@ambire.com", role: "owner", personaId: "founder" },
  { id: "admin", name: "Marketing Admin", email: "admin@ambire.com", role: "admin", personaId: "marketer" },
  { id: "builder", name: "Team Builder", email: "builder@ambire.com", role: "member", personaId: "technical-builder" }
];

export const brandContext: BrandContextSection[] = [
  {
    id: "voice",
    title: "Brand Voice",
    category: "voice",
    content: "Ambire sounds clear, practical, security-conscious, and human. Prefer specific product details over broad Web3 claims."
  },
  {
    id: "positioning",
    title: "Positioning",
    category: "positioning",
    content: "Ambire is a UX-first Web3 wallet built for practical self-custody and calmer day-to-day wallet use."
  },
  {
    id: "security",
    title: "Security Claims",
    category: "claims",
    content: "Security should be framed as calm confidence. Do not invent audit, custody, or risk claims."
  },
  {
    id: "avoid",
    title: "Things To Avoid",
    category: "avoid",
    content: "Avoid hype, unsupported roadmap claims, fear-based security messaging, and generic phrases like 'revolutionizing finance'."
  }
];

export const campaigns: Campaign[] = [
  {
    id: "wallet-ux-education",
    title: "Wallet UX Education",
    summary: "Explain why better wallet UX matters for practical self-custody.",
    topicIds: ["signing-anxiety", "transaction-clarity"]
  }
];

export const topics: Topic[] = [
  {
    id: "signing-anxiety",
    campaignId: "wallet-ux-education",
    title: "Reducing signing anxiety",
    summary: "Ambire wants wallet actions to feel understandable and less stressful.",
    priority: 10,
    audience: ["wallet users", "web3 builders"],
    channels: ["x", "linkedin"],
    talkingPoints: [
      { id: "tp-1", type: "angle", content: "Good wallet UX reduces decision fatigue instead of hiding everything." },
      { id: "tp-2", type: "fact", content: "Ambire focuses on clearer wallet flows and practical self-custody." },
      { id: "tp-3", type: "avoid", content: "Do not claim users never need to understand what they sign." }
    ]
  },
  {
    id: "transaction-clarity",
    campaignId: "wallet-ux-education",
    title: "Clearer transaction context",
    summary: "Wallets should help people understand what is happening before they approve an action.",
    priority: 8,
    audience: ["wallet users", "security-minded users"],
    channels: ["x", "linkedin"],
    talkingPoints: [
      { id: "tp-4", type: "angle", content: "Self-custody gets safer when interfaces explain consequences clearly." },
      { id: "tp-5", type: "fact", content: "Ambire treats clarity as part of wallet security." },
      { id: "tp-6", type: "avoid", content: "Do not imply the product can remove all user responsibility." }
    ]
  }
];

export const recommendations: TopicRecommendation[] = [
  {
    id: "rec-builder-signing",
    userId: "builder",
    topicId: "signing-anxiety",
    note: "Good fit for a technical-but-accessible post this week."
  }
];

export const referencePosts: ReferencePost[] = [];

export const generatedPosts: StoredGeneratedPost[] = [
  {
    id: "sample-post",
    userId: "builder",
    topicId: "signing-anxiety",
    personaId: "technical-builder",
    channel: "x",
    status: "copied",
    angle: "Decision fatigue",
    rationale: "Connects wallet UX to a specific user stress instead of a vague product claim.",
    content:
      "A wallet should not make every action feel like a tiny security audit. The hard part is giving people enough context to make a good decision without burying them in prompts.",
    createdAt: new Date().toISOString()
  }
];

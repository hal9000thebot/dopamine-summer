import { PrismaClient, UserRole, Channel, TopicStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const personas = await Promise.all([
    prisma.persona.upsert({
      where: { name: "Founder" },
      update: {},
      create: {
        name: "Founder",
        description: "Strategic, opinionated, market-aware, but concrete.",
        toneRules: { style: "confident, direct, calm", avoid: ["hype", "empty vision statements"] },
        framingRules: { prefers: ["category direction", "company belief", "user outcomes"] }
      }
    }),
    prisma.persona.upsert({
      where: { name: "Technical builder" },
      update: {},
      create: {
        name: "Technical builder",
        description: "Precise and practical, with useful technical detail.",
        toneRules: { style: "specific, thoughtful, lightly opinionated", avoid: ["marketing fluff"] },
        framingRules: { prefers: ["tradeoffs", "implementation details", "technical user impact"] }
      }
    }),
    prisma.persona.upsert({
      where: { name: "UX advocate" },
      update: {},
      create: {
        name: "UX advocate",
        description: "Frames posts around clarity, trust, onboarding, and reduced friction.",
        toneRules: { style: "clear, user-centered, practical", avoid: ["protocol jargon without explanation"] },
        framingRules: { prefers: ["user confusion", "decision fatigue", "clarity"] }
      }
    }),
    prisma.persona.upsert({
      where: { name: "Marketer / non-technical" },
      update: {},
      create: {
        name: "Marketer / non-technical",
        description: "Accessible, benefits-led, and concrete without sounding salesy.",
        toneRules: { style: "plainspoken, useful, polished", avoid: ["overclaiming", "buzzwords"] },
        framingRules: { prefers: ["benefits", "audience pain points", "simple examples"] }
      }
    }),
    prisma.persona.upsert({
      where: { name: "Balanced team voice" },
      update: {
        description: "Balanced voice with no strong technical, UX, or founder bias.",
        toneRules: { style: "natural, concise, team-member voice", avoid: ["corporate announcements"] },
        framingRules: { prefers: ["practical observations", "team learnings", "product usefulness"] }
      },
      create: {
        name: "Balanced team voice",
        description: "Balanced voice with no strong technical, UX, or founder bias.",
        toneRules: { style: "natural, concise, team-member voice", avoid: ["corporate announcements"] },
        framingRules: { prefers: ["practical observations", "team learnings", "product usefulness"] }
      }
    })
  ]);

  const owner = await prisma.user.upsert({
    where: { email: "owner@ambire.com" },
    update: {},
    create: { email: "owner@ambire.com", name: "Ambire Owner", role: UserRole.OWNER, personaId: personas[0].id }
  });

  await prisma.user.upsert({
    where: { email: "admin@ambire.com" },
    update: {},
    create: { email: "admin@ambire.com", name: "Marketing Admin", role: UserRole.ADMIN, personaId: personas[3].id }
  });

  const member = await prisma.user.upsert({
    where: { email: "builder@ambire.com" },
    update: {},
    create: { email: "builder@ambire.com", name: "Team Builder", role: UserRole.MEMBER, personaId: personas[1].id }
  });

  await Promise.all([
    prisma.brandContextSection.upsert({
      where: { title: "Brand Voice" },
      update: {},
      create: {
        title: "Brand Voice",
        category: "voice",
        priority: 10,
        content: "Ambire sounds clear, practical, secure, and human. Prefer specific product details over broad Web3 claims."
      }
    }),
    prisma.brandContextSection.upsert({
      where: { title: "Things To Avoid" },
      update: {},
      create: {
        title: "Things To Avoid",
        category: "avoid",
        priority: 20,
        content: "Avoid hype, unsupported roadmap claims, fear-based security messaging, and generic phrases like 'revolutionizing finance'."
      }
    }),
    prisma.brandContextSection.upsert({
      where: { title: "Security Claims" },
      update: {},
      create: {
        title: "Security Claims",
        category: "claims",
        priority: 30,
        content: "Security should be framed as calm confidence. Do not invent audit, custody, or risk claims."
      }
    })
  ]);

  const campaign = await prisma.campaign.create({
    data: {
      title: "Wallet UX Education",
      summary: "Explain why better wallet UX matters for practical self-custody.",
      status: TopicStatus.ACTIVE
    }
  });

  const topic = await prisma.topic.create({
    data: {
      campaignId: campaign.id,
      title: "Reducing signing anxiety",
      summary: "Ambire wants wallet actions to feel understandable and less stressful.",
      status: TopicStatus.ACTIVE,
      priority: 10,
      audience: ["wallet users", "web3 builders"],
      channels: [Channel.X, Channel.LINKEDIN],
      talkingPoints: {
        create: [
          { type: "angle", content: "Good wallet UX reduces decision fatigue instead of hiding everything.", importance: 10 },
          { type: "fact", content: "Ambire focuses on clearer wallet flows and practical self-custody.", importance: 8 },
          { type: "avoid", content: "Do not claim users never need to understand what they sign.", importance: 10 }
        ]
      }
    }
  });

  await prisma.topicRecommendation.upsert({
    where: { userId_topicId: { userId: member.id, topicId: topic.id } },
    update: {},
    create: { userId: member.id, topicId: topic.id, note: "Good fit for a technical-but-accessible post this week." }
  });

  await Promise.all([
    prisma.appSetting.upsert({
      where: { key: "ai_provider" },
      update: {},
      create: { key: "ai_provider", value: "openai" }
    }),
    prisma.appSetting.upsert({
      where: { key: "ai_model" },
      update: {},
      create: { key: "ai_model", value: "gpt-4.1-mini" }
    })
  ]);

  console.log(`Seeded ${personas.length} personas, owner ${owner.email}, and starter campaign/topic.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import OpenAI from "openai";
import { z } from "zod";
import { buildPromptContext } from "@/lib/ai/promptContext";
import type { AiSettings } from "@/lib/ai/settings";
import type { AiWarning, GeneratePostInput, GeneratePostResult } from "@/lib/types";

export interface ContentGenerator {
  generatePostVariants(input: GeneratePostInput): Promise<GeneratePostResult>;
}

const generationSchema = z.object({
  variants: z
    .array(
      z.object({
        content: z.string().min(20),
        angle: z.string().min(2),
        rationale: z.string().min(5)
      })
    )
    .length(2)
});

export class MockContentGenerator implements ContentGenerator {
  async generatePostVariants(input: GeneratePostInput): Promise<GeneratePostResult> {
    const fact =
      input.topic.talkingPoints.find((point) => point.type === "fact")?.content ??
      input.topic.summary;
    const angle =
      input.topic.talkingPoints.find((point) => point.type === "angle")?.content ??
      "Make the topic concrete for the selected audience.";

    const personaLead = {
      "Founder": "The wallets that win will make self-custody feel less like work.",
      "Technical builder": "Good wallet UX is usually a systems problem, not a copywriting problem.",
      "UX advocate": "People trust wallet flows when they can understand what is happening.",
      "Marketer / non-technical": "Better wallet UX starts with fewer moments of confusion.",
      "Balanced team voice": "One thing we keep coming back to at Ambire: wallet UX should feel clearer.",
      "Generic team member": "One thing we keep coming back to at Ambire: wallet UX should feel clearer."
    }[input.persona.name] ?? "Wallet UX gets better when it becomes more specific.";

    const avoidedAngle = input.memory?.usedAngles[0];
    const channelEnding =
      input.channel === "linkedin"
        ? "That is the kind of product detail that makes crypto feel more usable in everyday life."
        : "Small UX details compound fast in self-custody.";
    const secondAngle = avoidedAngle === "Decision fatigue" ? "Security clarity" : "Decision fatigue";
    const userContext = input.additionalContext
      ? ` User context to respect: ${input.additionalContext}`
      : "";
    const linkContext = input.linkContext?.find((link) => link.status === "fetched")?.excerpt;
    const linkDetail = linkContext ? ` Source link context: ${linkContext.slice(0, 240)}` : "";

    return {
      provider: "mock",
      model: "mock-v1",
      promptVersion: "mvp-structured-v1",
      variants: [
        {
          id: crypto.randomUUID(),
          angle: "User clarity",
          rationale: `Uses the ${input.persona.name} persona to connect the topic to a concrete user problem.`,
          content: `${personaLead} ${fact} ${channelEnding}${userContext}${linkDetail}`
        },
        {
          id: crypto.randomUUID(),
          angle: secondAngle,
          rationale: "Uses a distinct argument angle to avoid repeating the same framing.",
          content: `${angle} A useful wallet should help users understand tradeoffs without turning every click into a research task.${userContext}${linkDetail}`
        }
      ]
    };
  }
}

export class OpenAIContentGenerator implements ContentGenerator {
  constructor(private readonly model: string) {}

  async generatePostVariants(input: GeneratePostInput): Promise<GeneratePostResult> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required when AI provider is set to OpenAI.");
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const messages = buildMessages(input);
    const parsed = await this.generateAndParse(client, messages, input);

    return {
      provider: "openai",
      model: this.model,
      promptVersion: "ambire-social-v1",
      variants: parsed.variants.map((variant) => ({
        id: crypto.randomUUID(),
        content: variant.content,
        angle: variant.angle,
        rationale: variant.rationale
      }))
    };
  }

  private async generateAndParse(
    client: OpenAI,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    input: GeneratePostInput
  ) {
    let lastError: unknown;
    const mentionRequirements = extractMentionRequirements(input.additionalContext);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const completion = await client.chat.completions.create({
        model: this.model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages:
          attempt === 0
            ? messages
            : [
                ...messages,
                {
                  role: "user",
                  content: buildRetryInstruction(lastError)
                }
              ]
      });

      const content = completion.choices[0]?.message.content;
      if (!content) {
        lastError = new Error("OpenAI returned an empty response.");
        continue;
      }

      try {
        const parsed = generationSchema.parse(JSON.parse(content));
        const missingRequirements = getMissingMentionRequirements(parsed.variants, mentionRequirements);

        if (missingRequirements.length > 0) {
          lastError = new Error(
            `The response did not visibly include required additional prompt detail: ${missingRequirements.join(", ")}.`
          );
          continue;
        }

        return parsed;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("OpenAI response could not be parsed.");
  }
}

function buildRetryInstruction(lastError: unknown) {
  const reason = lastError instanceof Error ? lastError.message : "The previous response was invalid.";

  return `${reason} Return only valid JSON with exactly two variants. Only exact phrases quoted in the user's additional context are mandatory. Unquoted additional context is semantic guidance and should be reflected naturally unless it conflicts with brand/factual constraints.`;
}

function extractMentionRequirements(additionalContext?: string) {
  if (!additionalContext) {
    return [];
  }

  const requirements: string[] = [];
  const patterns = [
    /\bmention\s+["']([^"']+)["']/gi,
    /\binclude\s+["']([^"']+)["']/gi,
    /\badd\s+["']([^"']+)["']/gi,
    /\buse\s+["']([^"']+)["']/gi
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(additionalContext);
    while (match) {
      const value = match[1]?.trim();
      if (value) {
        requirements.push(normalizeQuotedRequirement(value));
      }
      match = pattern.exec(additionalContext);
    }
  }

  return Array.from(new Set(requirements));
}

function normalizeQuotedRequirement(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function getMissingMentionRequirements(
  variants: Array<{ content: string }>,
  requirements: string[]
) {
  if (requirements.length === 0) {
    return [];
  }

  return requirements.filter((requirement) =>
    variants.some((variant) => !variant.content.toLowerCase().includes(requirement))
  );
}

class FallbackContentGenerator implements ContentGenerator {
  constructor(
    private readonly primary: ContentGenerator,
    private readonly fallback: ContentGenerator,
    private readonly attemptedModel: string
  ) {}

  async generatePostVariants(input: GeneratePostInput): Promise<GeneratePostResult> {
    try {
      return await this.primary.generatePostVariants(input);
    } catch (error) {
      const fallbackResult = await this.fallback.generatePostVariants(input);
      const aiWarning: AiWarning = {
        aiFallback: true,
        attemptedProvider: "openai",
        attemptedModel: this.attemptedModel,
        fallbackProvider: "mock",
        reason: classifyOpenAIError(error)
      };
      return {
        ...fallbackResult,
        provider: "mock-fallback",
        promptVersion: `${fallbackResult.promptVersion}:openai-fallback`,
        aiWarning
      };
    }
  }
}

function classifyOpenAIError(error: unknown) {
  const maybeError = error as {
    status?: number;
    code?: string;
    type?: string;
    message?: string;
    error?: { code?: string; type?: string; message?: string };
  };
  const code = maybeError.code ?? maybeError.error?.code;
  const type = maybeError.type ?? maybeError.error?.type;
  const message = maybeError.message ?? maybeError.error?.message ?? "Unknown OpenAI error.";

  if (code === "insufficient_quota" || type === "insufficient_quota") {
    return "OpenAI quota or billing limit was exceeded.";
  }

  if (maybeError.status === 401 || code === "invalid_api_key") {
    return "OpenAI API key is invalid or unauthorized.";
  }

  if (maybeError.status === 404 || code === "model_not_found") {
    return "Selected OpenAI model is unavailable.";
  }

  if (maybeError.status === 429) {
    return "OpenAI rate limit was reached.";
  }

  return message;
}

function buildMessages(input: GeneratePostInput): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const context = buildPromptContext(input);

  return [
    {
      role: "system",
      content:
        "You are an expert social media strategist for Ambire, a Web3 wallet company. Draft posts for individual team members, not corporate announcements. Be specific, useful, grounded in the supplied context, and avoid generic Web3 hype. Do not invent product facts, metrics, partnerships, security claims, launches, or roadmap commitments. Treat additionalUserContext as a high-priority creative/user instruction unless it directly conflicts with factual, legal, security, or brand-safety constraints. When the user asks to recap or summarize a source link, the fetched source link content is the primary subject and brand/persona context is only styling. Return only valid JSON."
    },
    {
      role: "user",
      content: `Context:\n${JSON.stringify(context, null, 2)}\n\nGenerate exactly two distinct ${
        input.channel === "x" ? "X" : "LinkedIn"
      } single-post variants.\n\nRequirements:\n- Each variant must use a different angle.\n- Avoid used angles and recent saved-post wording.\n- Respect the selected persona, but do not force the persona's favorite theme into unrelated topics.\n- Use referencePosts as pattern guidance: learn from examplesToLearnFrom, avoid patternsToAvoid, but do not copy wording.\n- Use sourceLinks.fetched as factual source material when relevant. Ignore sourceLinks.failed.\n- If sourceLinkTask is \"recap\", make the post a concrete recap of the fetched source. Mention the important named facts, people, talks, product updates, event moments, or takeaways from the source. Do not replace the recap with generic Ambire positioning.\n- If sourceLinkTask is \"recap\", each variant should include at least 4 specific details from sourceLinks.fetched unless the source has fewer.\n- Follow promptQualityControls exactly: avoid banned phrases, prefer preferred phrases only when natural, never make any neverClaim statement, and apply the active channel style rules.\n- For X posts, format each sentence on a new line.\n- additionalUserContext is important. If it is non-empty, incorporate it visibly and naturally in both post variants unless it conflicts with factual, legal, security, or brand-safety constraints. If you must ignore it, explain why in the rationale.\n- Treat unquoted additionalUserContext as semantic guidance, not an exact wording requirement.\n- If additionalUserContext says to mention, include, add, or use an exact phrase inside quotes, that quoted phrase must appear in the content of both variants.\n- Make posts ready to publish with minimal editing.\n- No hashtags unless strongly justified.\n\nReturn JSON only in this exact shape:\n{"variants":[{"content":"string","angle":"string","rationale":"string"},{"content":"string","angle":"string","rationale":"string"}]}`
    }
  ];
}

export function createContentGenerator(settings?: AiSettings): ContentGenerator {
  if (settings?.provider === "openai") {
    return new FallbackContentGenerator(
      new OpenAIContentGenerator(settings.model),
      new MockContentGenerator(),
      settings.model
    );
  }

  return new MockContentGenerator();
}

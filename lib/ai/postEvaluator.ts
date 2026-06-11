import OpenAI from "openai";
import { z } from "zod";
import { buildPromptContext } from "@/lib/ai/promptContext";
import type { AiSettings } from "@/lib/ai/settings";
import type { GeneratePostInput, PostEvaluation } from "@/lib/types";
import type { VariantWithMemory } from "@/lib/ai/memory";

type EvaluatedVariant = VariantWithMemory & {
  memoryCheck: VariantWithMemory["memoryCheck"] & {
    postEvaluation: PostEvaluation;
  };
};

const evaluationSchema = z.object({
  evaluations: z.array(
    z.object({
      variantId: z.string(),
      specificity: z.number().int().min(1).max(5),
      brandFit: z.number().int().min(1).max(5),
      originality: z.number().int().min(1).max(5),
      factualRisk: z.number().int().min(1).max(5),
      repetitionRisk: z.number().int().min(1).max(5),
      warnings: z.array(z.string()).default([])
    })
  )
});

export interface PostEvaluator {
  evaluate(input: GeneratePostInput, variants: VariantWithMemory[]): Promise<EvaluatedVariant[]>;
}

class HeuristicPostEvaluator implements PostEvaluator {
  constructor(
    private readonly provider = "heuristic",
    private readonly model = "heuristic-eval-v1",
    private readonly evaluationWarning?: string
  ) {}

  async evaluate(input: GeneratePostInput, variants: VariantWithMemory[]) {
    const bannedPhrases = input.promptQualityControls?.bannedPhrases ?? [];

    return variants.map((variant) => {
      const warnings: string[] = [];
      const lowerContent = variant.content.toLowerCase();
      const matchedBannedPhrase = bannedPhrases.find((phrase) => lowerContent.includes(phrase.toLowerCase()));

      if (matchedBannedPhrase) {
        warnings.push(`Uses banned phrase: ${matchedBannedPhrase}`);
      }

      if (variant.content.length < 120) {
        warnings.push("May be too thin or under-explained.");
      }

      if (variant.memoryCheck.repeatedAngle) {
        warnings.push("Repeats an angle already used for this context.");
      }

      if (variant.memoryCheck.risk !== "low") {
        warnings.push("Memory check found possible repetition.");
      }

      const postEvaluation: PostEvaluation = {
        provider: this.provider,
        model: this.model,
        specificity: variant.content.length > 180 ? 4 : 3,
        brandFit: matchedBannedPhrase ? 2 : 4,
        originality: variant.memoryCheck.repeatedAngle ? 2 : 4,
        factualRisk: lowerContent.includes("guarantee") || lowerContent.includes("risk-free") ? 4 : 2,
        repetitionRisk:
          variant.memoryCheck.risk === "high" ? 5 : variant.memoryCheck.risk === "medium" ? 3 : 1,
        warnings,
        evaluationWarning: this.evaluationWarning
      };

      return {
        ...variant,
        memoryCheck: {
          ...variant.memoryCheck,
          postEvaluation
        }
      };
    });
  }
}

class OpenAIPostEvaluator implements PostEvaluator {
  constructor(private readonly model: string) {}

  async evaluate(input: GeneratePostInput, variants: VariantWithMemory[]) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for OpenAI post evaluation.");
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a strict social-content QA reviewer for Ambire. Score generated posts against supplied context. Do not reward hype, unsupported claims, or repeated angles. Return only valid JSON."
        },
        {
          role: "user",
          content: `Context:\n${JSON.stringify(buildPromptContext(input), null, 2)}\n\nVariants:\n${JSON.stringify(
            variants.map((variant) => ({
              variantId: variant.id,
              content: variant.content,
              angle: variant.angle,
              memoryCheck: variant.memoryCheck
            })),
            null,
            2
          )}\n\nScore each variant from 1-5.\n- specificity: 1 generic, 5 concrete and useful\n- brandFit: 1 off-brand, 5 strongly aligned\n- originality: 1 repetitive, 5 fresh angle\n- factualRisk: 1 low risk, 5 high risk or unsupported claims\n- repetitionRisk: 1 low risk, 5 high risk\n\nReturn JSON only in this shape:\n{"evaluations":[{"variantId":"string","specificity":1,"brandFit":1,"originality":1,"factualRisk":1,"repetitionRisk":1,"warnings":["string"]}]}`
        }
      ]
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new Error("OpenAI evaluator returned an empty response.");
    }

    const parsed = evaluationSchema.parse(JSON.parse(content));
    const evaluationsById = new Map(parsed.evaluations.map((evaluation) => [evaluation.variantId, evaluation]));

    return variants.map((variant) => {
      const evaluation = evaluationsById.get(variant.id);
      const postEvaluation: PostEvaluation = evaluation
        ? {
            provider: "openai",
            model: this.model,
            specificity: evaluation.specificity,
            brandFit: evaluation.brandFit,
            originality: evaluation.originality,
            factualRisk: evaluation.factualRisk,
            repetitionRisk: evaluation.repetitionRisk,
            warnings: evaluation.warnings
          }
        : {
            provider: "openai",
            model: this.model,
            specificity: 3,
            brandFit: 3,
            originality: 3,
            factualRisk: 3,
            repetitionRisk: 3,
            warnings: ["OpenAI did not return an evaluation for this variant."],
            evaluationWarning: "Missing variant evaluation."
          };

      return {
        ...variant,
        memoryCheck: {
          ...variant.memoryCheck,
          postEvaluation
        }
      };
    });
  }
}

class FallbackPostEvaluator implements PostEvaluator {
  constructor(
    private readonly primary: PostEvaluator,
    private readonly fallback: PostEvaluator
  ) {}

  async evaluate(input: GeneratePostInput, variants: VariantWithMemory[]) {
    try {
      return await this.primary.evaluate(input, variants);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown evaluation error.";
      return new HeuristicPostEvaluator("heuristic-fallback", "heuristic-eval-v1", reason).evaluate(
        input,
        variants
      );
    }
  }
}

export function createPostEvaluator(settings?: AiSettings): PostEvaluator {
  if (settings?.provider === "openai") {
    return new FallbackPostEvaluator(
      new OpenAIPostEvaluator(settings.model),
      new HeuristicPostEvaluator()
    );
  }

  return new HeuristicPostEvaluator();
}

export type AiProvider = "mock" | "openai";

export type AiSettings = {
  provider: AiProvider;
  model: string;
};

export const AI_MODEL_OPTIONS = {
  mock: ["mock-v1"],
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"]
} satisfies Record<AiProvider, string[]>;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "openai",
  model: "gpt-4.1-mini"
};

export function normalizeAiSettings(provider?: string, model?: string): AiSettings {
  const normalizedProvider: AiProvider = provider === "mock" || provider === "openai" ? provider : "openai";
  const models = AI_MODEL_OPTIONS[normalizedProvider];
  const normalizedModel = model && models.includes(model) ? model : models[0];

  return {
    provider: normalizedProvider,
    model: normalizedModel
  };
}

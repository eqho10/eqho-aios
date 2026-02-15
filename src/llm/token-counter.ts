/**
 * Rough token estimation based on character count.
 * Claude tokenization averages around 4 characters per token for English/Turkish text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Known model pricing per million tokens (USD).
 * Input / Output costs.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
};

/**
 * Finds the pricing entry for a given model string.
 * Falls back to sonnet pricing if the model is unknown.
 */
function findPricing(model: string): { input: number; output: number } {
  // Exact match
  if (MODEL_PRICING[model]) {
    return MODEL_PRICING[model];
  }

  // Partial match (e.g. "claude-sonnet-4-5" matching "claude-sonnet-4-5-20250929")
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.includes(key) || key.includes(model)) {
      return pricing;
    }
  }

  // Default to sonnet pricing
  return { input: 3.0, output: 15.0 };
}

/**
 * Formats the estimated cost of an API call in USD.
 */
export function formatCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): string {
  const pricing = findPricing(model);
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  if (totalCost < 0.001) {
    return `$${(totalCost * 100).toFixed(3)} cents`;
  }

  return `$${totalCost.toFixed(4)}`;
}

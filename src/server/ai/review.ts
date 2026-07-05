import { OpenAIProvider } from "./openai";
import { buildReviewPrompt, type ReviewContext } from "./prompt";
import { ReviewResponseSchema, type ReviewResponse } from "./schema";
import { type AIProvider } from "./provider";

export interface GeneratedReviewDTO extends ReviewResponse {
  aiProvider: string;
  modelVersion: string;
  generatedAt: string;
}

export async function generatePullRequestReview(context: ReviewContext): Promise<GeneratedReviewDTO> {
  // 1. Instantiate provider
  const aiProvider: AIProvider = new OpenAIProvider();

  // 2. Build prompt
  const prompt = buildReviewPrompt(context);

  // 3. Generate raw response
  let rawJsonResponse: string;
  try {
    rawJsonResponse = await aiProvider.generateStructuredReview(prompt);
  } catch (error) {
    console.error("AI Provider execution failed:", error);
    throw new Error("Failed to generate AI review from provider.");
  }

  // 4. Parse JSON
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJsonResponse);
  } catch (error) {
    console.error("AI Provider returned invalid JSON:", rawJsonResponse);
    throw new Error("AI returned malformed JSON that could not be parsed.");
  }

  // 5. Validate schema
  const validationResult = ReviewResponseSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    console.error("AI Provider returned JSON that failed schema validation:", validationResult.error);
    throw new Error("AI returned data that did not match the strictly required schema.");
  }

  const validatedReview = validationResult.data;

  return {
    aiProvider: aiProvider.name,
    modelVersion: aiProvider.model,
    summary: validatedReview.summary,
    riskLevel: validatedReview.riskLevel,
    riskReasoning: validatedReview.riskReasoning,
    metadata: validatedReview.metadata ?? {},
    generatedAt: new Date().toISOString(),
  };
}

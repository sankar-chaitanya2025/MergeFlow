import { z } from "zod";

export const ReviewResponseSchema = z.object({
  summary: z.string(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  riskReasoning: z.string(),
  metadata: z.record(z.any()).optional(),
});

export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

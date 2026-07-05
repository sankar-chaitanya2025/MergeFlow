import { env } from "~/env";
import { type AIProvider } from "./provider";

export class OpenAIProvider implements AIProvider {
  name = "openai";
  model = "gpt-4o-mini";

  async generateStructuredReview(prompt: string): Promise<string> {
    const apiKey = env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert staff software engineer. You provide precise, JSON-only code reviews. " +
              "Output strictly valid JSON matching the requested schema. Do NOT wrap the response in markdown code blocks.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API failed: ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message.content ?? "{}";
  }
}

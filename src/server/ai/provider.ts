export interface AIProvider {
  name: string;
  model: string;
  generateStructuredReview(prompt: string): Promise<string>;
}

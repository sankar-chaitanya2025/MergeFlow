export interface ReviewContext {
  repositoryFullName: string;
  pullRequestTitle: string;
  authorUsername: string;
  sourceBranch: string;
  targetBranch: string;
  diff: string;
}

export function buildReviewPrompt(ctx: ReviewContext): string {
  return `
Please review the following Pull Request.

Repository: ${ctx.repositoryFullName}
PR Title: ${ctx.pullRequestTitle}
Author: ${ctx.authorUsername}
Source Branch: ${ctx.sourceBranch}
Target Branch: ${ctx.targetBranch}

Diff:
\`\`\`diff
${ctx.diff}
\`\`\`

Return a JSON object with exactly the following shape:
{
  "summary": "A 2-3 sentence technical summary of what changed and the intent.",
  "riskLevel": "One of: LOW, MEDIUM, HIGH, CRITICAL",
  "riskReasoning": "A 1-2 sentence justification for the chosen risk level.",
  "metadata": { "notes": "any additional AI telemetry or caveats" }
}
`;
}

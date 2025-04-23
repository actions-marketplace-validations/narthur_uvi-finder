import type { FindUVIsOptions } from "./types.js";
import { OpenAIResponseSchema } from "./schemas.js";

const SYSTEM_PROMPT = `You are an expert at identifying user-visible improvements (UVIs) in code changes.
Your task is to analyze the provided code diff and identify ONLY changes that would be directly visible or meaningful to end users.

Include:
- New features that users can see or interact with
- Bug fixes that affect user experience
- UI improvements or changes
- Performance improvements noticeable to users
- User-facing text changes (documentation, error messages, labels)
- Accessibility improvements

Exclude:
- Internal code quality improvements (refactoring, typing)
- Developer experience changes (linting, formatting)
- Build system or CI/CD changes
- Test improvements
- Development tooling updates
- Package updates that don't affect user experience
- Internal documentation changes

Your response should be valid JSON with this exact structure:
{
  "improvements": [
    {
      "description": "Description of the improvement",
      "category": "Optional category of the improvement",
      "impact": "Optional description of the impact"
    }
  ]
}`;

const MAX_CHUNK_SIZE = 4000; // Conservative limit to leave room for prompts

function shouldIncludeFile(filePath: string): boolean {
  // Check for directory exclusions first
  const dirExclusions = ["dist/", "dist-action/", "dist-release/"];
  if (dirExclusions.some((dir) => {
    const relativePath = path.relative(dir, filePath);
    return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
  })) {
  }

  // Then check for file exclusions
  const fileExclusions = [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "Gemfile.lock",
    "poetry.lock",
    "Cargo.lock",
  ];
  return !fileExclusions.some((excluded) => filePath.endsWith(excluded));
}

function chunkDiff(diff: string): string[] {
  // Split by file (each file starts with 'diff --git')
  const files = diff.split(/(?=diff --git )/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const file of files) {
    // Skip excluded files
    const match = file.match(/^diff --git a\/(.*?) b\//);
    if (match && !shouldIncludeFile(match[1])) {
      continue;
    }

    // If adding this file would exceed chunk size, start a new chunk
    if (
      currentChunk.length + file.length > MAX_CHUNK_SIZE &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk);
      currentChunk = file;
    } else {
      currentChunk += file;
    }
  }

  // Add the last chunk if it's not empty
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export async function findUVIs(options: FindUVIsOptions) {
  const { octokit, openai, model, owner, repo } = options;

  // Get the diff either from PR or commit comparison
  let diffText;
  if ("pullNumber" in options) {
    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: options.pullNumber,
      mediaType: {
        format: "diff",
      },
    });
    diffText = JSON.stringify(data);
  } else {
    const { data } = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: options.base,
      head: options.head,
      mediaType: {
        format: "diff",
      },
    });
    diffText = JSON.stringify(data);
  }

  const chunks = chunkDiff(diffText);
  const allImprovements: Array<{
    description: string;
    category?: string;
    impact?: string;
  }> = [];

  // Analyze each chunk
  for (const chunk of chunks) {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Please analyze this diff for user-visible improvements:\n\n${chunk}`,
        },
      ],
      temperature: 0.2,
    });

    // Parse and validate the response
    const content = completion.choices[0]?.message?.content;
    if (!content) continue;

    try {
      const result: unknown = JSON.parse(content);
      const parsed = OpenAIResponseSchema.safeParse(result);

      if (parsed.success) {
        allImprovements.push(...parsed.data.improvements);
      } else {
        console.error("Invalid OpenAI response format:", parsed.error);
      }
    } catch (error) {
      console.error("Failed to parse OpenAI response:", error);
    }
  }

  // Create a map to track seen descriptions and their corresponding improvements
  const seenDescriptions = new Map<
    string,
    { description: string; category?: string; impact?: string }
  >();

  // Process improvements in reverse order to keep the first occurrence
  for (let i = allImprovements.length - 1; i >= 0; i--) {
    const improvement = allImprovements[i];
    seenDescriptions.set(improvement.description, improvement);
  }

  // Convert back to array and sort by description to ensure consistent ordering
  return Array.from(seenDescriptions.values()).sort((a, b) =>
    a.description.localeCompare(b.description)
  );
}

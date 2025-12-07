import { describe, it, expect, vi } from "vitest";
import { findUVIs } from "./uvi-finder.js";

describe("findUVIs", () => {
  it("should return empty array when no improvements found", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({ data: "empty diff" }),
        },
      },
    };

    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({ improvements: [] }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await findUVIs({
      octokit: mockOctokit as any,
      openai: mockOpenAI as any,
      model: "gpt-4",
      owner: "test",
      repo: "test",
      pullNumber: 1,
      base: "base-sha",
      head: "head-sha",
    });

    expect(result).toEqual([]);
  });

  it("should validate and return properly formatted improvements", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({ data: "test diff" }),
        },
      },
    };

    const validImprovement = {
      description: "Added dark mode support",
      category: "UI",
      impact: "Better visibility in low-light conditions",
    };

    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    improvements: [validImprovement],
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await findUVIs({
      octokit: mockOctokit as any,
      openai: mockOpenAI as any,
      model: "gpt-4",
      owner: "test",
      repo: "test",
      pullNumber: 1,
      base: "base-sha",
      head: "head-sha",
    });

    expect(result).toEqual([validImprovement]);
  });

  it("should handle invalid response format", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({ data: "test diff" }),
        },
      },
    };

    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    improvements: [
                      {
                        // Missing required 'description' field
                        category: "UI",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await findUVIs({
      octokit: mockOctokit as any,
      openai: mockOpenAI as any,
      model: "gpt-4",
      owner: "test",
      repo: "test",
      pullNumber: 1,
      base: "base-sha",
      head: "head-sha",
    });

    expect(result).toEqual([]);
  });

  it("should handle large diffs by chunking and deduplicating", async () => {
    // Create a large diff that will be split into chunks
    const file1 = "diff --git a/file1.ts b/file1.ts\n" + "x".repeat(3000);
    const file2 = "diff --git a/file2.ts b/file2.ts\n" + "y".repeat(3000);
    const largeDiff = file1 + file2;

    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({ data: largeDiff }),
        },
      },
    };

    const improvement1 = {
      description: "Added dark mode",
      category: "UI",
    };

    const improvement2 = {
      description: "Improved performance",
      category: "Performance",
    };

    // Same description as improvement1, should be deduplicated
    const improvement3 = {
      description: "Added dark mode",
      category: "UI",
      impact: "Different impact", // Even with different impact, should be deduplicated
    };

    const mockOpenAI = {
      chat: {
        completions: {
          create: vi
            .fn()
            .mockResolvedValueOnce({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      improvements: [improvement1, improvement2],
                    }),
                  },
                },
              ],
            })
            .mockResolvedValueOnce({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      improvements: [improvement3],
                    }),
                  },
                },
              ],
            }),
        },
      },
    };

    const result = await findUVIs({
      octokit: mockOctokit as any,
      openai: mockOpenAI as any,
      model: "gpt-4",
      owner: "test",
      repo: "test",
      pullNumber: 1,
      base: "base-sha",
      head: "head-sha",
    });

    // Should only include unique improvements based on description
    expect(result).toEqual([improvement1, improvement2]);
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("should exclude lock files from analysis", async () => {
    const diff = `diff --git a/package-lock.json b/package-lock.json
... lock file changes ...
diff --git a/src/index.ts b/src/index.ts
... actual code changes ...
diff --git a/yarn.lock b/yarn.lock
... more lock file changes ...`;

    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({ data: diff }),
        },
      },
    };

    const improvement = {
      description: "Added new feature",
      category: "Feature",
    };

    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    improvements: [improvement],
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    await findUVIs({
      octokit: mockOctokit as any,
      openai: mockOpenAI as any,
      model: "gpt-4",
      owner: "test",
      repo: "test",
      pullNumber: 1,
      base: "base-sha",
      head: "head-sha",
    });

    // Should only be called once with the non-lock file changes
    const calls = mockOpenAI.chat.completions.create.mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][0].messages[1].content).not.toContain("package-lock.json");
    expect(calls[0][0].messages[1].content).not.toContain("yarn.lock");
    expect(calls[0][0].messages[1].content).toContain("src/index.ts");
  });

  it("should understand product context from files", async () => {
    const diff = `diff --git a/README.md b/README.md
- A CLI tool for managing databases
+ A CLI tool for managing databases with improved error handling
diff --git a/src/index.ts b/src/index.ts
+ throw new Error("Database connection failed: check your credentials");`;

    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({ data: diff }),
        },
      },
    };

    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    improvements: [
                      {
                        description: "Improved error messages for database connection failures",
                        category: "Error Handling",
                        impact: "Users now receive clearer feedback when connection fails",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await findUVIs({
      octokit: mockOctokit as any,
      openai: mockOpenAI as any,
      model: "gpt-4",
      owner: "test",
      repo: "test",
      pullNumber: 1,
      base: "base-sha",
      head: "head-sha",
    });

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Improved error messages for database connection failures");
    expect(result[0].category).toBe("Error Handling");
    
    // Verify that the model was given context about the product
    const prompt = mockOpenAI.chat.completions.create.mock.calls[0][0].messages[1].content;
    expect(prompt).toContain("A CLI tool for managing databases");
  });

  it("should use product context from README when available", async () => {
    const mockReadme = `# Test Product
A CLI tool for managing databases with advanced features.
## Features
- Easy database creation
- Backup management
- Performance monitoring`;

    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn().mockResolvedValue({
            data: { content: Buffer.from(mockReadme).toString('base64') }
          }),
        },
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: `diff --git a/src/index.ts b/src/index.ts
+ console.log("Backup completed in 2.3s");`
          }),
        },
      },
    };

    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
            // First call for product context
            .mockResolvedValueOnce({
              choices: [
                {
                  message: {
                    content: "A database management tool for users who need to create, backup, and monitor databases.",
                  },
                },
              ],
            })
            // Second call for UVI analysis
            .mockResolvedValueOnce({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      improvements: [
                        {
                          description: "Added backup completion time feedback",
                          category: "User Feedback",
                          impact: "Users can now see how long backups take",
                        },
                      ],
                    }),
                  },
                },
              ],
            }),
        },
      },
    };

    const result = await findUVIs({
      octokit: mockOctokit as any,
      openai: mockOpenAI as any,
      model: "gpt-4",
      owner: "test",
      repo: "test",
      pullNumber: 1,
      base: "base-sha",
      head: "head-sha",
    });

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Added backup completion time feedback");
    
    // Verify that the model was given product context
    const contextCall = mockOpenAI.chat.completions.create.mock.calls[0];
    expect(contextCall[0].messages[0].content).toContain("expert at understanding software products");
    expect(contextCall[0].messages[1].content).toContain("managing databases");

    // Verify that the UVI analysis included the product context
    const analysisCall = mockOpenAI.chat.completions.create.mock.calls[1];
    expect(analysisCall[0].messages[1].content).toContain("Product Context");
  });
});

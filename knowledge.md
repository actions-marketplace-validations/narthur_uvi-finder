# UVI Finder Knowledge

## Project Overview
- GitHub Action to detect user-visible improvements in PRs using OpenAI
- Uses GPT-4 by default for analysis
- Maintains PR comments with findings
- Exposes results as action outputs

## Development Guidelines
- Run `pnpm install` to install dependencies
- Run `pnpm build` to compile and bundle with ncc
- Run `pnpm test` to run tests
- Run `pnpm lint` to check code style

## Important Notes
- The action requires both `github-token` and `openai-api-key` secrets
- Only runs on pull_request events
- OpenAI response must be in JSON format with an `improvements` array
- PR comments are maintained by finding existing comments that start with the header text
- Large diffs are automatically chunked into ~4000 token pieces to stay within model context limits
- Results from multiple chunks are deduplicated by description before returning
- Package lock files (package-lock.json, yarn.lock, etc.) are automatically excluded from analysis
- Version number changes are not considered UVIs, even though they often accompany them
- Project README is analyzed first to understand product context and user needs

## Implementation Details
- Diffs are split by file boundaries to maintain context
- Each chunk is analyzed separately and results are merged
- Duplicate improvements (same description) are removed to prevent redundancy
- Lock files are filtered out before chunking to reduce noise and token usage
- Product context from README helps tailor UVI detection to the specific project

## Build Process
The action is bundled into a single file using @vercel/ncc, which includes all dependencies. This eliminates the need to install dependencies when running the action. The build command uses the `-m` flag to minify the output and reduce bundle size.
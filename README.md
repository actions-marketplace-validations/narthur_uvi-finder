# UVI Finder Action

A GitHub Action that automatically identifies [User-Visible Improvements](https://messymatters.com/uvi) (UVIs) in pull requests and pushes using OpenAI's API. It analyzes the changes to detect improvements that would be visible or meaningful to end users.

## Features

- 🔍 Automatically detects user-visible improvements in PR changes and pushes
- 🤖 Uses OpenAI's API for intelligent analysis
- 🧠 Understands product context from README to provide more relevant results
- 💬 Maintains an up-to-date comment in PRs listing all identified UVIs
- 📊 Exposes UVI count and details as outputs for use in other workflow steps
- 🔄 Updates automatically when changes are pushed
- 📝 Logs all improvements to the Actions run log

## What is a UVI?

A User-Visible Improvement (UVI) is any change that directly impacts the end user experience. This includes:

- New features users can see or interact with
- Bug fixes that affect user experience
- UI improvements or changes
- Performance improvements noticeable to users
- User-facing text changes (documentation, error messages, labels)
- Accessibility improvements

Internal changes like code refactoring, CI improvements, or developer tooling updates are not considered UVIs since they don't directly affect the end user experience.

## Usage

### Pull Request Analysis

```yaml
name: Find UVIs
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  find-uvis:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write  # Required for commenting on PRs
    steps:
      - uses: narthur/uvi-finder@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

### Push Analysis

```yaml
name: Find UVIs
on:
  push:
    branches: [main]

jobs:
  find-uvis:
    runs-on: ubuntu-latest
    steps:
      - uses: narthur/uvi-finder@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | N/A |
| `openai-api-key` | OpenAI API key for analysis | Yes | N/A |
| `model` | OpenAI model to use | No | `gpt-4` |
| `comment-header` | Custom header for PR comment | No | `## User-Visible Improvements` |

## Outputs

| Output | Description |
|--------|-------------|
| `uvi-count` | Number of UVIs found |
| `uvi-list` | JSON array of identified UVIs |

### Example using outputs

```yaml
steps:
  - uses: actions/uvi-finder@v1
    id: uvi
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      openai-api-key: ${{ secrets.OPENAI_API_KEY }}
  
  - name: Use UVI results
    run: |
      echo "Found ${{ steps.uvi.outputs.uvi-count }} improvements"
      echo "Improvements: ${{ steps.uvi.outputs.uvi-list }}"
```

## How It Works

1. **Product Understanding**: The action first analyzes your project's README to understand:
   - What your product does
   - Who your users are
   - How they use your product
   This context helps ensure that identified improvements are relevant to your specific users.

2. **Change Analysis**: Changes are analyzed in chunks to stay within OpenAI's context limits, with each chunk evaluated for:
   - New features and functionality
   - Bug fixes and error handling improvements
   - UI and UX enhancements
   - Performance optimizations
   - Documentation updates

3. **Output**: 
   - Findings are added as PR comments and action outputs

## Action Output

The action logs all identified UVIs and analyzed files to the Actions run log, making them visible directly in the GitHub UI:

```
Analyzing files:
- src/components/Button.tsx
- src/components/Modal.tsx
- src/styles/theme.ts

User-Visible Improvements Found:
1. Added dark mode support for better visibility in low-light conditions
2. Improved error messages for failed API requests
3. Reduced page load time by 30%
```

## PR Comment Format

When run on a pull request, the action also maintains a comment that looks like this:

```markdown
## User-Visible Improvements

This PR contains 3 user-visible improvements:

1. Added dark mode support for better visibility in low-light conditions
2. Improved error messages for failed API requests
3. Reduced page load time by 30%

Last updated: [timestamp]
```

## Limitations

- PR comments require write permissions for pull requests
- Large changes are automatically chunked to stay within OpenAI's context limits
- Only changes that directly affect end users are considered UVIs
- The following files and directories are excluded from analysis:
  - Package lock files (package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb)
  - Other lock files (Gemfile.lock, poetry.lock, Cargo.lock)
  - Build output directories (dist/, dist-action/, dist-release/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
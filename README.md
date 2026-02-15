# EqhoAIOS

**AI-Orchestrated Full-Stack Development Framework**

EqhoAIOS transforms your development workflow with 5 specialized AI agents that work together as an Agile team. Built on Claude API, it follows a two-phase pipeline (Planning + Development) to take your ideas from requirements to reviewed code.

[Turkce README](./README.tr.md)

## Quick Start

```bash
# Install
npm install -g eqho-aios

# Initialize in your project
cd your-project
eqho-aios init

# Create a story
eqho-aios story create "User authentication system" --priority high

# Run the full pipeline
export ANTHROPIC_API_KEY=sk-ant-...
eqho-aios run EQHO-001
```

## How It Works

```
 Your Idea
    |
    v
 [Analyst] --> Requirements & PRD
    |
    v
 [Architect] --> System Design & ADRs
    |
    v
 [Scrum Master] --> Story Files & Task Lists
    |
    v
 [Developer] --> Implementation & Tests
    |
    v
 [QA] --> Review & Verdict
    |
    v
 Done!
```

**Planning Phase:** Analyst → Architect → Scrum Master
**Development Phase:** Scrum Master → Developer → QA

Each agent reads the previous agent's output from the story file, adds its own contribution, and passes context forward.

## Agents

| Agent | Name | Phase | Role |
|-------|------|-------|------|
| `analyst` | Atlas | Planning | Business analysis, PRD, requirements, risk assessment |
| `architect` | Aria | Planning | System architecture, API design, DB schema, ADRs |
| `scrum_master` | River | Both | Story creation, sprint planning, coordination |
| `developer` | Dex | Development | Code implementation, unit tests, refactoring |
| `qa` | Quinn | Development | Code review, security check, acceptance criteria |

## CLI Commands

### Project Management
```bash
eqho-aios init [name]              # Initialize project
eqho-aios status                   # Show project overview
eqho-aios config show              # Display configuration
eqho-aios config set <key> <val>   # Update config value
```

### Stories
```bash
eqho-aios story create <title> [--priority high] [--tags auth,api]
eqho-aios story list [--status planning]
eqho-aios story show EQHO-001
```

### Pipeline
```bash
eqho-aios run EQHO-001                     # Full pipeline
eqho-aios run EQHO-001 --phase planning    # Planning only
eqho-aios run EQHO-001 --phase development # Development only
eqho-aios run EQHO-001 --agent analyst     # Single agent
eqho-aios run EQHO-001 --auto              # Skip confirmations
```

### Agents & Notifications
```bash
eqho-aios agent list                # List all agents
eqho-aios agent show developer      # Agent details
eqho-aios notify "Done!" --telegram # Send notification
```

## Configuration

EqhoAIOS uses `.eqho-aios/config.yaml`:

```yaml
project:
  name: "my-project"
  language: "tr"        # tr | en

llm:
  model: "claude-sonnet-4-5-20250929"
  api_key_env: "ANTHROPIC_API_KEY"
  max_tokens: 8192

agents:
  analyst: { enabled: true }
  architect: { enabled: true }
  developer: { enabled: true }
  qa: { enabled: true }
  scrum_master: { enabled: true }

orchestration:
  auto_approve: false    # Pause between agents for review
  context_window: 3      # Previous agent outputs to include
  max_qa_retries: 2      # Dev retry on QA rejection

integrations:
  telegram:
    enabled: true
    bot_token_env: "TELEGRAM_BOT_TOKEN"
    chat_id: "-100123456789"
  n8n:
    enabled: true
    webhook_url: "https://your-n8n.com/webhook/eqho-aios"
```

## Story Files

Stories live in `docs/stories/` as Markdown with YAML frontmatter:

```markdown
---
id: EQHO-001
title: "User authentication"
status: planning
priority: high
current_agent: analyst
---

# EQHO-001: User Authentication

## Requirements (@analyst output)
## Architecture (@architect output)
## Tasks (@developer checklist)
## QA Report (@qa output)
```

Each agent appends its output to the relevant section. The story file is the single source of truth.

## IDE Integration

`eqho-aios init` generates agent rules for:
- **Claude Code:** `.claude/agents/eqho-*.md`
- **Cursor:** `.cursor/rules/eqho-aios.md`

## Custom Agents

Override any agent by placing a markdown file in `.eqho-aios/agents/`:

```bash
# Custom analyst prompt
cp node_modules/eqho-aios/agents/analyst.md .eqho-aios/agents/analyst.md
# Edit to your needs
```

## Integrations

- **Telegram** - Pipeline notifications via bot
- **n8n** - Webhook events for workflow automation
- **eqhomemory** - Context from past development sessions

## Requirements

- Node.js >= 18
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

## License

MIT

# Minecraft AI Bot

`mineflayer`-based Minecraft bot for a private or self-hosted server.

The project combines three things:

- local fallback behavior so the bot can keep moving even if the LLM is unavailable;
- simple in-game chat commands such as following players, building, and basic survival tasks;
- an optional OpenAI-compatible LLM endpoint for higher-level decisions.

## What It Can Do

- Connect to a Minecraft server with configurable version and auth mode
- Work with `LoginSecurity` using automatic `/login` and `/register`
- Reply to players in chat and react to common commands
- Wander, follow players, look around, jump, and keep itself active
- Run basic early-survival automation:
  - gather wood
  - craft a crafting table
  - craft a pickaxe
  - mine stone
- Build a small starter house from available blocks
- Keep running on a VPS with `systemd`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy the example config:

```bash
cp .env.example .env
```

3. Fill in your `.env`:

```env
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.mpstarsit.ru/v1
LLM_CHAT_COMPLETIONS_PATH=/
LLM_MODEL=gpt_4o

MINECRAFT_HOST=your-server.example.com
MINECRAFT_PORT=25565
MINECRAFT_AUTH=offline
MINECRAFT_VERSION=1.20.1
LOGIN_SECURITY_PASSWORD=

BOT_COUNT=1
BOT_NAME_PREFIX=OneFan
AUTOPLAY_ENABLED=true
```

4. Run checks:

```bash
npm run check
```

5. Start the bot:

```bash
npm start
```

## Chat Commands

The bot understands these in-game commands:

- `иди ко мне`
- `за мной`
- `стой`
- `прыгай`
- `где ты`
- `команды`
- `построй дом`
- `сруби дерево`
- `добудь камень`
- `сделай верстак`
- `сделай кирку`

## Important Environment Variables

- `LLM_API_KEY`: API key for your LLM provider
- `LLM_BASE_URL`: base URL of an OpenAI-compatible API
- `LLM_CHAT_COMPLETIONS_PATH`: generation endpoint path
- `LLM_MODEL`: model name
- `MINECRAFT_HOST`: Minecraft server host
- `MINECRAFT_PORT`: Minecraft server port
- `MINECRAFT_AUTH`: usually `offline` for offline-mode servers
- `MINECRAFT_VERSION`: server version, for example `1.20.1`
- `LOGIN_SECURITY_PASSWORD`: password for `LoginSecurity`, if enabled
- `BOT_COUNT`: number of bots
- `BOT_USERNAMES`: explicit comma-separated usernames
- `AUTOPLAY_ENABLED`: enables default survival automation
- `SURVIVAL_TASK_INTERVAL_MS`: delay between survival tasks

## VPS Deployment

For Ubuntu 24.04 there is a ready installer:

```bash
bash install.sh
```

It will:

- install required system packages
- install Node.js 24
- create the `minecraftbot` system user
- copy the project to `/opt/minecraft-ai-bot`
- install npm dependencies
- register a `systemd` service
- start the service if `.env` is already configured

More details:

- full guide: [docs/vps-ubuntu-24.04.md](docs/vps-ubuntu-24.04.md)
- install script: [install.sh](install.sh)
- systemd template: [deploy/ubuntu/systemd/minecraft-ai-bot.service](deploy/ubuntu/systemd/minecraft-ai-bot.service)

## Project Layout

```text
.
|-- deploy/
|   `-- ubuntu/
|       |-- install.sh
|       `-- systemd/
|           `-- minecraft-ai-bot.service
|-- docs/
|   `-- vps-ubuntu-24.04.md
|-- src/
|   |-- app/
|   |   `-- main.js
|   |-- bot/
|   |   `-- ai-bot.js
|   |-- config/
|   |   `-- index.js
|   |-- services/
|   |   `-- llm/
|   |       `-- llm-client.js
|   |-- storage/
|   |   `-- auth-store.js
|   `-- index.js
|-- .env.example
|-- install.sh
|-- package.json
`-- README.md
```

## Notes

- `.env` is intentionally ignored and is not committed
- for `offline` mode, one bot is usually enough to get started quickly
- for `online-mode`, each bot needs a real account
- if the LLM endpoint fails, the bot can still continue using local fallback behavior

## License

MIT

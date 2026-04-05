# Minecraft AI Bot

[![Node.js](https://img.shields.io/badge/node-20%2B-5fa04e)](https://nodejs.org/)
[![Minecraft](https://img.shields.io/badge/minecraft-1.20.1-3cba54)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

English and Russian README for a `mineflayer`-based Minecraft bot project with chat commands, survival automation, optional LLM decisions, and Ubuntu VPS deployment support.

- [English](#english)
- [Русский](#русский)

## English

### Overview

This repository contains a Minecraft bot built on top of `mineflayer`.

It is designed for private or self-hosted servers and supports:

- automatic movement and fallback behavior
- basic chat interaction with players
- simple survival progression
- optional OpenAI-compatible LLM integration
- Ubuntu 24.04 VPS deployment with `systemd`

### Features

- Connect to a configurable Minecraft server
- Support `offline` auth and `LoginSecurity`
- Reply to chat commands
- Follow players, move around, jump, and report coordinates
- Gather wood, craft a table, craft a pickaxe, and mine stone
- Build a small starter house from available blocks
- Keep running even if the LLM endpoint is down

### Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy the example config:

```bash
cp .env.example .env
```

3. Fill in `.env`:

```env
LLM_API_KEY=your-key
LLM_BASE_URL=https://your-llm-provider.example/v1
LLM_CHAT_COMPLETIONS_PATH=/chat/completions
LLM_MODEL=your-model-id

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

### Chat Commands

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

### Important Environment Variables

- `LLM_API_KEY` - API key for your LLM provider
- `LLM_BASE_URL` - base URL of an OpenAI-compatible API
- `LLM_CHAT_COMPLETIONS_PATH` - generation endpoint path
- `LLM_MODEL` - model name
- `MINECRAFT_HOST` - Minecraft server host
- `MINECRAFT_PORT` - Minecraft server port
- `MINECRAFT_AUTH` - usually `offline` for offline-mode servers
- `MINECRAFT_VERSION` - server version, for example `1.20.1`
- `LOGIN_SECURITY_PASSWORD` - password for `LoginSecurity`, if enabled
- `BOT_COUNT` - number of bots
- `BOT_USERNAMES` - explicit comma-separated usernames
- `AUTOPLAY_ENABLED` - enables default survival automation
- `SURVIVAL_TASK_INTERVAL_MS` - delay between survival tasks

### VPS Deployment

For Ubuntu 24.04 there is a ready installer:

```bash
bash install.sh
```

Useful links:

- VPS guide: [docs/vps-ubuntu-24.04.md](docs/vps-ubuntu-24.04.md)
- install script: [install.sh](install.sh)
- systemd service: [deploy/ubuntu/systemd/minecraft-ai-bot.service](deploy/ubuntu/systemd/minecraft-ai-bot.service)
- troubleshooting: [docs/troubleshooting.md](docs/troubleshooting.md)
- contributing: [CONTRIBUTING.md](CONTRIBUTING.md)

### Project Layout

```text
.
|-- deploy/
|   `-- ubuntu/
|       |-- install.sh
|       `-- systemd/
|           `-- minecraft-ai-bot.service
|-- docs/
|   |-- troubleshooting.md
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
|-- CONTRIBUTING.md
|-- install.sh
|-- LICENSE
|-- package.json
`-- README.md
```

### Notes

- `.env` is ignored on purpose and is not committed
- for `online-mode`, each bot needs a real account
- if the LLM provider returns `5xx`, the bot falls back to local behavior
- this project is best suited for your own server or a server where automation is explicitly allowed

## Русский

### Обзор

Это репозиторий с Minecraft-ботом на базе `mineflayer`.

Проект рассчитан на приватные или собственные серверы и умеет:

- двигаться и не замирать даже без LLM
- реагировать на команды игроков в чате
- выполнять базовые survival-задачи
- подключаться к OpenAI-совместимому LLM API
- запускаться на Ubuntu 24.04 через `systemd`

### Возможности

- Подключение к серверу Minecraft с настраиваемой версией и режимом авторизации
- Поддержка `offline` auth и `LoginSecurity`
- Ответы на чат-команды
- Следование за игроком, передвижение, прыжки, отправка координат
- Срубание дерева, крафт верстака, крафт кирки и добыча камня
- Постройка маленького стартового дома из доступных блоков
- Продолжение работы даже при падении LLM endpoint

### Быстрый старт

1. Установи зависимости:

```bash
npm install
```

2. Скопируй пример конфига:

```bash
cp .env.example .env
```

3. Заполни `.env`:

```env
LLM_API_KEY=your-key
LLM_BASE_URL=https://your-llm-provider.example/v1
LLM_CHAT_COMPLETIONS_PATH=/chat/completions
LLM_MODEL=your-model-id

MINECRAFT_HOST=your-server.example.com
MINECRAFT_PORT=25565
MINECRAFT_AUTH=offline
MINECRAFT_VERSION=1.20.1
LOGIN_SECURITY_PASSWORD=

BOT_COUNT=1
BOT_NAME_PREFIX=OneFan
AUTOPLAY_ENABLED=true
```

4. Прогони проверку:

```bash
npm run check
```

5. Запусти бота:

```bash
npm start
```

### Команды в чате

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

### Важные переменные окружения

- `LLM_API_KEY` - ключ провайдера LLM
- `LLM_BASE_URL` - базовый URL OpenAI-совместимого API
- `LLM_CHAT_COMPLETIONS_PATH` - путь до generation endpoint
- `LLM_MODEL` - имя модели
- `MINECRAFT_HOST` - адрес сервера Minecraft
- `MINECRAFT_PORT` - порт сервера Minecraft
- `MINECRAFT_AUTH` - обычно `offline` для offline-mode серверов
- `MINECRAFT_VERSION` - версия сервера, например `1.20.1`
- `LOGIN_SECURITY_PASSWORD` - пароль для `LoginSecurity`, если плагин включён
- `BOT_COUNT` - число ботов
- `BOT_USERNAMES` - явный список ников через запятую
- `AUTOPLAY_ENABLED` - включает базовую survival-автоматизацию
- `SURVIVAL_TASK_INTERVAL_MS` - интервал между survival-задачами

### Развёртывание на VPS

Для Ubuntu 24.04 есть готовый установщик:

```bash
bash install.sh
```

Полезные ссылки:

- инструкция по VPS: [docs/vps-ubuntu-24.04.md](docs/vps-ubuntu-24.04.md)
- установщик: [install.sh](install.sh)
- `systemd`-сервис: [deploy/ubuntu/systemd/minecraft-ai-bot.service](deploy/ubuntu/systemd/minecraft-ai-bot.service)
- решение типовых проблем: [docs/troubleshooting.md](docs/troubleshooting.md)
- правила вкладов: [CONTRIBUTING.md](CONTRIBUTING.md)

### Структура проекта

```text
.
|-- deploy/
|   `-- ubuntu/
|       |-- install.sh
|       `-- systemd/
|           `-- minecraft-ai-bot.service
|-- docs/
|   |-- troubleshooting.md
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
|-- CONTRIBUTING.md
|-- install.sh
|-- LICENSE
|-- package.json
`-- README.md
```

### Примечания

- `.env` специально исключён из git и не коммитится
- для `online-mode` каждому боту нужен отдельный настоящий аккаунт
- если LLM-провайдер отвечает ошибками `5xx`, бот продолжает работать на локальном fallback-поведении
- проект лучше использовать на своём сервере или там, где автоматизация явно разрешена

## License

MIT. See [LICENSE](LICENSE).

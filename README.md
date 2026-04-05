# Minecraft AI Bot

Бот на `mineflayer` для Minecraft-сервера с двумя слоями поведения:

- локальный autoplay для базового survival-прогресса;
- LLM-решения через совместимый API.

Проект рассчитан на запуск как локально, так и на VPS.

## Структура проекта

```text
.
|-- data/                         # runtime-данные (например auth-state.json)
|-- deploy/
|   `-- ubuntu/
|       `-- systemd/
|           `-- minecraft-ai-bot.service
|-- docs/
|   `-- vps-ubuntu-24.04.md
|-- logs/                         # runtime-логи
|-- src/
|   |-- app/
|   |   `-- main.js              # bootstrap приложения
|   |-- bot/
|   |   `-- ai-bot.js            # логика поведения Minecraft-бота
|   |-- config/
|   |   `-- index.js             # чтение .env и сборка конфигурации
|   |-- services/
|   |   `-- llm/
|   |       `-- llm-client.js    # клиент для LLM API
|   |-- storage/
|   |   `-- auth-store.js        # память о /login и /register
|   `-- index.js                 # entrypoint
|-- .env.example
|-- package.json
`-- README.md
```

## Быстрый старт

1. Установи зависимости:

```bash
npm install
```

2. Скопируй шаблон конфига:

```bash
cp .env.example .env
```

3. Заполни `.env`:

```env
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.mpstarsit.ru/v1
LLM_CHAT_COMPLETIONS_PATH=/chat/completions
LLM_MODEL=gpt_4o
MINECRAFT_HOST=server.onefan.ru
MINECRAFT_PORT=25565
MINECRAFT_AUTH=offline
LOGIN_SECURITY_PASSWORD=your-password
BOT_COUNT=1
AUTOPLAY_ENABLED=true
```

4. Проверь синтаксис:

```bash
npm run check
```

5. Запусти бота:

```bash
npm start
```

## Полезные настройки

- `BOT_COUNT` - число ботов.
- `BOT_NAME_PREFIX` - префикс для автогенерации имён.
- `BOT_USERNAMES` - явный список ников через запятую.
- `LOGIN_SECURITY_PASSWORD` - пароль для `/login` и `/register`.
- `AI_DECISION_INTERVAL_MS` - как часто LLM выбирает действие.
- `AMBIENT_ACTION_INTERVAL_MS` - локальное движение между LLM-решениями.
- `AUTOPLAY_ENABLED` - включает автопрохождение раннего survival.
- `SURVIVAL_TASK_INTERVAL_MS` - интервал между survival-задачами.
- `CHAT_REPLY_COOLDOWN_MS` - защита от слишком частых ответов в чат.
- `LLM_BASE_URL` - базовый URL провайдера LLM.
- `LLM_CHAT_COMPLETIONS_PATH` - путь до generation endpoint.
- `LLM_FAILURE_COOLDOWN_MS` - пауза после серии `5xx` ошибок от API.

## Команды в чате

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

## Установка на VPS

Подробная инструкция лежит в [docs/vps-ubuntu-24.04.md](docs/vps-ubuntu-24.04.md).

Готовый шаблон `systemd`-сервиса лежит в [deploy/ubuntu/systemd/minecraft-ai-bot.service](deploy/ubuntu/systemd/minecraft-ai-bot.service).

Готовый установщик лежит в [install.sh](install.sh). На Ubuntu его можно запускать так:

```bash
bash install.sh
```

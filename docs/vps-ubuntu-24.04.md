# Установка на VPS с Ubuntu 24.04

Инструкция ниже рассчитана на чистую VPS с `Ubuntu 24.04`, запуск через `systemd` и размещение проекта в `/opt/minecraft-ai-bot`.

## Быстрый путь

Если проект уже загружен на сервер, из корня проекта достаточно выполнить:

```bash
bash install.sh
```

Скрипт сам:

- поставит системные пакеты;
- установит Node.js 24;
- создаст пользователя `minecraftbot`;
- разложит проект в `/opt/minecraft-ai-bot`;
- установит зависимости;
- подключит `systemd`;
- запустит сервис, если `.env` уже настроен.

Если в `.env` ещё стоит заглушка вместо `LLM_API_KEY`, скрипт сервис не запустит и подскажет, что нужно дозаполнить.

## 1. Подготовить сервер

Подключись по SSH:

```bash
ssh root@YOUR_SERVER_IP
```

Создай отдельного пользователя для сервиса:

```bash
adduser --disabled-password --gecos "" minecraftbot
usermod -aG sudo minecraftbot
```

Переключись на него:

```bash
su - minecraftbot
```

## 2. Установить Node.js и базовые пакеты

Обнови пакеты:

```bash
sudo apt update
sudo apt upgrade -y
```

Установи базовые утилиты:

```bash
sudo apt install -y curl git ca-certificates build-essential xz-utils
```

Поставь Node.js 24 LTS из официального дистрибутива:

```bash
NODE_TARBALL="$(curl -fsSL https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt | awk '/linux-x64.tar.xz$/ { print $2; exit }')"
curl -fsSLO "https://nodejs.org/dist/latest-v24.x/${NODE_TARBALL}"
tar -xJf "${NODE_TARBALL}"
sudo rm -rf /opt/node-v24
sudo mv "${NODE_TARBALL%.tar.xz}" /opt/node-v24
sudo ln -sf /opt/node-v24/bin/node /usr/local/bin/node
sudo ln -sf /opt/node-v24/bin/npm /usr/local/bin/npm
sudo ln -sf /opt/node-v24/bin/npx /usr/local/bin/npx
```

Проверь версии:

```bash
node -v
npm -v
```

Если хочешь, позже можно заменить это на любой другой удобный способ установки, но для этой инструкции я оставил официальный tarball-метод.

## 3. Перенести проект

Если проект хранится в git:

```bash
sudo mkdir -p /opt/minecraft-ai-bot
sudo chown minecraftbot:minecraftbot /opt/minecraft-ai-bot
git clone YOUR_REPOSITORY_URL /opt/minecraft-ai-bot
cd /opt/minecraft-ai-bot
```

Если переносишь архивом:

```bash
sudo mkdir -p /opt/minecraft-ai-bot
sudo chown minecraftbot:minecraftbot /opt/minecraft-ai-bot
cd /opt/minecraft-ai-bot
```

После копирования файлов установи зависимости:

```bash
npm install
```

## 4. Настроить `.env`

Скопируй шаблон:

```bash
cp .env.example .env
```

Открой:

```bash
nano .env
```

Минимум что нужно заполнить:

```env
LLM_API_KEY=your-real-key
LLM_BASE_URL=https://your-llm-provider.example/v1
LLM_CHAT_COMPLETIONS_PATH=/chat/completions
LLM_MODEL=your-model-id
LLM_PROVIDER_NAME=Custom LLM API

MINECRAFT_HOST=server.onefan.ru
MINECRAFT_PORT=25565
MINECRAFT_AUTH=offline
MINECRAFT_VERSION=1.20.1
LOGIN_SECURITY_PASSWORD=your-loginsecurity-password

BOT_COUNT=1
BOT_NAME_PREFIX=OneFan
AUTOPLAY_ENABLED=true
SURVIVAL_TASK_INTERVAL_MS=25000
```

Если сервер не использует `LoginSecurity`, оставь `LOGIN_SECURITY_PASSWORD=` пустым.

## 5. Проверить проект руками

Прогони быструю проверку:

```bash
npm run check
```

Запусти вручную:

```bash
npm start
```

Если всё работает, останови процесс через `Ctrl+C` и переходи к сервису.

## 6. Подключить `systemd`

Скопируй шаблон сервиса:

```bash
sudo cp deploy/ubuntu/systemd/minecraft-ai-bot.service /etc/systemd/system/minecraft-ai-bot.service
```

Открой его на редактирование:

```bash
sudo nano /etc/systemd/system/minecraft-ai-bot.service
```

Проверь и при необходимости поправь:

- `User=minecraftbot`
- `WorkingDirectory=/opt/minecraft-ai-bot`
- `Environment=NODE_ENV=production`

После этого включи сервис:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now minecraft-ai-bot
```

Проверь статус:

```bash
sudo systemctl status minecraft-ai-bot
```

Посмотреть живые логи:

```bash
journalctl -u minecraft-ai-bot -f
```

## 7. Обновление проекта

Если проект в git:

```bash
cd /opt/minecraft-ai-bot
git pull
npm install
npm run check
sudo systemctl restart minecraft-ai-bot
```

## 8. Полезные команды

Запустить:

```bash
sudo systemctl start minecraft-ai-bot
```

Остановить:

```bash
sudo systemctl stop minecraft-ai-bot
```

Перезапустить:

```bash
sudo systemctl restart minecraft-ai-bot
```

Посмотреть последние 100 строк лога:

```bash
journalctl -u minecraft-ai-bot -n 100 --no-pager
```

## Что учесть

- Для `MINECRAFT_AUTH=offline` обычно достаточно одного ника без Mojang/Microsoft-авторизации.
- Для `online-mode` понадобятся реальные аккаунты на каждого бота.
- Если generation endpoint у твоего LLM-провайдера нестандартный, поменяй `LLM_CHAT_COMPLETIONS_PATH`.
- Runtime-логи проекта дополнительно пишутся в `logs/`, если ты запускаешь бота через shell-редирект.

# Contributing

## English

Thanks for helping improve this project.

### Before you open a PR

- discuss major behavior changes first
- do not commit secrets, tokens, or real `.env` files
- keep changes focused and easy to review
- run `npm run check` before pushing

### Development setup

```bash
npm install
cp .env.example .env
npm run check
npm start
```

### Guidelines

- prefer small, clear commits
- keep runtime behavior safe and predictable
- preserve compatibility with the existing config format
- update docs if commands, env vars, or deployment steps change

## Русский

Спасибо за вклад в проект.

### Перед PR

- крупные изменения поведения лучше сначала обсудить
- не коммить секреты, токены и реальный `.env`
- старайся делать изменения небольшими и понятными для ревью
- перед push запускай `npm run check`

### Локальный запуск

```bash
npm install
cp .env.example .env
npm run check
npm start
```

### Рекомендации

- предпочитай небольшие и понятные коммиты
- сохраняй безопасное и предсказуемое поведение бота
- не ломай текущий формат конфигурации без необходимости
- обновляй документацию, если меняются команды, env-переменные или деплой

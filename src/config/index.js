const dotenv = require('dotenv');

dotenv.config();

function parseIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function parseBoolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function parseListEnv(name) {
  const raw = process.env[name];
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBotUsernames(prefix, count, explicitUsernames) {
  if (explicitUsernames.length > 0) {
    return explicitUsernames.slice(0, count);
  }

  const cleanPrefix = (prefix || 'Bot').replace(/[^a-zA-Z0-9_]/g, '') || 'Bot';
  const maxPrefixLength = 12;
  const shortenedPrefix = cleanPrefix.slice(0, maxPrefixLength);

  return Array.from({ length: count }, (_, index) => {
    const suffix = String(index + 1).padStart(2, '0');
    const base = `${shortenedPrefix}${suffix}`;
    return base.slice(0, 16);
  });
}

const explicitUsernames = parseListEnv('BOT_USERNAMES');
const configuredCount = parseIntEnv('BOT_COUNT', 10);
const botCount = explicitUsernames.length > 0 ? explicitUsernames.length : configuredCount;

function joinUrl(baseUrl, path) {
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

const config = {
  minecraft: {
    host: process.env.MINECRAFT_HOST || 'server.onefan.ru',
    port: parseIntEnv('MINECRAFT_PORT', 25565),
    auth: process.env.MINECRAFT_AUTH || 'offline',
    version: process.env.MINECRAFT_VERSION || false,
    loginSecurityPassword: process.env.LOGIN_SECURITY_PASSWORD || '',
    loginCommandDelayMs: parseIntEnv('LOGIN_SECURITY_COMMAND_DELAY_MS', 3500),
    loginRetryMs: parseIntEnv('LOGIN_SECURITY_RETRY_MS', 25000)
  },
  bots: {
    count: Math.max(1, botCount),
    usernames: getBotUsernames(
      process.env.BOT_NAME_PREFIX || 'OneFan',
      Math.max(1, botCount),
      explicitUsernames
    ),
    spawnIntervalMs: parseIntEnv('SPAWN_INTERVAL_MS', 2500),
    reconnectDelayMs: parseIntEnv('RECONNECT_DELAY_MS', 8000),
    throttleReconnectDelayMs: parseIntEnv('THROTTLE_RECONNECT_DELAY_MS', 25000),
    maxReconnectDelayMs: parseIntEnv('MAX_RECONNECT_DELAY_MS', 120000),
    chatCooldownMs: parseIntEnv('CHAT_COOLDOWN_MS', 45000),
    chatReplyCooldownMs: parseIntEnv('CHAT_REPLY_COOLDOWN_MS', 12000),
    chatGreetingDelayMs: parseIntEnv('CHAT_GREETING_DELAY_MS', 5000),
    decisionIntervalMs: parseIntEnv('AI_DECISION_INTERVAL_MS', 20000),
    ambientActionIntervalMs: parseIntEnv('AMBIENT_ACTION_INTERVAL_MS', 18000),
    autoplayEnabled: parseBoolEnv('AUTOPLAY_ENABLED', true),
    survivalTaskIntervalMs: parseIntEnv('SURVIVAL_TASK_INTERVAL_MS', 25000),
    worldHint: process.env.WORLD_HINT || 'Private sandbox world for testing AI bots.'
  },
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'claude_haiku_4_5',
    baseUrl: process.env.LLM_BASE_URL || 'https://api.mpstarsit.ru/v1',
    chatCompletionsPath: process.env.LLM_CHAT_COMPLETIONS_PATH || '/chat/completions',
    endpoint: joinUrl(
      process.env.LLM_BASE_URL || 'https://api.mpstarsit.ru/v1',
      process.env.LLM_CHAT_COMPLETIONS_PATH || '/chat/completions'
    ),
    minRequestGapMs: parseIntEnv('LLM_MIN_REQUEST_GAP_MS', 15000),
    failureCooldownMs: parseIntEnv('LLM_FAILURE_COOLDOWN_MS', 300000),
    providerName: process.env.LLM_PROVIDER_NAME || 'MPStar API',
    siteUrl: process.env.LLM_SITE_URL || '',
    appName: process.env.LLM_APP_NAME || 'Minecraft AI Bot',
    logPrompts: parseBoolEnv('LOG_PROMPTS', false)
  }
};

function validateConfig() {
  if (!config.llm.apiKey || config.llm.apiKey === 'replace-with-your-api-key') {
    throw new Error(
      'LLM_API_KEY is required. Copy .env.example to .env and paste your provider key there.'
    );
  }

  if (config.minecraft.auth !== 'offline' && config.bots.count > 1) {
    console.warn(
      '[config] Non-offline auth with multiple bots usually requires separate real accounts.'
    );
  }
}

module.exports = {
  config,
  validateConfig
};

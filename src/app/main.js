const { config, validateConfig } = require('../config');
const { LLMClient } = require('../services/llm/llm-client');
const { AIBot } = require('../bot/ai-bot');

async function main() {
  validateConfig();

  const llm = new LLMClient(config.llm);

  console.log(
    `[bootstrap] Starting ${config.bots.count} bots for ${config.minecraft.host}:${config.minecraft.port}`
  );
  console.log(`[bootstrap] Provider: ${config.llm.providerName}`);
  console.log(`[bootstrap] Endpoint: ${config.llm.endpoint}`);
  console.log(`[bootstrap] Model: ${config.llm.model}`);
  console.log(`[bootstrap] Usernames: ${config.bots.usernames.join(', ')}`);

  config.bots.usernames.forEach((username, index) => {
    const bot = new AIBot({
      index,
      username,
      config,
      llmClient: llm
    });

    setTimeout(() => {
      bot.connect();
    }, index * config.bots.spawnIntervalMs);
  });
}

module.exports = {
  main
};

const ALLOWED_ACTIONS = new Set([
  'idle',
  'stroll',
  'look_around',
  'jump',
  'follow_player',
  'go_to_player',
  'go_to_coords',
  'chat',
  'stop'
]);

class LLMClient {
  constructor(config) {
    this.config = config;
    this.queue = Promise.resolve();
    this.lastRequestAt = 0;
    this.consecutiveFailures = 0;
    this.cooldownUntil = 0;
  }

  async decide(payload) {
    if (Date.now() < this.cooldownUntil) {
      const waitSeconds = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
      throw new Error(
        `${this.config.providerName} cooldown active for ${waitSeconds}s after repeated failures`
      );
    }

    return this.enqueue(() => this.performDecisionRequest(payload));
  }

  async enqueue(task) {
    const run = async () => {
      const elapsed = Date.now() - this.lastRequestAt;
      const waitMs = Math.max(0, this.config.minRequestGapMs - elapsed);

      if (waitMs > 0) {
        await sleep(waitMs);
      }

      try {
        const result = await task();
        this.consecutiveFailures = 0;
        return result;
      } catch (error) {
        this.registerFailure(error);
        throw error;
      } finally {
        this.lastRequestAt = Date.now();
      }
    };

    const pending = this.queue.then(run, run);
    this.queue = pending.then(
      () => undefined,
      () => undefined
    );

    return pending;
  }

  async performDecisionRequest(payload) {
    const systemPrompt = [
      'You control one Minecraft bot on a private server.',
      'Respond with a single JSON object and nothing else.',
      'Allowed action values: idle, stroll, look_around, jump, follow_player, go_to_player, go_to_coords, chat, stop.',
      'Prefer non-destructive, social, harmless behavior.',
      'Never ask the bot to use slash commands, grief builds, attack players, spam, or disconnect.',
      'If the situation is unclear, use idle or stroll.',
      'JSON schema:',
      '{"action":"idle|stroll|look_around|jump|follow_player|go_to_player|go_to_coords|chat|stop","reason":"short reason","targetPlayer":"optional player name","x":0,"y":64,"z":0,"say":"optional short chat message"}'
    ].join(' ');

    const userPrompt = JSON.stringify(payload, null, 2);

    if (this.config.logPrompts) {
      console.log(`[${this.config.providerName}] prompt payload:\n${userPrompt}`);
    }

    const headers = {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    };

    if (this.config.siteUrl) {
      headers['HTTP-Referer'] = this.config.siteUrl;
    }

    if (this.config.appName) {
      headers['X-Title'] = this.config.appName;
    }

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.7,
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${this.config.providerName} ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(`${this.config.providerName} returned an empty response.`);
    }

    return normalizeDecision(extractJson(content));
  }

  registerFailure(error) {
    this.consecutiveFailures += 1;

    const statusMatch = String(error?.message || '').match(/\b(\d{3})\b/);
    const statusCode = statusMatch ? Number(statusMatch[1]) : 0;
    const shouldCooldown = this.consecutiveFailures >= 3 && statusCode >= 500;

    if (shouldCooldown) {
      this.cooldownUntil = Date.now() + this.config.failureCooldownMs;
      this.consecutiveFailures = 0;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(raw) {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const match = trimmed.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error(`Model did not return JSON: ${trimmed}`);
    }

    return JSON.parse(match[0]);
  }
}

function sanitizeChatMessage(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const singleLine = value.replace(/\s+/g, ' ').trim();
  if (!singleLine) {
    return undefined;
  }

  const withoutLeadingSlash = singleLine.startsWith('/') ? singleLine.slice(1) : singleLine;
  return withoutLeadingSlash.slice(0, 110);
}

function normalizeDecision(raw) {
  const action = typeof raw?.action === 'string' ? raw.action.trim() : 'idle';
  const safeAction = ALLOWED_ACTIONS.has(action) ? action : 'idle';
  const x = parseNumber(raw?.x);
  const y = parseNumber(raw?.y);
  const z = parseNumber(raw?.z);

  return {
    action: safeAction,
    reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 160) : 'No reason provided',
    targetPlayer:
      typeof raw?.targetPlayer === 'string' && raw.targetPlayer.trim()
        ? raw.targetPlayer.trim()
        : undefined,
    x: Number.isFinite(x) ? x : undefined,
    y: Number.isFinite(y) ? y : undefined,
    z: Number.isFinite(z) ? z : undefined,
    say: sanitizeChatMessage(raw?.say)
  };
}

function parseNumber(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    return Number(value);
  }

  return Number.NaN;
}

module.exports = {
  LLMClient
};

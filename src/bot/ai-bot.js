const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const { getPreferredAuthMode, setPreferredAuthMode } = require('../storage/auth-store');

const { GoalNear, GoalFollow } = goals;

const PERSONAS = [
  'calm scout',
  'curious traveler',
  'helpful follower',
  'quiet observer',
  'restless explorer',
  'friendly lookout',
  'wanderer',
  'guard-like companion',
  'playful jumper',
  'patient navigator'
];

const GREETING_WORDS = ['привет', 'здар', 'здрав', 'ку', 'hello', 'hi', 'hey'];
const WHO_WORDS = ['ты кто', 'кто ты', 'who are you', 'what are you'];
const HOW_ARE_YOU_WORDS = ['как дела', 'как ты', 'how are you', 'how r u'];
const COME_HERE_WORDS = ['ко мне', 'иди ко мне', 'иди сюда', 'come here', 'come to me'];
const FOLLOW_WORDS = ['за мной', 'follow me', 'следуй', 'иди за мной'];
const STOP_WORDS = ['стой', 'стоп', 'остановись', 'stop'];
const JUMP_WORDS = ['прыгай', 'jump'];
const WHERE_WORDS = ['где ты', 'where are you'];
const BYE_WORDS = ['пока', 'bye', 'bb', 'до встречи'];
const HELP_WORDS = ['команды', 'помощь', 'help'];
const BUILD_HOUSE_WORDS = ['построй дом', 'сделай дом', 'build house', 'make house'];
const CHOP_TREE_WORDS = ['сруби дерево', 'добудь дерево', 'chop tree', 'get wood'];
const MINE_STONE_WORDS = ['добудь камень', 'копай камень', 'mine stone', 'get stone'];
const CRAFT_TABLE_WORDS = ['сделай верстак', 'крафт верстак', 'make crafting table'];
const CRAFT_PICKAXE_WORDS = ['сделай кирку', 'крафт кирку', 'make pickaxe'];

const AIR_BLOCKS = new Set(['air', 'cave_air', 'void_air']);
const BLOCK_ITEM_BLACKLIST = [
  'slab',
  'stairs',
  'wall',
  'door',
  'trapdoor',
  'pressure_plate',
  'button',
  'fence',
  'gate',
  'carpet',
  'torch',
  'sign',
  'ladder',
  'pane',
  'bed',
  'bucket',
  'boat',
  'minecart',
  'sapling',
  'flower',
  'leaves',
  'vine',
  'banner',
  'candle',
  'rail',
  'head',
  'skull'
];

const FACE_VECTORS = [
  new Vec3(0, 1, 0),
  new Vec3(0, -1, 0),
  new Vec3(1, 0, 0),
  new Vec3(-1, 0, 0),
  new Vec3(0, 0, 1),
  new Vec3(0, 0, -1)
];

function containsAny(text, fragments) {
  return fragments.some((fragment) => text.includes(fragment));
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(digits));
}

function distanceBetween(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }

  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

class AIBot {
  constructor({ index, username, config, llmClient }) {
    this.index = index;
    this.username = username;
    this.config = config;
    this.llmClient = llmClient;
    this.persona = PERSONAS[index % PERSONAS.length];
    this.bot = null;
    this.movements = null;
    this.recentChat = [];
    this.lastAction = 'idle';
    this.lastActionReason = 'Not started yet';
    this.lastChatAt = 0;
    this.startedAt = Date.now();
    this.reconnectTimer = null;
    this.decisionTimer = null;
    this.isThinking = false;
    this.reconnectAttempts = 0;
    this.lastKickReason = '';
    this.authenticated = false;
    this.authTimer = null;
    this.lastAuthCommandAt = 0;
    this.authMode = getPreferredAuthMode(username);
    this.ambientTimer = null;
    this.greetingTimer = null;
    this.survivalTimer = null;
    this.activeTask = null;
  }

  connect() {
    this.clearTimers();
    this.authenticated = false;
    this.lastKickReason = '';
    this.authMode = getPreferredAuthMode(this.username);
    this.log('connecting...');

    this.bot = mineflayer.createBot({
      host: this.config.minecraft.host,
      port: this.config.minecraft.port,
      username: this.username,
      auth: this.config.minecraft.auth,
      version: this.config.minecraft.version || false
    });

    this.bot.loadPlugin(pathfinder);
    this.attachEvents();
  }

  attachEvents() {
    this.bot.on('login', () => {
      this.log('logged in');
    });

    this.bot.once('spawn', () => {
      this.configureMovements();
      this.reconnectAttempts = 0;
      this.lastKickReason = '';
      this.authenticated = false;
      this.activeTask = null;
      this.log('spawned');
      this.scheduleAuthCommand(this.config.minecraft.loginCommandDelayMs);
      this.scheduleAmbientAction(5000 + Math.floor(Math.random() * 5000));
      this.scheduleNextDecision(4000 + Math.floor(Math.random() * 4000) + this.index * 1200);
    });

    this.bot.on('chat', (username, message) => {
      if (username === this.username) {
        return;
      }

      this.pushChat(`${username}: ${message}`);
      void this.handleIncomingChat(username, message, false);
    });

    this.bot.on('whisper', (username, message) => {
      if (username === this.username) {
        return;
      }

      this.pushChat(`[whisper] ${username}: ${message}`);
      void this.handleIncomingChat(username, message, true);
    });

    this.bot.on('messagestr', (message) => {
      this.handleSystemMessage(message);
    });

    this.bot.on('kicked', (reason) => {
      const printableReason =
        typeof reason === 'string' ? reason : JSON.stringify(reason, null, 2);
      this.lastKickReason = printableReason;
      this.log(`kicked: ${printableReason}`);
    });

    this.bot.on('end', () => {
      this.log('disconnected, scheduling reconnect');
      this.scheduleReconnect(this.lastKickReason);
    });

    this.bot.on('error', (error) => {
      this.log(`error: ${error.message}`);
    });
  }

  configureMovements() {
    this.movements = new Movements(this.bot);
    this.movements.canDig = false;
    this.movements.allow1by1towers = false;
    this.bot.pathfinder.setMovements(this.movements);
  }

  clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.decisionTimer) {
      clearTimeout(this.decisionTimer);
      this.decisionTimer = null;
    }

    if (this.authTimer) {
      clearTimeout(this.authTimer);
      this.authTimer = null;
    }

    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }

    if (this.greetingTimer) {
      clearTimeout(this.greetingTimer);
      this.greetingTimer = null;
    }

    if (this.survivalTimer) {
      clearTimeout(this.survivalTimer);
      this.survivalTimer = null;
    }
  }

  scheduleReconnect(reason = '') {
    this.clearTimers();
    this.reconnectAttempts += 1;

    const throttled = /connection throttled/i.test(reason);
    const baseDelay = throttled
      ? Math.max(this.config.bots.reconnectDelayMs, this.config.bots.throttleReconnectDelayMs)
      : this.config.bots.reconnectDelayMs;
    const scaledDelay = Math.min(
      baseDelay * this.reconnectAttempts,
      this.config.bots.maxReconnectDelayMs
    );
    const jitter = Math.floor(Math.random() * 5000);
    const finalDelay = scaledDelay + jitter;

    this.log(`reconnect in ${finalDelay}ms`);
    this.reconnectTimer = setTimeout(() => this.connect(), finalDelay);
  }

  scheduleNextDecision(delay = this.config.bots.decisionIntervalMs) {
    if (this.decisionTimer) {
      clearTimeout(this.decisionTimer);
    }

    this.decisionTimer = setTimeout(async () => {
      try {
        await this.makeDecision();
      } finally {
        const jitter = Math.floor(Math.random() * 5000);
        this.scheduleNextDecision(this.config.bots.decisionIntervalMs + jitter);
      }
    }, delay);
  }

  pushChat(message) {
    this.recentChat.push({
      at: new Date().toISOString(),
      message
    });

    if (this.recentChat.length > 10) {
      this.recentChat.shift();
    }
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] [${this.username}] ${message}`);
  }

  handleSystemMessage(message) {
    if (typeof message !== 'string') {
      return;
    }

    const normalized = message.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized) {
      return;
    }

    if (this.isAuthSuccessMessage(normalized)) {
      if (!this.authenticated) {
        this.authenticated = true;
        this.authMode = 'login';
        setPreferredAuthMode(this.username, 'login');
        this.log('authenticated');
        this.log('ambient=stroll reason="post-auth movement"');
        this.walkRandomly(8, 16);
        this.scheduleAmbientAction(1500 + Math.floor(Math.random() * 2000));
        this.scheduleSurvivalTask(8000 + Math.floor(Math.random() * 3000));
        this.scheduleGreeting();
      }
      return;
    }

    if (!this.config.minecraft.loginSecurityPassword) {
      return;
    }

    if (this.isRegisterPrompt(normalized)) {
      this.authMode = 'register';
      this.sendRegisterCommand();
      return;
    }

    if (this.isLoginPrompt(normalized)) {
      this.sendLoginCommand();
    }
  }

  isRegisterPrompt(message) {
    return (
      (message.includes('register') || message.includes('зарегистр')) &&
      !message.includes('success')
    );
  }

  isLoginPrompt(message) {
    return (
      message.includes('login') ||
      message.includes('log in') ||
      message.includes('авториз') ||
      message.includes('войд') ||
      message.includes('authenticate')
    );
  }

  isAuthSuccessMessage(message) {
    return (
      message.includes('logged in') ||
      message.includes('successfully logged') ||
      message.includes('successfully register') ||
      message.includes('registered successfully') ||
      message.includes('you are now logged') ||
      message.includes('успешно вош') ||
      message.includes('успешно зарегистр') ||
      message.includes('авторизац')
    );
  }

  scheduleAuthCommand(delay) {
    if (!this.config.minecraft.loginSecurityPassword) {
      return;
    }

    if (this.authTimer) {
      clearTimeout(this.authTimer);
    }

    this.authTimer = setTimeout(() => {
      if (!this.authenticated) {
        if (this.authMode === 'register') {
          this.sendRegisterCommand();
          return;
        }

        this.sendLoginCommand();
      }
    }, delay);
  }

  canSendAuthCommand() {
    return Date.now() - this.lastAuthCommandAt > 2500;
  }

  sendLoginCommand() {
    if (!this.config.minecraft.loginSecurityPassword || !this.canSendAuthCommand()) {
      return;
    }

    this.lastAuthCommandAt = Date.now();
    this.log('sending /login');
    this.bot.chat(`/login ${this.config.minecraft.loginSecurityPassword}`);
    this.scheduleAuthCommand(this.config.minecraft.loginRetryMs);
  }

  sendRegisterCommand() {
    if (!this.config.minecraft.loginSecurityPassword || !this.canSendAuthCommand()) {
      return;
    }

    this.lastAuthCommandAt = Date.now();
    this.log('sending /register');
    this.bot.chat(
      `/register ${this.config.minecraft.loginSecurityPassword} ${this.config.minecraft.loginSecurityPassword}`
    );
    this.authMode = 'login';
    setPreferredAuthMode(this.username, 'login');
    this.scheduleAuthCommand(5000);
  }

  scheduleGreeting() {
    if (this.greetingTimer) {
      clearTimeout(this.greetingTimer);
    }

    this.greetingTimer = setTimeout(() => {
      this.say('всем привет, я в игре.', { minGapMs: 0 });
    }, this.config.bots.chatGreetingDelayMs);
  }

  scheduleSurvivalTask(delay = this.config.bots.survivalTaskIntervalMs) {
    if (!this.config.bots.autoplayEnabled) {
      return;
    }

    if (this.survivalTimer) {
      clearTimeout(this.survivalTimer);
    }

    this.survivalTimer = setTimeout(async () => {
      try {
        await this.runSurvivalTask();
      } finally {
        const jitter = Math.floor(Math.random() * 5000);
        this.scheduleSurvivalTask(this.config.bots.survivalTaskIntervalMs + jitter);
      }
    }, delay);
  }

  async runSurvivalTask() {
    if (!this.config.bots.autoplayEnabled || !this.authenticated || !this.bot?.entity) {
      return;
    }

    if (this.activeTask || this.isThinking) {
      return;
    }

    const task = this.chooseDefaultTask();
    if (!task) {
      return;
    }

    this.log(`survival_task=${task}`);

    switch (task) {
      case 'gather_wood':
        await this.startGatherWood('авторежим', true);
        return;
      case 'craft_table':
        await this.startCraftCraftingTable('авторежим', true);
        return;
      case 'craft_pickaxe':
        await this.startCraftPickaxe('авторежим', true);
        return;
      case 'mine_stone':
        await this.startMineStone('авторежим', true);
        return;
      default:
        break;
    }
  }

  chooseDefaultTask() {
    const woodCount = this.countItems((name) => this.isLogName(name));
    const plankCount = this.countItems((name) => name.includes('planks'));
    const stickCount = this.countItem('stick');
    const craftingTableCount = this.countItem('crafting_table');
    const woodenPickaxeCount = this.countItem('wooden_pickaxe');
    const stonePickaxeCount = this.countItem('stone_pickaxe');
    const cobblestoneCount = this.countItems((name) =>
      ['cobblestone', 'cobbled_deepslate', 'blackstone'].includes(name)
    );

    if (woodCount + plankCount < 8) {
      return 'gather_wood';
    }

    if (craftingTableCount === 0 && plankCount >= 4) {
      return 'craft_table';
    }

    if ((woodenPickaxeCount + stonePickaxeCount) === 0 && (plankCount >= 3 || woodCount > 0)) {
      return 'craft_pickaxe';
    }

    if (cobblestoneCount < 8 && (woodenPickaxeCount > 0 || stonePickaxeCount > 0)) {
      return 'mine_stone';
    }

    if (stonePickaxeCount === 0 && cobblestoneCount >= 3 && stickCount >= 2) {
      return 'craft_pickaxe';
    }

    return null;
  }

  async handleIncomingChat(username, message, isWhisper) {
    if (!this.authenticated || !this.bot?.entity) {
      return;
    }

    if (!message || message.startsWith('/')) {
      return;
    }

    const normalized = message.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized) {
      return;
    }

    const mentioned = normalized.includes(this.username.toLowerCase()) || isWhisper;
    const addressed = mentioned || this.config.bots.count === 1;
    const response = this.buildRuleBasedChatResponse(username, normalized, addressed, isWhisper);

    if (!response) {
      return;
    }

    if (response.action === 'build_house') {
      await this.startBuildHouse(username);
      return;
    }

    if (response.action === 'gather_wood') {
      await this.startGatherWood(username);
      return;
    }

    if (response.action === 'mine_stone') {
      await this.startMineStone(username);
      return;
    }

    if (response.action === 'craft_table') {
      await this.startCraftCraftingTable(username);
      return;
    }

    if (response.action === 'craft_pickaxe') {
      await this.startCraftPickaxe(username);
      return;
    }

    if (response.action === 'go_to_player') {
      this.goToPlayer(username);
    }

    if (response.action === 'follow_player') {
      this.followPlayer(username);
    }

    if (response.action === 'stop') {
      this.stopMoving();
    }

    if (response.action === 'jump') {
      await this.jump();
    }

    if (response.say) {
      this.say(response.say, { minGapMs: this.config.bots.chatReplyCooldownMs });
    }
  }

  buildRuleBasedChatResponse(username, normalized, addressed, isWhisper) {
    const position = this.bot?.entity?.position;

    if (containsAny(normalized, GREETING_WORDS) && (addressed || Math.random() < 0.65)) {
      return {
        say: pickRandom([
          `${username}, привет!`,
          `привет, ${username}.`,
          `${username}, ку, я тут.`
        ])
      };
    }

    if (containsAny(normalized, WHO_WORDS) && addressed) {
      return {
        say: `${username}, я ${this.username}, игровой бот.`
      };
    }

    if (containsAny(normalized, HELP_WORDS) && addressed) {
      return {
        say: `${username}, команды: иди ко мне, за мной, стой, прыгай, где ты, построй дом, сруби дерево, добудь камень, сделай верстак, сделай кирку.`
      };
    }

    if (containsAny(normalized, HOW_ARE_YOU_WORDS) && addressed) {
      return {
        say: pickRandom([
          `${username}, нормально, гуляю по серверу.`,
          `всё ок, ${username}, бегаю рядом.`,
          `${username}, отлично, наблюдаю за миром.`
        ])
      };
    }

    if (containsAny(normalized, COME_HERE_WORDS) && addressed) {
      return {
        say: `${username}, иду к тебе.`,
        action: 'go_to_player'
      };
    }

    if (containsAny(normalized, FOLLOW_WORDS) && addressed) {
      return {
        say: `${username}, хорошо, иду за тобой.`,
        action: 'follow_player'
      };
    }

    if (containsAny(normalized, STOP_WORDS) && addressed) {
      return {
        say: `${username}, ок, стою.`,
        action: 'stop'
      };
    }

    if (containsAny(normalized, JUMP_WORDS) && addressed) {
      return {
        say: `${username}, прыгаю.`,
        action: 'jump'
      };
    }

    if (containsAny(normalized, BUILD_HOUSE_WORDS) && addressed) {
      return {
        action: 'build_house'
      };
    }

    if (containsAny(normalized, CHOP_TREE_WORDS) && addressed) {
      return {
        action: 'gather_wood'
      };
    }

    if (containsAny(normalized, MINE_STONE_WORDS) && addressed) {
      return {
        action: 'mine_stone'
      };
    }

    if (containsAny(normalized, CRAFT_TABLE_WORDS) && addressed) {
      return {
        action: 'craft_table'
      };
    }

    if (containsAny(normalized, CRAFT_PICKAXE_WORDS) && addressed) {
      return {
        action: 'craft_pickaxe'
      };
    }

    if (containsAny(normalized, WHERE_WORDS) && addressed && position) {
      return {
        say: `${username}, я примерно на ${Math.floor(position.x)} ${Math.floor(position.y)} ${Math.floor(position.z)}.`
      };
    }

    if (containsAny(normalized, BYE_WORDS) && (addressed || isWhisper)) {
      return {
        say: pickRandom([
          `пока, ${username}.`,
          `до встречи, ${username}.`,
          `${username}, увидимся.`
        ])
      };
    }

    if (addressed && normalized.includes('?')) {
      return {
        say: pickRandom([
          `${username}, я пока отвечаю простыми фразами, но стараюсь помочь.`,
          `если что, ${username}, могу подойти, идти за тобой, остановиться, строить дом, добывать дерево и камень.`,
          `${username}, напиши мне: иди ко мне, за мной, стой, прыгай, построй дом, сруби дерево или добудь камень.`
        ])
      };
    }

    return null;
  }

  scheduleAmbientAction(delay = this.config.bots.ambientActionIntervalMs) {
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
    }

    this.ambientTimer = setTimeout(async () => {
      try {
        await this.runAmbientAction();
      } finally {
        const jitter = Math.floor(Math.random() * 5000);
        this.scheduleAmbientAction(this.config.bots.ambientActionIntervalMs + jitter);
      }
    }, delay);
  }

  async runAmbientAction() {
    if (!this.bot?.entity || !this.authenticated || this.isThinking || this.activeTask) {
      return;
    }

    if (
      this.bot.pathfinder &&
      typeof this.bot.pathfinder.isMoving === 'function' &&
      this.bot.pathfinder.isMoving()
    ) {
      return;
    }

    const roll = Math.random();

    if (roll < 0.85) {
      this.log('ambient=stroll reason="keep bot moving"');
      this.walkRandomly(7, 14);
      return;
    }

    if (roll < 0.95) {
      this.log('ambient=look_around reason="scan surroundings"');
      await this.lookAround();
      return;
    }

    this.log('ambient=jump reason="unstick or add motion"');
    await this.jump();
  }

  collectObservation() {
    const botEntity = this.bot?.entity;
    const position = botEntity?.position;

    const nearbyPlayers = Object.values(this.bot.players)
      .filter((player) => player.entity && player.username !== this.username)
      .map((player) => ({
        username: player.username,
        distance: roundNumber(distanceBetween(position, player.entity.position)),
        position: {
          x: roundNumber(player.entity.position.x),
          y: roundNumber(player.entity.position.y),
          z: roundNumber(player.entity.position.z)
        }
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 6);

    const nearbyEntities = Object.values(this.bot.entities)
      .filter((entity) => entity.position && entity.id !== botEntity?.id)
      .map((entity) => ({
        type: entity.type,
        name: entity.name || entity.displayName || 'unknown',
        distance: roundNumber(distanceBetween(position, entity.position)),
        position: {
          x: roundNumber(entity.position.x),
          y: roundNumber(entity.position.y),
          z: roundNumber(entity.position.z)
        }
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 8);

    return {
      botName: this.username,
      persona: this.persona,
      worldHint: this.config.bots.worldHint,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      health: this.bot.health,
      food: this.bot.food,
      oxygenLevel: this.bot.oxygenLevel,
      position: position
        ? {
            x: roundNumber(position.x),
            y: roundNumber(position.y),
            z: roundNumber(position.z)
          }
        : null,
      timeOfDay: this.bot.time?.timeOfDay ?? null,
      isRaining: this.bot.isRaining,
      heldItem: this.bot.heldItem?.name || null,
      nearbyPlayers,
      nearbyEntities,
      recentChat: this.recentChat,
      lastAction: this.lastAction,
      lastActionReason: this.lastActionReason
    };
  }

  async makeDecision() {
    if (!this.bot?.entity || this.isThinking || this.activeTask) {
      if (!this.authenticated && this.config.minecraft.loginSecurityPassword) {
        this.scheduleAuthCommand(1000);
      }
      return;
    }

    this.isThinking = true;

    try {
      const decision = await this.llmClient.decide(this.collectObservation());
      await this.executeDecision(decision);
    } catch (error) {
      this.log(`decision failed: ${error.message}`);
      await this.executeDecision(this.getFallbackDecision());
    } finally {
      this.isThinking = false;
    }
  }

  getFallbackDecision() {
    if (this.activeTask) {
      return {
        action: 'idle',
        reason: 'Task in progress'
      };
    }

    const nearestPlayer = this.findPlayer();

    if (nearestPlayer?.entity) {
      const distance = distanceBetween(this.bot.entity.position, nearestPlayer.entity.position);
      if (distance > 3 && distance < 24) {
        return {
          action: 'follow_player',
          targetPlayer: nearestPlayer.username,
          reason: 'Fallback follow while model is unavailable'
        };
      }
    }

    const roll = Math.random();

    if (roll < 0.55) {
      return {
        action: 'stroll',
        reason: 'Fallback stroll while model is unavailable'
      };
    }

    if (roll < 0.85) {
      return {
        action: 'look_around',
        reason: 'Fallback look around while model is unavailable'
      };
    }

    return {
      action: 'jump',
      reason: 'Fallback jump while model is unavailable'
    };
  }

  async executeDecision(decision) {
    this.lastAction = decision.action;
    this.lastActionReason = decision.reason;
    this.log(`action=${decision.action} reason="${decision.reason}"`);

    switch (decision.action) {
      case 'idle':
      case 'stop':
        this.stopMoving();
        return;

      case 'stroll':
        this.walkRandomly();
        return;

      case 'look_around':
        await this.lookAround();
        return;

      case 'jump':
        await this.jump();
        return;

      case 'follow_player':
        this.followPlayer(decision.targetPlayer);
        return;

      case 'go_to_player':
        this.goToPlayer(decision.targetPlayer);
        return;

      case 'go_to_coords':
        this.goToCoords(decision);
        return;

      case 'chat':
        this.say(decision.say);
        this.scheduleAmbientAction(2000 + Math.floor(Math.random() * 2000));
        return;

      default:
        this.stopMoving();
    }
  }

  stopMoving() {
    if (!this.bot) {
      return;
    }

    this.bot.pathfinder.setGoal(null);
    if (typeof this.bot.clearControlStates === 'function') {
      this.bot.clearControlStates();
    }
  }

  walkRandomly(minRadius = 4, maxRadius = 9) {
    const position = this.bot?.entity?.position;
    if (!position) {
      return;
    }

    const radius = minRadius + Math.floor(Math.random() * Math.max(1, maxRadius - minRadius + 1));
    const offsetX = Math.floor((Math.random() - 0.5) * radius * 2);
    const offsetZ = Math.floor((Math.random() - 0.5) * radius * 2);
    const targetX = Math.floor(position.x + offsetX);
    const targetY = Math.floor(position.y);
    const targetZ = Math.floor(position.z + offsetZ);

    this.bot.pathfinder.setGoal(new GoalNear(targetX, targetY, targetZ, 1));
  }

  async lookAround() {
    const targets = Object.values(this.bot.entities)
      .filter((entity) => entity.position && entity.id !== this.bot.entity.id)
      .sort(
        (left, right) =>
          distanceBetween(this.bot.entity.position, left.position) -
          distanceBetween(this.bot.entity.position, right.position)
      );

    if (targets.length > 0) {
      const target = targets[0];
      await this.bot.lookAt(target.position.offset(0, 1.2, 0), true);
      return;
    }

    const yaw = (Math.random() * Math.PI * 2) - Math.PI;
    const pitch = (Math.random() * 0.6) - 0.3;
    await this.bot.look(yaw, pitch, true);
  }

  async jump() {
    this.stopMoving();
    this.bot.setControlState('jump', true);
    await sleep(350);
    this.bot.setControlState('jump', false);
  }

  findPlayer(playerName) {
    const players = Object.values(this.bot.players).filter(
      (player) => player.entity && player.username !== this.username
    );

    if (playerName) {
      const exact = players.find(
        (player) => player.username.toLowerCase() === playerName.toLowerCase()
      );
      if (exact) {
        return exact;
      }
    }

    return players.sort(
      (left, right) =>
        distanceBetween(this.bot.entity.position, left.entity.position) -
        distanceBetween(this.bot.entity.position, right.entity.position)
    )[0];
  }

  followPlayer(playerName) {
    const player = this.findPlayer(playerName);
    if (!player?.entity) {
      this.walkRandomly();
      return;
    }

    this.bot.pathfinder.setGoal(new GoalFollow(player.entity, 2), true);
  }

  goToPlayer(playerName) {
    const player = this.findPlayer(playerName);
    if (!player?.entity) {
      this.walkRandomly();
      return;
    }

    const target = player.entity.position;
    this.bot.pathfinder.setGoal(
      new GoalNear(Math.floor(target.x), Math.floor(target.y), Math.floor(target.z), 1)
    );
  }

  goToCoords(decision) {
    if (!Number.isFinite(decision.x) || !Number.isFinite(decision.z)) {
      this.walkRandomly();
      return;
    }

    const y = Number.isFinite(decision.y)
      ? decision.y
      : Math.floor(this.bot.entity.position.y);

    this.bot.pathfinder.setGoal(
      new GoalNear(Math.floor(decision.x), Math.floor(y), Math.floor(decision.z), 1)
    );
  }

  countItem(itemName) {
    return this.bot.inventory
      .items()
      .filter((item) => item.name === itemName)
      .reduce((sum, item) => sum + item.count, 0);
  }

  countItems(predicate) {
    return this.bot.inventory
      .items()
      .filter((item) => predicate(item.name))
      .reduce((sum, item) => sum + item.count, 0);
  }

  isLogName(name) {
    return name.endsWith('_log') || name.endsWith('_stem') || name === 'bamboo_block';
  }

  hasAdjacentAir(position) {
    return FACE_VECTORS.some((face) => {
      const block = this.bot.blockAt(position.plus(face));
      return this.isAirLike(block);
    });
  }

  findNearestBlock(matchFn, maxDistance = 24) {
    return this.bot.findBlock({
      matching: (block) => matchFn(block),
      maxDistance,
      useExtraInfo: true
    });
  }

  async startTask(taskName, username, taskFn, silent = false) {
    if (this.activeTask) {
      if (!silent) {
        this.say(`${username}, я сейчас занят задачей ${this.activeTask}.`, {
          minGapMs: this.config.bots.chatReplyCooldownMs
        });
      }
      return;
    }

    this.activeTask = taskName;

    try {
      const resultMessage = await taskFn();
      if (resultMessage && !silent) {
        this.say(resultMessage, { minGapMs: 0 });
      }
    } catch (error) {
      this.log(`${taskName} failed: ${error.message}`);
      if (!silent) {
        this.say(`${username}, не смог выполнить ${taskName}: ${error.message}`, { minGapMs: 0 });
      }
    } finally {
      this.activeTask = null;
      this.scheduleAmbientAction(3000);
    }
  }

  async startGatherWood(username, silent = false) {
    return this.startTask('gather_wood', username, async () => {
      if (!silent) {
        this.say(`${username}, иду добывать дерево.`, { minGapMs: 0 });
      }
      return this.gatherWood(username);
    }, silent);
  }

  async startMineStone(username, silent = false) {
    return this.startTask('mine_stone', username, async () => {
      if (!silent) {
        this.say(`${username}, иду добывать камень.`, { minGapMs: 0 });
      }
      return this.mineStone(username);
    }, silent);
  }

  async startCraftCraftingTable(username, silent = false) {
    return this.startTask('craft_table', username, async () => {
      return this.craftCraftingTable(username);
    }, silent);
  }

  async startCraftPickaxe(username, silent = false) {
    return this.startTask('craft_pickaxe', username, async () => {
      return this.craftPickaxe(username);
    }, silent);
  }

  findInventoryItemByName(name) {
    return this.bot.inventory.items().find((item) => item.name === name) || null;
  }

  findInventoryItemByNames(names) {
    for (const name of names) {
      const item = this.findInventoryItemByName(name);
      if (item) {
        return item;
      }
    }

    return null;
  }

  getItemId(name) {
    return this.bot.registry.itemsByName[name]?.id ?? null;
  }

  getPlankNames() {
    return Object.keys(this.bot.registry.itemsByName).filter((name) => name.includes('planks'));
  }

  async craftFirstAvailable(itemNames, count = 1, craftingTableBlock = null) {
    for (const itemName of itemNames) {
      const itemId = this.getItemId(itemName);
      if (!itemId) {
        continue;
      }

      const recipes = this.bot.recipesFor(itemId, null, 1, craftingTableBlock);
      if (!recipes || recipes.length === 0) {
        continue;
      }

      await this.bot.craft(recipes[0], count, craftingTableBlock);
      return itemName;
    }

    return null;
  }

  async craftPlanksUntil(targetCount) {
    let plankCount = this.countItems((name) => name.includes('planks'));
    if (plankCount >= targetCount) {
      return true;
    }

    for (let attempts = 0; attempts < 8 && plankCount < targetCount; attempts += 1) {
      const crafted = await this.craftFirstAvailable(this.getPlankNames(), 1, null);
      if (!crafted) {
        break;
      }
      plankCount = this.countItems((name) => name.includes('planks'));
    }

    return plankCount >= targetCount;
  }

  async craftSticksUntil(targetCount) {
    let stickCount = this.countItem('stick');
    if (stickCount >= targetCount) {
      return true;
    }

    if (!(await this.craftPlanksUntil(2))) {
      return false;
    }

    for (let attempts = 0; attempts < 4 && stickCount < targetCount; attempts += 1) {
      const crafted = await this.craftFirstAvailable(['stick'], 1, null);
      if (!crafted) {
        break;
      }
      stickCount = this.countItem('stick');
    }

    return stickCount >= targetCount;
  }

  async craftCraftingTable(username) {
    if (this.countItem('crafting_table') > 0 || this.findNearbyCraftingTableBlock()) {
      return `${username}, верстак уже есть.`;
    }

    if (!(await this.craftPlanksUntil(4))) {
      return `${username}, мне не хватает досок для верстака.`;
    }

    const crafted = await this.craftFirstAvailable(['crafting_table'], 1, null);
    if (!crafted) {
      return `${username}, не смог скрафтить верстак.`;
    }

    return `${username}, верстак готов.`;
  }

  async craftPickaxe(username) {
    const hasStonePickaxe = this.countItem('stone_pickaxe') > 0;
    const hasWoodenPickaxe = this.countItem('wooden_pickaxe') > 0;
    if (hasStonePickaxe) {
      return `${username}, у меня уже есть каменная кирка.`;
    }

    if (!(await this.craftPlanksUntil(6))) {
      return `${username}, мне не хватает дерева для кирки.`;
    }

    if (!(await this.craftSticksUntil(2))) {
      return `${username}, не смог сделать палки для кирки.`;
    }

    const craftingTableBlock = await this.ensureCraftingTableBlock(username);
    if (!craftingTableBlock) {
      return `${username}, не смог поставить верстак для крафта.`;
    }

    const cobblestoneCount = this.countItems((name) =>
      ['cobblestone', 'cobbled_deepslate', 'blackstone'].includes(name)
    );

    if (cobblestoneCount >= 3) {
      const craftedStone = await this.craftFirstAvailable(['stone_pickaxe'], 1, craftingTableBlock);
      if (craftedStone) {
        return `${username}, каменная кирка готова.`;
      }
    }

    if (!hasWoodenPickaxe) {
      const craftedWood = await this.craftFirstAvailable(['wooden_pickaxe'], 1, craftingTableBlock);
      if (craftedWood) {
        return `${username}, деревянная кирка готова.`;
      }
    }

    return `${username}, не смог скрафтить кирку.`;
  }

  findNearbyCraftingTableBlock(maxDistance = 6) {
    return this.findNearestBlock((block) => block.name === 'crafting_table', maxDistance);
  }

  async ensureCraftingTableBlock(username) {
    const nearby = this.findNearbyCraftingTableBlock();
    if (nearby) {
      return nearby;
    }

    if (this.countItem('crafting_table') === 0) {
      const result = await this.craftCraftingTable(username);
      this.log(`craft_table_result="${result}"`);
      if (this.countItem('crafting_table') === 0) {
        return null;
      }
    }

    const target = this.findNearbyPlacementTarget();
    if (!target) {
      return null;
    }

    const placed = await this.placeBlockAt(target, 'crafting_table');
    if (!placed) {
      return null;
    }

    await sleep(150);
    return this.bot.blockAt(target);
  }

  findNearbyPlacementTarget() {
    const base = this.bot.entity.position.floored();
    const offsets = [
      new Vec3(1, 0, 0),
      new Vec3(-1, 0, 0),
      new Vec3(0, 0, 1),
      new Vec3(0, 0, -1),
      new Vec3(2, 0, 0),
      new Vec3(-2, 0, 0),
      new Vec3(0, 0, 2),
      new Vec3(0, 0, -2)
    ];

    for (const offset of offsets) {
      const target = base.plus(offset);
      const below = this.bot.blockAt(target.offset(0, -1, 0));
      const block = this.bot.blockAt(target);
      if (below && below.boundingBox === 'block' && this.isAirLike(block)) {
        return target;
      }
    }

    return null;
  }

  async gatherWood(username) {
    let mined = 0;

    for (let attempts = 0; attempts < 8; attempts += 1) {
      const logBlock = this.findNearestBlock(
        (block) => this.isLogName(block.name) && this.hasAdjacentAir(block.position),
        32
      );

      if (!logBlock) {
        break;
      }

      const success = await this.digBlock(logBlock);
      if (!success) {
        break;
      }

      mined += 1;
      await sleep(250);
    }

    if (mined === 0) {
      return `${username}, не нашёл рядом доступное дерево.`;
    }

    return `${username}, добыл ${mined} блоков дерева.`;
  }

  async mineStone(username) {
    const pickaxe = this.findInventoryItemByNames(['stone_pickaxe', 'wooden_pickaxe']);
    if (!pickaxe) {
      return `${username}, у меня нет кирки для камня.`;
    }

    await this.bot.equip(pickaxe, 'hand');

    let mined = 0;
    for (let attempts = 0; attempts < 10; attempts += 1) {
      const stoneBlock = this.findNearestBlock(
        (block) =>
          ['stone', 'deepslate', 'cobblestone', 'cobbled_deepslate'].includes(block.name) &&
          this.hasAdjacentAir(block.position),
        24
      );

      if (!stoneBlock) {
        break;
      }

      const success = await this.digBlock(stoneBlock);
      if (!success) {
        break;
      }

      mined += 1;
      await sleep(250);
    }

    if (mined === 0) {
      return `${username}, не нашёл рядом доступный камень.`;
    }

    return `${username}, добыл ${mined} блоков камня.`;
  }

  async digBlock(block) {
    if (!block) {
      return false;
    }

    await this.moveNear(block.position);

    if (typeof this.bot.canDigBlock === 'function' && !this.bot.canDigBlock(block)) {
      return false;
    }

    try {
      await this.bot.dig(block, true);
      await sleep(250);
      return true;
    } catch (error) {
      this.log(`dig failed at ${block.position.x} ${block.position.y} ${block.position.z}: ${error.message}`);
      return false;
    }
  }

  async startBuildHouse(username) {
    if (this.activeTask) {
      this.say(`${username}, я сейчас занят задачей ${this.activeTask}.`, {
        minGapMs: this.config.bots.chatReplyCooldownMs
      });
      return;
    }

    this.activeTask = 'build_house';

    try {
      const resultMessage = await this.buildHouse(username);
      this.say(resultMessage, { minGapMs: 0 });
    } catch (error) {
      this.log(`build failed: ${error.message}`);
      this.say(`${username}, не смог построить дом: ${error.message}`, { minGapMs: 0 });
    } finally {
      this.activeTask = null;
      this.scheduleAmbientAction(3000);
    }
  }

  async buildHouse(username) {
    const buildItem = this.findBuildItem();
    if (!buildItem) {
      return `${username}, у меня нет подходящих блоков для дома.`;
    }

    const origin = this.findBuildOrigin(username);
    if (!origin) {
      return `${username}, не нашёл рядом ровное место для дома.`;
    }

    const plan = this.createHousePlan(origin);
    const requiredBlocks = plan.length;
    if (buildItem.count < requiredBlocks) {
      return `${username}, у меня мало блоков: нужно ${requiredBlocks}, есть ${buildItem.count}.`;
    }

    this.say(`${username}, начинаю строить дом из ${buildItem.name}.`, { minGapMs: 0 });

    let placed = 0;
    for (const target of plan) {
      const success = await this.placeBlockAt(target, buildItem.name);
      if (success) {
        placed += 1;
      } else {
        this.log(`build skipped at ${target.x} ${target.y} ${target.z}`);
      }
    }

    if (placed < Math.max(10, Math.floor(requiredBlocks * 0.6))) {
      return `${username}, не смог нормально закончить дом. Поставил только ${placed} блоков из ${requiredBlocks}.`;
    }

    return `${username}, дом готов. Поставил ${placed} блоков.`;
  }

  findBuildItem() {
    const items = this.bot.inventory
      .items()
      .filter((item) => item && item.count > 0 && this.isGoodBuildItem(item.name))
      .sort((left, right) => right.count - left.count);

    return items[0] || null;
  }

  isGoodBuildItem(itemName) {
    if (!itemName) {
      return false;
    }

    return !BLOCK_ITEM_BLACKLIST.some((fragment) => itemName.includes(fragment));
  }

  findBuildOrigin(username) {
    const player = this.findPlayer(username);
    const base = player?.entity?.position || this.bot.entity.position;
    const baseY = Math.floor(base.y);
    const candidates = [
      new Vec3(Math.floor(base.x) + 4, baseY, Math.floor(base.z) - 1),
      new Vec3(Math.floor(base.x) - 6, baseY, Math.floor(base.z) - 1),
      new Vec3(Math.floor(base.x) - 1, baseY, Math.floor(base.z) + 4),
      new Vec3(Math.floor(base.x) - 1, baseY, Math.floor(base.z) - 6)
    ];

    return candidates.find((origin) => this.isBuildAreaSuitable(origin, 3, 4, 3)) || null;
  }

  isBuildAreaSuitable(origin, width, height, depth) {
    for (let x = 0; x < width; x += 1) {
      for (let z = 0; z < depth; z += 1) {
        const below = this.bot.blockAt(origin.offset(x, -1, z));
        if (!below || below.boundingBox !== 'block') {
          return false;
        }
      }
    }

    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        for (let z = 0; z < depth; z += 1) {
          const block = this.bot.blockAt(origin.offset(x, y, z));
          if (!this.isAirLike(block)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  createHousePlan(origin) {
    const plan = [];

    for (let y = 0; y <= 2; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        for (let z = 0; z < 3; z += 1) {
          const isWall = x === 0 || x === 2 || z === 0 || z === 2;
          const isDoor = z === 0 && x === 1 && (y === 0 || y === 1);

          if (isWall && !isDoor) {
            plan.push(origin.offset(x, y, z));
          }
        }
      }
    }

    for (let x = 0; x < 3; x += 1) {
      for (let z = 0; z < 3; z += 1) {
        plan.push(origin.offset(x, 3, z));
      }
    }

    return plan;
  }

  isAirLike(block) {
    return !block || AIR_BLOCKS.has(block.name);
  }

  findPlacementReference(target) {
    for (const faceVector of FACE_VECTORS) {
      const referencePosition = target.minus(faceVector);
      const referenceBlock = this.bot.blockAt(referencePosition);

      if (
        !referenceBlock ||
        this.isAirLike(referenceBlock) ||
        referenceBlock.boundingBox !== 'block'
      ) {
        continue;
      }

      return {
        referenceBlock,
        faceVector
      };
    }

    return null;
  }

  async moveNear(target) {
    const goal = new GoalNear(target.x, target.y, target.z, 3);
    if (this.bot.pathfinder && typeof this.bot.pathfinder.goto === 'function') {
      await this.bot.pathfinder.goto(goal);
      return;
    }

    this.bot.pathfinder.setGoal(goal);
    await sleep(1000);
  }

  async placeBlockAt(target, itemName) {
    const existingBlock = this.bot.blockAt(target);
    if (!this.isAirLike(existingBlock)) {
      return true;
    }

    const reference = this.findPlacementReference(target);
    if (!reference) {
      return false;
    }

    await this.moveNear(target);

    const inventoryItem = this.bot.inventory.items().find((item) => item.name === itemName);
    if (!inventoryItem) {
      throw new Error(`закончились блоки ${itemName}`);
    }

    await this.bot.equip(inventoryItem, 'hand');

    try {
      await this.bot.placeBlock(reference.referenceBlock, reference.faceVector);
      await sleep(120);
      return true;
    } catch (error) {
      this.log(`place failed at ${target.x} ${target.y} ${target.z}: ${error.message}`);
      return false;
    }
  }

  say(message, options = {}) {
    if (!message) {
      return;
    }

    const minGapMs =
      typeof options.minGapMs === 'number' ? options.minGapMs : this.config.bots.chatCooldownMs;
    const now = Date.now();
    if (now - this.lastChatAt < minGapMs) {
      return;
    }

    this.lastChatAt = now;
    try {
      this.log(`chat="${message}"`);
      this.bot.chat(message);
    } catch (error) {
      this.log(`chat failed: ${error.message}`);
    }
  }
}

module.exports = {
  AIBot
};

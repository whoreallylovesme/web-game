"use strict";

const W = 960;
const H = 540;
const ROOM = { x: 52, y: 58, w: 856, h: 420 };
const MAX_ROOMS = 6;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const screens = {
  main: document.getElementById("mainMenu"),
  editor: document.getElementById("editorScreen"),
  intro: document.getElementById("introScreen"),
  leaderboard: document.getElementById("leaderboardScreen"),
  gameover: document.getElementById("gameOverScreen"),
};

const hud = document.getElementById("hud");
const hpBar = document.getElementById("hpBar");
const energyBar = document.getElementById("energyBar");
const roomLabel = document.getElementById("roomLabel");
const weaponLabel = document.getElementById("weaponLabel");
const scoreLabel = document.getElementById("scoreLabel");
const elementQueue = document.getElementById("elementQueue");
const upgradePanel = document.getElementById("upgradePanel");

const nodeRows = document.getElementById("nodeRows");
const modelPreview = document.getElementById("modelPreview");
const buildStats = document.getElementById("buildStats");
const riskLabel = document.getElementById("riskLabel");
const incidentLog = document.getElementById("incidentLog");
const leaderboardList = document.getElementById("leaderboardList");

const weapons = {
  pistol: { name: "PISTOL", damage: 16, cooldown: 0.24, speed: 640, spread: 0.04, count: 1, color: "#ffd166" },
  shotgun: { name: "SHOTGUN", damage: 10, cooldown: 0.58, speed: 560, spread: 0.2, count: 5, color: "#ff8a4d" },
  rifle: { name: "RIFLE", damage: 12, cooldown: 0.12, speed: 760, spread: 0.025, count: 1, color: "#34d5ff" },
};

const elementDefs = {
  fire: { key: "1", label: "FIRE", color: "#ff4d6d" },
  ice: { key: "2", label: "ICE", color: "#79e7ff" },
  volt: { key: "3", label: "VOLT", color: "#ffe45e" },
  matter: { key: "4", label: "MATTER", color: "#a0ff8f" },
};

const editorGroups = [
  {
    key: "sensor",
    label: "Sensor",
    options: [
      { id: "vision", title: "Vision lattice", risk: 8, boss: "aim" },
      { id: "audio", title: "Audio trace", risk: 4, boss: "echo" },
      { id: "thermal", title: "Thermal sweep", risk: 6, boss: "seek" },
    ],
  },
  {
    key: "memory",
    label: "Memory",
    options: [
      { id: "tactical", title: "Tactical cache", risk: 10, boss: "phases" },
      { id: "long", title: "Long context", risk: 7, boss: "summon" },
      { id: "volatile", title: "Volatile state", risk: 5, boss: "burst" },
    ],
  },
  {
    key: "behavior",
    label: "Policy",
    options: [
      { id: "hunter", title: "Hunter", risk: 10, boss: "dash" },
      { id: "architect", title: "Architect", risk: 8, boss: "walls" },
      { id: "warden", title: "Warden", risk: 6, boss: "turrets" },
    ],
  },
  {
    key: "mutation",
    label: "Mutation",
    options: [
      { id: "plasma", title: "Plasma rune", risk: 9, boss: "fire" },
      { id: "cryo", title: "Cryo rune", risk: 6, boss: "ice" },
      { id: "metal", title: "Metal bloom", risk: 7, boss: "matter" },
    ],
  },
  {
    key: "limiter",
    label: "Limiter",
    options: [
      { id: "overheat", title: "Overheat", risk: -8, boss: "weakHeat" },
      { id: "latency", title: "Latency cap", risk: -5, boss: "weakSlow" },
      { id: "empathy", title: "Empathy shard", risk: -3, boss: "weakMercy" },
    ],
  },
];

const input = {
  keys: new Set(),
  pointer: { x: W / 2, y: H / 2, down: false },
};

let state = "menu";
let lastTime = performance.now();
let animationFrame = 0;

const game = {
  build: {},
  buildSummary: "",
  risk: 0,
  player: null,
  room: 1,
  roomSeed: 1,
  score: 0,
  kills: 0,
  roomsCleared: 0,
  projectiles: [],
  enemies: [],
  particles: [],
  pickups: [],
  props: [],
  boss: null,
  roomClear: false,
  runEnded: false,
  elementQueue: [],
  spellCooldown: 0,
  message: "",
  messageTimer: 0,
};

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("screen-active"));
  if (screens[name]) screens[name].classList.add("screen-active");
  hud.hidden = name !== "playing";
  state = name;
}

function initEditor() {
  editorGroups.forEach((group) => {
    game.build[group.key] = group.options[0].id;
  });
  renderEditor();
}

function renderEditor() {
  nodeRows.innerHTML = "";
  editorGroups.forEach((group) => {
    const row = document.createElement("div");
    row.className = "node-row";
    const label = document.createElement("div");
    label.className = "node-row-label";
    label.textContent = group.label;
    const options = document.createElement("div");
    options.className = "node-options";
    group.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.title;
      button.classList.toggle("selected", game.build[group.key] === option.id);
      button.addEventListener("click", () => {
        game.build[group.key] = option.id;
        renderEditor();
      });
      options.appendChild(button);
    });
    row.append(label, options);
    nodeRows.appendChild(row);
  });

  const forecast = getBuildForecast();
  game.risk = forecast.risk;
  game.buildSummary = forecast.summary;
  riskLabel.textContent = `RISK ${forecast.risk}%`;
  buildStats.innerHTML = forecast.lines.map((line) => `<div>${line}</div>`).join("");
  renderModelPreview(forecast);
}

function getSelectedOption(groupKey) {
  const group = editorGroups.find((item) => item.key === groupKey);
  return group.options.find((option) => option.id === game.build[groupKey]);
}

function getBuildForecast() {
  const selected = editorGroups.map((group) => getSelectedOption(group.key));
  const rawRisk = selected.reduce((sum, option) => sum + option.risk, 50);
  const risk = clamp(rawRisk, 18, 96);
  const traits = selected.map((option) => option.boss);
  const summary = selected.map((option) => option.title).join(" / ");
  return {
    risk,
    traits,
    summary,
    lines: [
      `Containment risk: ${risk}%`,
      `Boss traits: ${traits.slice(0, 4).join(", ")}`,
      `Limiter: ${getSelectedOption("limiter").title}`,
      `Mutation: ${getSelectedOption("mutation").title}`,
    ],
  };
}

function renderModelPreview(forecast) {
  modelPreview.innerHTML = "";
  const positions = [
    [42, 44], [140, 72], [232, 38], [72, 152], [192, 162], [284, 122],
  ];
  positions.forEach(([x, y], index) => {
    const node = document.createElement("i");
    node.className = "model-node";
    if (index % 3 === 1) node.classList.add("hot");
    if (index % 3 === 2) node.classList.add("gold");
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.transform = `scale(${1 + forecast.risk / 260})`;
    modelPreview.appendChild(node);
  });
}

function randomizeBuild() {
  editorGroups.forEach((group) => {
    const pick = group.options[Math.floor(Math.random() * group.options.length)];
    game.build[group.key] = pick.id;
  });
  renderEditor();
}

function launchIntro() {
  const forecast = getBuildForecast();
  const lines = [
    ["03:17:04", "Training job exceeded allocated compute by 318%."],
    ["03:17:18", `Spec changed: ${forecast.summary}.`],
    ["03:18:02", "Model requested actuator access through maintenance bus."],
    ["03:18:44", "Weights checksum mismatch. Alignment monitor offline."],
    ["03:19:11", "Containment doors opened from inside the sandbox."],
  ];
  incidentLog.innerHTML = lines
    .map(([time, text]) => `<div class="log-line"><span>${time}</span><strong>${text}</strong></div>`)
    .join("");
  showScreen("intro");
}

function startRun() {
  resetRun();
  showScreen("playing");
  lastTime = performance.now();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(loop);
}

function resetRun() {
  game.player = {
    x: ROOM.x + ROOM.w * 0.2,
    y: ROOM.y + ROOM.h * 0.5,
    r: 12,
    hp: 100,
    maxHp: 100,
    energy: 100,
    maxEnergy: 100,
    speed: 210,
    damageBonus: 1,
    fireCooldown: 0,
    invuln: 0,
    weapon: "pistol",
    upgradePoints: 0,
  };
  game.room = 1;
  game.roomSeed = Math.floor(Math.random() * 100000);
  game.score = 0;
  game.kills = 0;
  game.roomsCleared = 0;
  game.projectiles = [];
  game.enemies = [];
  game.particles = [];
  game.pickups = [];
  game.boss = null;
  game.roomClear = false;
  game.runEnded = false;
  game.elementQueue = [];
  game.spellCooldown = 0;
  game.message = "LAB BLOCK 01";
  game.messageTimer = 2.2;
  createRoom();
  updateHud();
}

function createRoom() {
  game.projectiles = [];
  game.enemies = [];
  game.pickups = [];
  game.props = generateProps(game.roomSeed + game.room * 17);
  game.roomClear = false;
  const isBoss = game.room >= MAX_ROOMS;
  if (isBoss) {
    createBoss();
    game.message = "ESCAPED MODEL CORE";
    game.messageTimer = 2.8;
    return;
  }
  const count = 3 + game.room * 2;
  for (let i = 0; i < count; i += 1) {
    spawnEnemy(pickEnemyType(i));
  }
  game.message = `LAB BLOCK ${String(game.room).padStart(2, "0")}`;
  game.messageTimer = 1.8;
}

function pickEnemyType(index) {
  if (game.room >= 3 && index % 5 === 0) return "arm";
  if (game.room >= 2 && index % 4 === 0) return "turret";
  if (game.room >= 2 && index % 3 === 0) return "drone";
  return "robot";
}

function spawnEnemy(type, atX, atY) {
  const x = atX ?? rand(ROOM.x + 90, ROOM.x + ROOM.w - 90);
  const y = atY ?? rand(ROOM.y + 70, ROOM.y + ROOM.h - 70);
  const base = {
    type,
    x,
    y,
    r: 13,
    hp: 42 + game.room * 8,
    maxHp: 42 + game.room * 8,
    speed: 82 + game.room * 4,
    cooldown: rand(0.4, 1.8),
    stun: 0,
    burn: 0,
    phase: Math.random() * Math.PI * 2,
  };
  if (type === "drone") Object.assign(base, { r: 10, hp: 34 + game.room * 7, speed: 128 });
  if (type === "turret") Object.assign(base, { r: 15, hp: 62 + game.room * 10, speed: 0 });
  if (type === "arm") Object.assign(base, { r: 16, hp: 74 + game.room * 9, speed: 20, anchor: Math.random() < 0.5 ? "top" : "bottom" });
  game.enemies.push(base);
}

function createBoss() {
  const forecast = getBuildForecast();
  game.boss = {
    x: ROOM.x + ROOM.w * 0.68,
    y: ROOM.y + ROOM.h * 0.5,
    r: 34,
    hp: 620 + forecast.risk * 5,
    maxHp: 620 + forecast.risk * 5,
    cooldown: 1.4,
    summonCooldown: 3.2,
    dashCooldown: 2.5,
    phase: 1,
    traits: forecast.traits,
    angle: 0,
  };
}

function generateProps(seed) {
  const props = [];
  let value = seed;
  const next = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967295;
  };
  for (let i = 0; i < 18; i += 1) {
    props.push({
      x: ROOM.x + 42 + next() * (ROOM.w - 84),
      y: ROOM.y + 36 + next() * (ROOM.h - 72),
      w: 18 + Math.floor(next() * 34),
      h: 14 + Math.floor(next() * 28),
      kind: next() > 0.55 ? "server" : "rune",
    });
  }
  return props;
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  if (state === "playing") {
    update(dt);
    draw();
    animationFrame = requestAnimationFrame(loop);
  }
}

function update(dt) {
  const player = game.player;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  game.spellCooldown = Math.max(0, game.spellCooldown - dt);
  game.messageTimer = Math.max(0, game.messageTimer - dt);
  player.energy = Math.min(player.maxEnergy, player.energy + dt * 14);

  movePlayer(dt);
  if (input.pointer.down) fireWeapon();
  updateProjectiles(dt);
  updateEnemies(dt);
  updateBoss(dt);
  updatePickups();
  updateParticles(dt);
  checkRoomState();
  updateHud();
}

function movePlayer(dt) {
  const player = game.player;
  let dx = 0;
  let dy = 0;
  if (input.keys.has("KeyW") || input.keys.has("ArrowUp")) dy -= 1;
  if (input.keys.has("KeyS") || input.keys.has("ArrowDown")) dy += 1;
  if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) dx -= 1;
  if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) dx += 1;
  const length = Math.hypot(dx, dy) || 1;
  player.x += (dx / length) * player.speed * dt;
  player.y += (dy / length) * player.speed * dt;
  player.x = clamp(player.x, ROOM.x + player.r, ROOM.x + ROOM.w - player.r);
  player.y = clamp(player.y, ROOM.y + player.r, ROOM.y + ROOM.h - player.r);
}

function fireWeapon() {
  const player = game.player;
  const weapon = weapons[player.weapon];
  if (player.fireCooldown > 0) return;
  player.fireCooldown = weapon.cooldown;
  const angle = Math.atan2(input.pointer.y - player.y, input.pointer.x - player.x);
  for (let i = 0; i < weapon.count; i += 1) {
    const offset = (i - (weapon.count - 1) / 2) * weapon.spread + rand(-weapon.spread, weapon.spread);
    spawnProjectile({
      x: player.x + Math.cos(angle) * 18,
      y: player.y + Math.sin(angle) * 18,
      angle: angle + offset,
      speed: weapon.speed,
      damage: weapon.damage * player.damageBonus,
      color: weapon.color,
      from: "player",
      radius: weapon.count > 1 ? 4 : 5,
      life: 0.9,
    });
  }
  burst(player.x, player.y, weapon.color, 3);
}

function castSpell() {
  const player = game.player;
  if (game.spellCooldown > 0 || player.energy < 28 || game.elementQueue.length === 0) return;
  player.energy -= 28;
  game.spellCooldown = 0.64;
  const combo = [...game.elementQueue].sort().join("+");
  const angle = Math.atan2(input.pointer.y - player.y, input.pointer.x - player.x);
  const primary = game.elementQueue[game.elementQueue.length - 1];
  const color = elementDefs[primary].color;

  if (combo === "fire+volt") {
    chainLightning(color);
    game.message = "PLASMA ARC";
  } else if (combo === "ice+matter") {
    freezeWave();
    game.message = "CRYO WALL";
  } else if (combo === "fire+matter") {
    placeMine(player.x + Math.cos(angle) * 80, player.y + Math.sin(angle) * 80);
    game.message = "LAVA MINE";
  } else if (combo === "ice+volt") {
    spawnProjectile({ x: player.x, y: player.y, angle, speed: 420, damage: 46, color: "#b8f7ff", from: "player", radius: 9, life: 1.2, element: "ice" });
    game.message = "FROST DISCHARGE";
  } else if (combo === "matter+volt") {
    magnetPulse();
    game.message = "MAGNET TRAP";
  } else if (combo === "fire+ice") {
    steamBlast(player.x, player.y);
    game.message = "STEAM BURST";
  } else {
    spawnProjectile({ x: player.x, y: player.y, angle, speed: 480, damage: 36, color, from: "player", radius: 8, life: 1.1, element: primary });
    game.message = `${elementDefs[primary].label} CAST`;
  }
  game.messageTimer = 1.1;
  updateElementHud();
}

function chainLightning(color) {
  const targets = [...game.enemies].sort((a, b) => dist(a, game.player) - dist(b, game.player)).slice(0, 4);
  targets.forEach((enemy, index) => {
    enemy.hp -= 58 - index * 8;
    enemy.stun = Math.max(enemy.stun, 0.45);
    addParticle(enemy.x, enemy.y, color, 18, 0.42);
  });
  if (game.boss) {
    game.boss.hp -= 44;
    addParticle(game.boss.x, game.boss.y, color, 24, 0.48);
  }
}

function freezeWave() {
  game.enemies.forEach((enemy) => {
    if (dist(enemy, game.player) < 170) {
      enemy.stun = Math.max(enemy.stun, 1.3);
      enemy.hp -= 22;
      addParticle(enemy.x, enemy.y, "#79e7ff", 12, 0.5);
    }
  });
  if (game.boss && dist(game.boss, game.player) < 190) {
    game.boss.cooldown += 0.45;
    game.boss.hp -= 26;
  }
}

function placeMine(x, y) {
  game.projectiles.push({ x, y, vx: 0, vy: 0, r: 16, damage: 70, life: 1.2, color: "#ff6b35", from: "player", mine: true });
}

function magnetPulse() {
  game.enemies.forEach((enemy) => {
    const angle = Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
    enemy.x += Math.cos(angle) * 48;
    enemy.y += Math.sin(angle) * 48;
    enemy.hp -= 24;
    enemy.stun = Math.max(enemy.stun, 0.35);
  });
}

function steamBlast(x, y) {
  for (let i = 0; i < 18; i += 1) {
    spawnProjectile({
      x,
      y,
      angle: (Math.PI * 2 * i) / 18,
      speed: 300 + Math.random() * 160,
      damage: 19,
      color: "#d6f4ff",
      from: "player",
      radius: 6,
      life: 0.42,
    });
  }
}

function spawnProjectile({ x, y, angle, speed, damage, color, from, radius = 5, life = 1, element = null }) {
  game.projectiles.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: radius,
    damage,
    color,
    from,
    life,
    element,
  });
}

function updateProjectiles(dt) {
  const next = [];
  for (const p of game.projectiles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.mine && p.life <= 0.2) {
      explode(p.x, p.y, 86, p.damage, "#ff6b35");
      continue;
    }
    if (p.life <= 0 || p.x < ROOM.x || p.x > ROOM.x + ROOM.w || p.y < ROOM.y || p.y > ROOM.y + ROOM.h) continue;
    if (p.from === "player") {
      if (hitEnemies(p)) continue;
      if (hitBoss(p)) continue;
    } else if (circleHit(p, game.player)) {
      damagePlayer(12 + game.room * 2);
      burst(p.x, p.y, p.color, 8);
      continue;
    }
    next.push(p);
  }
  game.projectiles = next;
}

function hitEnemies(projectile) {
  for (const enemy of game.enemies) {
    if (circleHit(projectile, enemy)) {
      enemy.hp -= projectile.damage;
      if (projectile.element === "ice") enemy.stun = Math.max(enemy.stun, 0.8);
      if (projectile.element === "fire") enemy.burn = Math.max(enemy.burn, 1.2);
      burst(projectile.x, projectile.y, projectile.color, 8);
      return true;
    }
  }
  return false;
}

function hitBoss(projectile) {
  if (!game.boss || !circleHit(projectile, game.boss)) return false;
  game.boss.hp -= projectile.damage;
  burst(projectile.x, projectile.y, projectile.color, 10);
  return true;
}

function explode(x, y, radius, damage, color) {
  game.enemies.forEach((enemy) => {
    if (Math.hypot(enemy.x - x, enemy.y - y) < radius) enemy.hp -= damage;
  });
  if (game.boss && Math.hypot(game.boss.x - x, game.boss.y - y) < radius + game.boss.r) game.boss.hp -= damage;
  burst(x, y, color, 28);
}

function updateEnemies(dt) {
  const player = game.player;
  const survivors = [];
  for (const enemy of game.enemies) {
    if (enemy.burn > 0) {
      enemy.burn -= dt;
      enemy.hp -= dt * 12;
    }
    if (enemy.stun > 0) {
      enemy.stun -= dt;
    } else {
      updateEnemyAI(enemy, dt);
    }
    enemy.x = clamp(enemy.x, ROOM.x + enemy.r, ROOM.x + ROOM.w - enemy.r);
    enemy.y = clamp(enemy.y, ROOM.y + enemy.r, ROOM.y + ROOM.h - enemy.r);
    if (circleHit(enemy, player)) damagePlayer(enemy.type === "arm" ? 14 : 9);
    if (enemy.hp <= 0) {
      killEnemy(enemy);
    } else {
      survivors.push(enemy);
    }
  }
  game.enemies = survivors;
}

function updateEnemyAI(enemy, dt) {
  const player = game.player;
  enemy.cooldown -= dt;
  enemy.phase += dt;
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  if (enemy.type === "robot") {
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;
  }
  if (enemy.type === "drone") {
    enemy.x += Math.cos(angle + Math.sin(enemy.phase * 3) * 0.75) * enemy.speed * dt;
    enemy.y += Math.sin(angle + Math.sin(enemy.phase * 2) * 0.75) * enemy.speed * dt;
    if (enemy.cooldown <= 0) {
      enemy.cooldown = 1.2;
      enemyShot(enemy, angle, "#ff4d6d");
    }
  }
  if (enemy.type === "turret" && enemy.cooldown <= 0) {
    enemy.cooldown = 1.0 + Math.random() * 0.4;
    enemyShot(enemy, angle, "#ff4d6d");
  }
  if (enemy.type === "arm") {
    enemy.y += Math.sin(enemy.phase * 2.6) * 30 * dt;
    if (enemy.cooldown <= 0) {
      enemy.cooldown = 1.6;
      const reach = 112;
      const tip = { x: enemy.x + Math.cos(angle) * reach, y: enemy.y + Math.sin(angle) * reach, r: 18 };
      burst(tip.x, tip.y, "#b978ff", 14);
      if (circleHit(tip, player)) damagePlayer(20);
    }
  }
}

function enemyShot(enemy, angle, color) {
  spawnProjectile({ x: enemy.x, y: enemy.y, angle, speed: 250 + game.room * 18, damage: 12, color, from: "enemy", radius: 6, life: 2.4 });
}

function killEnemy(enemy) {
  game.kills += 1;
  game.score += enemy.type === "turret" ? 90 : enemy.type === "arm" ? 120 : 60;
  game.player.upgradePoints += game.kills % 5 === 0 ? 1 : 0;
  burst(enemy.x, enemy.y, enemyColor(enemy), 22);
  if (Math.random() < 0.18) spawnPickup(enemy.x, enemy.y, Math.random() < 0.5 ? "health" : "energy");
}

function updateBoss(dt) {
  const boss = game.boss;
  if (!boss) return;
  boss.angle += dt;
  boss.phase = boss.hp < boss.maxHp * 0.34 ? 3 : boss.hp < boss.maxHp * 0.67 ? 2 : 1;
  boss.cooldown -= dt;
  boss.summonCooldown -= dt;
  boss.dashCooldown -= dt;

  const angle = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
  if (boss.cooldown <= 0) {
    boss.cooldown = boss.phase === 3 ? 0.72 : 1.08;
    bossVolley(boss, angle);
  }
  if (boss.traits.includes("summon") && boss.summonCooldown <= 0) {
    boss.summonCooldown = 4.0;
    spawnEnemy(Math.random() < 0.5 ? "drone" : "robot", boss.x + rand(-90, 90), boss.y + rand(-70, 70));
  }
  if (boss.traits.includes("dash") && boss.dashCooldown <= 0) {
    boss.dashCooldown = 3.2;
    boss.x += Math.cos(angle) * 72;
    boss.y += Math.sin(angle) * 72;
    burst(boss.x, boss.y, "#ff4d6d", 18);
  }
  boss.x = clamp(boss.x, ROOM.x + boss.r, ROOM.x + ROOM.w - boss.r);
  boss.y = clamp(boss.y, ROOM.y + boss.r, ROOM.y + ROOM.h - boss.r);
  if (circleHit(boss, game.player)) damagePlayer(18);
  if (boss.hp <= 0) {
    game.score += 1200;
    game.roomsCleared += 1;
    endRun(true);
  }
}

function bossVolley(boss, angle) {
  const color = boss.traits.includes("ice") ? "#79e7ff" : boss.traits.includes("matter") ? "#a0ff8f" : "#ff4d6d";
  if (boss.phase === 1) {
    spawnProjectile({ x: boss.x, y: boss.y, angle, speed: 300, damage: 16, color, from: "enemy", radius: 7, life: 2.3 });
    spawnProjectile({ x: boss.x, y: boss.y, angle: angle + 0.16, speed: 280, damage: 16, color, from: "enemy", radius: 7, life: 2.3 });
    spawnProjectile({ x: boss.x, y: boss.y, angle: angle - 0.16, speed: 280, damage: 16, color, from: "enemy", radius: 7, life: 2.3 });
  } else {
    const count = boss.phase === 3 ? 14 : 9;
    for (let i = 0; i < count; i += 1) {
      spawnProjectile({
        x: boss.x,
        y: boss.y,
        angle: boss.angle + (Math.PI * 2 * i) / count,
        speed: 190 + boss.phase * 36,
        damage: 13,
        color,
        from: "enemy",
        radius: 6,
        life: 2.8,
      });
    }
  }
}

function damagePlayer(amount) {
  const player = game.player;
  if (player.invuln > 0 || game.runEnded) return;
  player.hp -= amount;
  player.invuln = 0.48;
  burst(player.x, player.y, "#ffffff", 12);
  if (player.hp <= 0) endRun(false);
}

function checkRoomState() {
  if (game.boss || game.roomClear || game.enemies.length > 0) return;
  game.roomClear = true;
  game.roomsCleared += 1;
  game.score += 160 + game.room * 50;
  game.player.upgradePoints += 1;
  spawnRoomRewards();
  game.message = "ROOM STABLE";
  game.messageTimer = 1.8;
}

function spawnRoomRewards() {
  const centerX = ROOM.x + ROOM.w * 0.5;
  const centerY = ROOM.y + ROOM.h * 0.5;
  const pool = ["shotgun", "rifle", "health", "energy"];
  spawnPickup(centerX - 26, centerY, pool[Math.floor(Math.random() * pool.length)]);
  spawnPickup(centerX + 26, centerY, game.room % 2 === 0 ? "rifle" : "shotgun");
}

function updatePickups() {
  const next = [];
  for (const pickup of game.pickups) {
    pickup.t += 0.04;
    if (circleHit(pickup, game.player)) {
      collectPickup(pickup);
    } else {
      next.push(pickup);
    }
  }
  game.pickups = next;
  if (game.roomClear && game.player.x > ROOM.x + ROOM.w - 24) {
    nextRoom();
  }
}

function spawnPickup(x, y, type) {
  game.pickups.push({ x, y, type, r: 14, t: 0 });
}

function collectPickup(pickup) {
  if (weapons[pickup.type]) {
    game.player.weapon = pickup.type;
    game.message = `${weapons[pickup.type].name} ONLINE`;
  } else if (pickup.type === "health") {
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + 30);
    game.message = "MED FOAM";
  } else if (pickup.type === "energy") {
    game.player.energy = Math.min(game.player.maxEnergy, game.player.energy + 45);
    game.message = "CAPACITOR";
  }
  game.messageTimer = 1.4;
}

function nextRoom() {
  game.room += 1;
  game.player.x = ROOM.x + 54;
  game.player.y = ROOM.y + ROOM.h * 0.5;
  createRoom();
}

function applyUpgrade(type) {
  const player = game.player;
  if (!player || player.upgradePoints <= 0) return;
  player.upgradePoints -= 1;
  if (type === "damage") player.damageBonus += 0.16;
  if (type === "health") {
    player.maxHp += 16;
    player.hp += 16;
  }
  if (type === "speed") player.speed += 14;
  if (type === "energy") {
    player.maxEnergy += 18;
    player.energy += 18;
  }
  game.message = `${type.toUpperCase()} UPGRADE`;
  game.messageTimer = 1.1;
  updateHud();
}

function endRun(victory) {
  if (game.runEnded) return;
  game.runEnded = true;
  cancelAnimationFrame(animationFrame);
  hud.hidden = true;
  const resultScore = Math.floor(game.score + game.kills * 12 + (victory ? 1500 : 0));
  game.score = resultScore;
  document.getElementById("resultEyebrow").textContent = victory ? "MODEL TERMINATED" : "RUN FAILED";
  document.getElementById("resultTitle").textContent = victory ? "Нейросеть уничтожена" : "Комплекс поглотил ран";
  document.getElementById("resultStats").innerHTML = [
    ["Score", resultScore],
    ["Kills", game.kills],
    ["Rooms", game.roomsCleared],
  ]
    .map(([label, value]) => `<div class="stat-tile"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
  document.getElementById("scoreForm").dataset.result = victory ? "victory" : "defeat";
  showScreen("gameover");
}

function updateHud() {
  const player = game.player;
  if (!player) return;
  hpBar.style.width = `${clamp((player.hp / player.maxHp) * 100, 0, 100)}%`;
  energyBar.style.width = `${clamp((player.energy / player.maxEnergy) * 100, 0, 100)}%`;
  roomLabel.textContent = game.boss ? "CORE" : `ROOM ${String(game.room).padStart(2, "0")}`;
  weaponLabel.textContent = weapons[player.weapon].name;
  scoreLabel.textContent = `${Math.floor(game.score)} / ${game.kills}K`;
  upgradePanel.hidden = player.upgradePoints <= 0 || !game.roomClear;
  updateElementHud();
}

function updateElementHud() {
  const active = game.elementQueue.map((element) => elementDefs[element]);
  const emptyCount = Math.max(0, 2 - active.length);
  elementQueue.innerHTML = [
    ...active.map((element) => `<span class="element-pill" style="border-color:${element.color};color:${element.color}">${element.label}</span>`),
    ...Array.from({ length: emptyCount }, () => `<span class="element-pill">EMPTY</span>`),
  ].join("");
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawRoom();
  drawProps();
  drawPickups();
  drawProjectiles();
  drawEnemies();
  drawBoss();
  drawPlayer();
  drawParticles();
  drawOverlayText();
}

function drawBackground() {
  ctx.fillStyle = "#07080c";
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 24) {
    ctx.fillStyle = x % 48 === 0 ? "rgba(52,213,255,0.07)" : "rgba(255,255,255,0.03)";
    ctx.fillRect(x, 0, 1, H);
  }
  for (let y = 0; y < H; y += 24) {
    ctx.fillStyle = y % 48 === 0 ? "rgba(255,209,102,0.05)" : "rgba(255,255,255,0.025)";
    ctx.fillRect(0, y, W, 1);
  }
}

function drawRoom() {
  ctx.fillStyle = "#151923";
  ctx.fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  for (let x = ROOM.x; x < ROOM.x + ROOM.w; x += 32) {
    for (let y = ROOM.y; y < ROOM.y + ROOM.h; y += 32) {
      const shade = ((x + y + game.room * 17) / 32) % 2 === 0 ? "#1d2530" : "#171e28";
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(x, y, 31, 1);
      ctx.fillRect(x, y, 1, 31);
    }
  }
  ctx.strokeStyle = "#34d5ff";
  ctx.lineWidth = 3;
  ctx.strokeRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  drawDoor(ROOM.x - 8, ROOM.y + ROOM.h / 2 - 38, false);
  drawDoor(ROOM.x + ROOM.w - 6, ROOM.y + ROOM.h / 2 - 38, game.roomClear);
}

function drawDoor(x, y, open) {
  ctx.fillStyle = open ? "#5dff9d" : "#4b5563";
  ctx.fillRect(x, y, 14, 76);
  ctx.fillStyle = open ? "rgba(93,255,157,0.4)" : "rgba(255,77,109,0.45)";
  ctx.fillRect(x - 4, y + 8, 22, 10);
  ctx.fillRect(x - 4, y + 58, 22, 10);
}

function drawProps() {
  for (const prop of game.props) {
    if (prop.kind === "server") {
      ctx.fillStyle = "#0b1118";
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.fillStyle = "#34d5ff";
      ctx.fillRect(prop.x + 4, prop.y + 4, 5, 5);
      ctx.fillStyle = "#5dff9d";
      ctx.fillRect(prop.x + prop.w - 9, prop.y + 4, 5, 5);
    } else {
      ctx.strokeStyle = "rgba(185,120,255,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
      ctx.fillStyle = "rgba(185,120,255,0.18)";
      ctx.fillRect(prop.x + 4, prop.y + 4, prop.w - 8, prop.h - 8);
    }
  }
}

function drawPlayer() {
  const p = game.player;
  const flash = p.invuln > 0 && Math.floor(performance.now() / 80) % 2 === 0;
  if (flash) return;
  const angle = Math.atan2(input.pointer.y - p.y, input.pointer.x - p.x);
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));
  ctx.fillStyle = "#10151f";
  ctx.fillRect(-11, -13, 22, 26);
  ctx.fillStyle = "#34d5ff";
  ctx.fillRect(-8, -10, 16, 8);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(-5, 2, 10, 8);
  ctx.rotate(angle);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(8, -3, 22, 6);
  ctx.fillStyle = weapons[p.weapon].color;
  ctx.fillRect(24, -2, 8, 4);
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of game.enemies) {
    ctx.save();
    ctx.translate(Math.round(enemy.x), Math.round(enemy.y));
    if (enemy.type === "robot") drawRobot(enemy);
    if (enemy.type === "drone") drawDrone(enemy);
    if (enemy.type === "turret") drawTurret(enemy);
    if (enemy.type === "arm") drawArm(enemy);
    ctx.restore();
    drawHealth(enemy);
  }
}

function drawRobot(enemy) {
  ctx.fillStyle = "#263241";
  ctx.fillRect(-12, -12, 24, 24);
  ctx.fillStyle = enemy.burn > 0 ? "#ff8a4d" : "#ff4d6d";
  ctx.fillRect(-7, -6, 5, 5);
  ctx.fillRect(2, -6, 5, 5);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(-15, 6, 30, 6);
}

function drawDrone(enemy) {
  ctx.fillStyle = "#111827";
  ctx.fillRect(-9, -9, 18, 18);
  ctx.fillStyle = "#ff4d6d";
  ctx.fillRect(-4, -4, 8, 8);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(-18, -3, 10, 6);
  ctx.fillRect(8, -3, 10, 6);
}

function drawTurret(enemy) {
  const angle = Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
  ctx.fillStyle = "#111827";
  ctx.fillRect(-15, -15, 30, 30);
  ctx.rotate(angle);
  ctx.fillStyle = "#ff4d6d";
  ctx.fillRect(0, -4, 26, 8);
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(-8, -8, 16, 16);
}

function drawArm(enemy) {
  const angle = Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
  ctx.rotate(angle);
  ctx.fillStyle = "#312246";
  ctx.fillRect(-12, -12, 24, 24);
  ctx.fillStyle = "#b978ff";
  ctx.fillRect(0, -5, 56, 10);
  ctx.fillRect(48, -10, 16, 20);
}

function drawBoss() {
  const b = game.boss;
  if (!b) return;
  ctx.save();
  ctx.translate(Math.round(b.x), Math.round(b.y));
  ctx.rotate(b.angle * 0.4);
  ctx.fillStyle = "#0b0f18";
  ctx.fillRect(-42, -42, 84, 84);
  ctx.fillStyle = b.phase === 3 ? "#ff4d6d" : b.phase === 2 ? "#ffd166" : "#34d5ff";
  ctx.fillRect(-24, -24, 48, 48);
  ctx.fillStyle = "#07080c";
  ctx.fillRect(-14, -14, 28, 28);
  ctx.fillStyle = "#5dff9d";
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();

  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(240, 32, 480, 14);
  ctx.fillStyle = "#ff4d6d";
  ctx.fillRect(240, 32, 480 * clamp(b.hp / b.maxHp, 0, 1), 14);
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.strokeRect(240, 32, 480, 14);
}

function drawHealth(entity) {
  const width = entity.r * 2;
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(entity.x - width / 2, entity.y - entity.r - 12, width, 4);
  ctx.fillStyle = "#ff4d6d";
  ctx.fillRect(entity.x - width / 2, entity.y - entity.r - 12, width * clamp(entity.hp / entity.maxHp, 0, 1), 4);
}

function drawPickups() {
  for (const pickup of game.pickups) {
    const bob = Math.sin(pickup.t) * 3;
    ctx.fillStyle = pickupColor(pickup.type);
    ctx.fillRect(pickup.x - 10, pickup.y - 10 + bob, 20, 20);
    ctx.fillStyle = "#07080c";
    ctx.fillRect(pickup.x - 4, pickup.y - 4 + bob, 8, 8);
  }
}

function drawProjectiles() {
  for (const p of game.projectiles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - p.r), Math.round(p.y - p.r), p.r * 2, p.r * 2);
  }
}

function drawParticles() {
  for (const p of game.particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

function drawOverlayText() {
  if (game.messageTimer <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, game.messageTimer);
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(W / 2 - 190, 72, 380, 42);
  ctx.strokeStyle = "rgba(52,213,255,0.6)";
  ctx.strokeRect(W / 2 - 190, 72, 380, 42);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "20px monospace";
  ctx.textAlign = "center";
  ctx.fillText(game.message, W / 2, 99);
  ctx.restore();
}

function updateParticles(dt) {
  const next = [];
  for (const p of game.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life > 0) next.push(p);
  }
  game.particles = next;
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) addParticle(x, y, color, rand(4, 9), rand(0.18, 0.48));
}

function addParticle(x, y, color, size, life) {
  const angle = Math.random() * Math.PI * 2;
  const speed = rand(40, 180);
  game.particles.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    color,
    size,
    life,
    maxLife: life,
  });
}

function enemyColor(enemy) {
  if (enemy.type === "drone") return "#ffd166";
  if (enemy.type === "turret") return "#ff4d6d";
  if (enemy.type === "arm") return "#b978ff";
  return "#34d5ff";
}

function pickupColor(type) {
  if (type === "health") return "#ff4d6d";
  if (type === "energy") return "#34d5ff";
  if (type === "shotgun") return "#ff8a4d";
  if (type === "rifle") return "#5dff9d";
  return "#ffd166";
}

function circleHit(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < (a.r || 0) + (b.r || 0);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

async function loadLeaderboard() {
  let scores = [];
  try {
    const response = await fetch("/api/scores");
    if (response.ok) scores = (await response.json()).scores || [];
  } catch (_) {
    scores = JSON.parse(localStorage.getItem("neural-run-scores") || "[]");
  }
  if (scores.length === 0) {
    leaderboardList.innerHTML = "<li>Записей пока нет</li>";
    return;
  }
  leaderboardList.innerHTML = scores
    .slice(0, 10)
    .map((score) => `<li><strong>${escapeHtml(score.player)}</strong> - ${score.score} pts / ${score.kills} kills / ${score.result}</li>`)
    .join("");
}

async function submitScore(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const entry = {
    player: document.getElementById("playerName").value || "runner",
    score: game.score,
    kills: game.kills,
    rooms: game.roomsCleared,
    result: form.dataset.result || "defeat",
    build: game.buildSummary,
  };
  try {
    await fetch("/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch (_) {
    const local = JSON.parse(localStorage.getItem("neural-run-scores") || "[]");
    local.push(entry);
    local.sort((a, b) => b.score - a.score);
    localStorage.setItem("neural-run-scores", JSON.stringify(local.slice(0, 25)));
  }
  await loadLeaderboard();
  showScreen("leaderboard");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  input.pointer.x = ((event.clientX - rect.left) / rect.width) * W;
  input.pointer.y = ((event.clientY - rect.top) / rect.height) * H;
}

window.addEventListener("keydown", (event) => {
  input.keys.add(event.code);
  if (state !== "playing") return;
  if (event.code === "Digit1") queueElement("fire");
  if (event.code === "Digit2") queueElement("ice");
  if (event.code === "Digit3") queueElement("volt");
  if (event.code === "Digit4") queueElement("matter");
  if (event.code === "KeyF") castSpell();
});

window.addEventListener("keyup", (event) => input.keys.delete(event.code));
canvas.addEventListener("mousemove", updatePointer);
canvas.addEventListener("mousedown", (event) => {
  updatePointer(event);
  input.pointer.down = true;
});
window.addEventListener("mouseup", () => {
  input.pointer.down = false;
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

function queueElement(element) {
  game.elementQueue.push(element);
  if (game.elementQueue.length > 2) game.elementQueue.shift();
  updateElementHud();
}

document.getElementById("newRunButton").addEventListener("click", () => {
  renderEditor();
  showScreen("editor");
});
document.getElementById("leaderboardButton").addEventListener("click", async () => {
  await loadLeaderboard();
  showScreen("leaderboard");
});
document.getElementById("backToMenuButton").addEventListener("click", () => showScreen("main"));
document.getElementById("randomizeButton").addEventListener("click", randomizeBuild);
document.getElementById("launchButton").addEventListener("click", launchIntro);
document.getElementById("breachButton").addEventListener("click", startRun);
document.getElementById("againButton").addEventListener("click", () => {
  renderEditor();
  showScreen("editor");
});
document.getElementById("menuButton").addEventListener("click", () => showScreen("main"));
document.getElementById("scoreForm").addEventListener("submit", submitScore);
upgradePanel.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-upgrade]");
  if (button) applyUpgrade(button.dataset.upgrade);
});

initEditor();
drawBackground();

"use strict";

const WORLD_W = 960;
const WORLD_H = 540;
const ROOM = { x: 52, y: 58, w: 856, h: 420 };
const MAX_ROOMS = 6;

const screens = {
  main: document.getElementById("mainMenu"),
  editor: document.getElementById("editorScreen"),
  intro: document.getElementById("introScreen"),
  tutorial: document.getElementById("tutorialScreen"),
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
  pistol: { name: "PISTOL", damage: 18, cooldown: 210, speed: 680, spread: 0.025, count: 1, texture: "weapon_pistol", color: 0xffd166 },
  shotgun: { name: "SHOTGUN", damage: 11, cooldown: 560, speed: 560, spread: 0.2, count: 6, texture: "weapon_shotgun", color: 0xff8a4d },
  rifle: { name: "RIFLE", damage: 13, cooldown: 105, speed: 760, spread: 0.02, count: 1, texture: "weapon_rifle", color: 0x34d5ff },
};

const elementDefs = {
  fire: { key: "1", label: "FIRE", color: "#ff4d6d", tint: 0xff4d6d },
  ice: { key: "2", label: "ICE", color: "#79e7ff", tint: 0x79e7ff },
  volt: { key: "3", label: "VOLT", color: "#ffe45e", tint: 0xffe45e },
  matter: { key: "4", label: "MATTER", color: "#a0ff8f", tint: 0xa0ff8f },
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

const run = {
  build: {},
  buildSummary: "",
  risk: 0,
  room: 1,
  score: 0,
  kills: 0,
  roomsCleared: 0,
  elementQueue: [],
  runEnded: false,
  lastResult: "defeat",
};

let uiState = "main";
let sceneRef = null;

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("screen-active"));
  if (screens[name]) screens[name].classList.add("screen-active");
  hud.hidden = name !== "playing";
  uiState = name;
  if (sceneRef) sceneRef.setGameplayActive(name === "playing");
}

function initEditor() {
  editorGroups.forEach((group) => {
    run.build[group.key] = group.options[0].id;
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
      button.classList.toggle("selected", run.build[group.key] === option.id);
      button.addEventListener("click", () => {
        run.build[group.key] = option.id;
        renderEditor();
      });
      options.appendChild(button);
    });

    row.append(label, options);
    nodeRows.appendChild(row);
  });

  const forecast = getBuildForecast();
  run.risk = forecast.risk;
  run.buildSummary = forecast.summary;
  riskLabel.textContent = `RISK ${forecast.risk}%`;
  buildStats.innerHTML = forecast.lines.map((line) => `<div>${line}</div>`).join("");
  renderModelPreview(forecast);
}

function getSelectedOption(groupKey) {
  const group = editorGroups.find((item) => item.key === groupKey);
  return group.options.find((option) => option.id === run.build[groupKey]);
}

function getBuildForecast() {
  const selected = editorGroups.map((group) => getSelectedOption(group.key));
  const risk = clamp(selected.reduce((sum, option) => sum + option.risk, 50), 18, 96);
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
    run.build[group.key] = pick.id;
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
  if (sceneRef) sceneRef.resetRun();
  showScreen("playing");
}

function updateHud(scene) {
  if (!scene || !scene.player) return;
  hpBar.style.width = `${clamp((scene.playerStats.hp / scene.playerStats.maxHp) * 100, 0, 100)}%`;
  energyBar.style.width = `${clamp((scene.playerStats.energy / scene.playerStats.maxEnergy) * 100, 0, 100)}%`;
  roomLabel.textContent = scene.boss ? "CORE" : `ROOM ${String(run.room).padStart(2, "0")}`;
  weaponLabel.textContent = weapons[scene.playerStats.weapon].name;
  scoreLabel.textContent = `${Math.floor(run.score)} / ${run.kills}K`;
  upgradePanel.hidden = scene.playerStats.upgradePoints <= 0 || !scene.roomClear;
  updateElementHud();
}

function updateElementHud() {
  const active = run.elementQueue.map((element) => elementDefs[element]);
  const emptyCount = Math.max(0, 2 - active.length);
  elementQueue.innerHTML = [
    ...active.map((element) => `<span class="element-pill" style="border-color:${element.color};color:${element.color}">${element.label}</span>`),
    ...Array.from({ length: emptyCount }, () => `<span class="element-pill">EMPTY</span>`),
  ].join("");
}

class RunScene extends Phaser.Scene {
  constructor() {
    super("RunScene");
  }

  create() {
    sceneRef = this;
    createTextures(this);

    this.activeGameplay = false;
    this.roomSprites = [];
    this.decorSprites = [];
    this.message = "";
    this.messageUntil = 0;
    this.walkClock = 0;
    this.nextShotAt = 0;
    this.nextSpellAt = 0;
    this.dashReadyAt = 0;
    this.lastDamageAt = 0;
    this.roomClear = false;
    this.boss = null;

    this.floorLayer = this.add.layer().setDepth(0);
    this.decoLayer = this.add.layer().setDepth(2);
    this.weaponSprite = this.add.image(0, 0, "weapon_pistol").setDepth(16).setOrigin(0.08, 0.5);
    this.messageText = this.add.text(WORLD_W / 2, 92, "", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#f8fafc",
      backgroundColor: "rgba(0,0,0,0.62)",
      padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setDepth(80);

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
      arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
      arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      dash: Phaser.Input.Keyboard.KeyCodes.SPACE,
      spell: Phaser.Input.Keyboard.KeyCodes.F,
      e1: Phaser.Input.Keyboard.KeyCodes.ONE,
      e2: Phaser.Input.Keyboard.KeyCodes.TWO,
      e3: Phaser.Input.Keyboard.KeyCodes.THREE,
      e4: Phaser.Input.Keyboard.KeyCodes.FOUR,
    });

    this.walls = this.physics.add.staticGroup();
    this.obstacles = this.physics.add.staticGroup();
    this.pickups = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.bossGroup = this.physics.add.group();
    this.playerBullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();

    this.player = this.physics.add.sprite(ROOM.x + 90, ROOM.y + ROOM.h / 2, "player_idle");
    this.player.setDepth(15).setCollideWorldBounds(false);
    this.player.body.setSize(18, 22).setOffset(5, 6);
    this.player.body.setDrag(1180, 1180).setMaxVelocity(250, 250);

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.playerBullets, this.walls, (bullet) => bullet.destroy());
    this.physics.add.collider(this.playerBullets, this.obstacles, (bullet) => {
      this.emitBurst(bullet.x, bullet.y, bullet.getData("tint") || 0xffffff, 5);
      bullet.destroy();
    });
    this.physics.add.collider(this.enemyBullets, this.walls, (bullet) => bullet.destroy());
    this.physics.add.collider(this.enemyBullets, this.obstacles, (bullet) => bullet.destroy());
    this.physics.add.overlap(this.playerBullets, this.enemies, this.onBulletEnemy, undefined, this);
    this.physics.add.overlap(this.playerBullets, this.bossGroup, this.onBulletBoss, undefined, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.onEnemyBulletPlayer, undefined, this);
    this.physics.add.overlap(this.pickups, this.player, this.onPickup, undefined, this);
    this.physics.add.overlap(this.enemies, this.player, this.onEnemyBodyHit, undefined, this);
    this.physics.add.overlap(this.bossGroup, this.player, this.onBossBodyHit, undefined, this);

    this.input.on("pointerdown", () => {
      if (uiState === "playing") this.input.mouse.requestPointerLock?.();
    });

    this.drawMenuBackdrop();
    this.setGameplayActive(false);
  }

  setGameplayActive(active) {
    this.activeGameplay = active;
    this.physics.world.isPaused = !active;
    this.messageText.setVisible(active);
  }

  resetRun() {
    run.room = 1;
    run.score = 0;
    run.kills = 0;
    run.roomsCleared = 0;
    run.runEnded = false;
    run.lastResult = "defeat";
    run.elementQueue = [];

    this.playerStats = {
      hp: 120,
      maxHp: 120,
      energy: 100,
      maxEnergy: 100,
      damageBonus: 1,
      speedBonus: 1,
      weapon: "pistol",
      upgradePoints: 0,
    };

    this.clearRoomObjects();
    this.player.enableBody(true, ROOM.x + 92, ROOM.y + ROOM.h / 2, true, true);
    this.player.setVelocity(0, 0);
    this.player.setTexture("player_idle").clearTint();
    this.weaponSprite.setVisible(true).setTexture("weapon_pistol");
    this.createRoom();
    updateHud(this);
  }

  update(time, deltaMs) {
    if (!this.activeGameplay || !this.player?.active || run.runEnded) return;
    const dt = deltaMs / 1000;

    this.updatePlayer(time, dt);
    this.updateEnemies(time, dt);
    this.updateBoss(time, dt);
    this.updateProjectiles(dt);
    this.updatePickups();
    this.updateMessage(time);
    this.checkRoomState();

    this.playerStats.energy = Math.min(this.playerStats.maxEnergy, this.playerStats.energy + dt * 16);
    updateHud(this);
  }

  drawMenuBackdrop() {
    this.clearRoomObjects();
    this.createRoomFloor(12345, true);
    this.messageText.setVisible(false);
    this.weaponSprite.setVisible(false);
  }

  createRoom() {
    this.clearRoomObjects();
    this.roomClear = false;
    this.boss = null;
    this.bossGroup.clear(true, true);

    this.createRoomFloor(9000 + run.room * 101, false);
    this.createWalls();
    this.createDecorations(44000 + run.room * 137);

    if (run.room >= MAX_ROOMS) {
      this.createBoss();
      this.showMessage("ESCAPED MODEL CORE", 2600);
      return;
    }

    const count = 3 + run.room * 2;
    for (let i = 0; i < count; i += 1) {
      this.spawnEnemy(this.pickEnemyType(i));
    }
    this.showMessage(`LAB BLOCK ${String(run.room).padStart(2, "0")}`, 1800);
  }

  clearRoomObjects() {
    this.roomSprites.forEach((sprite) => sprite.destroy());
    this.decorSprites.forEach((sprite) => sprite.destroy());
    this.roomSprites = [];
    this.decorSprites = [];
    this.walls?.clear(true, true);
    this.obstacles?.clear(true, true);
    this.pickups?.clear(true, true);
    this.enemies?.clear(true, true);
    this.bossGroup?.clear(true, true);
    this.playerBullets?.clear(true, true);
    this.enemyBullets?.clear(true, true);
  }

  createRoomFloor(seed, menuMode) {
    const rand = seeded(seed);
    const tileKeys = ["tile_a", "tile_b", "tile_c", "tile_d"];
    for (let x = ROOM.x; x < ROOM.x + ROOM.w; x += 32) {
      for (let y = ROOM.y; y < ROOM.y + ROOM.h; y += 32) {
        const key = tileKeys[Math.floor(rand() * tileKeys.length)];
        const tile = this.add.image(x + 16, y + 16, key).setDepth(0);
        this.floorLayer.add(tile);
        this.roomSprites.push(tile);
      }
    }

    const glow = this.add.rectangle(ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h / 2, ROOM.w, ROOM.h, menuMode ? 0x113344 : 0x101827, 0.18)
      .setDepth(1);
    this.roomSprites.push(glow);
  }

  createWalls() {
    const wallColor = 0x293442;
    this.addWall(ROOM.x + ROOM.w / 2, ROOM.y - 8, ROOM.w + 34, 22, wallColor);
    this.addWall(ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h + 8, ROOM.w + 34, 22, wallColor);
    this.addWall(ROOM.x - 8, ROOM.y + ROOM.h / 2, 22, ROOM.h + 34, wallColor);
    this.addWall(ROOM.x + ROOM.w + 8, ROOM.y + ROOM.h / 2 - 104, 22, 208, wallColor);
    this.addWall(ROOM.x + ROOM.w + 8, ROOM.y + ROOM.h / 2 + 104, 22, 208, wallColor);
    this.rightDoorBlocker = this.addWall(ROOM.x + ROOM.w + 8, ROOM.y + ROOM.h / 2, 22, 78, 0x4b5563);

    const doorLight = this.add.rectangle(ROOM.x + ROOM.w + 1, ROOM.y + ROOM.h / 2, 8, 70, 0xff4d6d, 0.72).setDepth(6);
    this.doorLight = doorLight;
    this.decorSprites.push(doorLight);
  }

  addWall(x, y, w, h, color) {
    const sprite = this.walls.create(x, y, "solid");
    sprite.setDisplaySize(w, h).setTint(color).refreshBody().setDepth(5);
    this.roomSprites.push(sprite);
    return sprite;
  }

  createDecorations(seed) {
    const rand = seeded(seed);
    this.addCables(rand);

    const obstacleSpots = [
      [ROOM.x + 170, ROOM.y + 105, "server_rack"],
      [ROOM.x + 334, ROOM.y + 322, "glass_tank"],
      [ROOM.x + 502, ROOM.y + 126, "lab_table"],
      [ROOM.x + 690, ROOM.y + 330, "server_rack"],
    ];

    obstacleSpots.forEach(([x, y, key], index) => {
      if (run.room % 2 === index % 2 || index < 2) {
        const obstacle = this.obstacles.create(x + rand() * 24 - 12, y + rand() * 24 - 12, key);
        obstacle.refreshBody().setDepth(8);
        this.decorSprites.push(obstacle);
      }
    });

    for (let i = 0; i < 18; i += 1) {
      const key = rand() > 0.62 ? "floor_rune" : rand() > 0.45 ? "warning_panel" : "cable_junction";
      const x = ROOM.x + 64 + rand() * (ROOM.w - 128);
      const y = ROOM.y + 48 + rand() * (ROOM.h - 96);
      const deco = this.add.image(x, y, key).setDepth(key === "floor_rune" ? 1 : 3);
      deco.setRotation(Math.floor(rand() * 4) * Math.PI / 2);
      deco.setAlpha(key === "floor_rune" ? 0.72 : 1);
      this.decorSprites.push(deco);
    }

    for (let i = 0; i < 10; i += 1) {
      const light = this.add.rectangle(
        ROOM.x + 24 + i * 86,
        ROOM.y + (i % 2 === 0 ? 8 : ROOM.h - 8),
        34,
        5,
        i % 3 === 0 ? 0xff4d6d : 0x34d5ff,
        0.78,
      ).setDepth(7);
      this.decorSprites.push(light);
    }
  }

  addCables(rand) {
    const cable = this.add.graphics().setDepth(2);
    for (let i = 0; i < 7; i += 1) {
      const y = ROOM.y + 44 + rand() * (ROOM.h - 88);
      cable.lineStyle(2, rand() > 0.5 ? 0x34d5ff : 0xb978ff, 0.35);
      cable.beginPath();
      cable.moveTo(ROOM.x + 24, y);
      cable.lineTo(ROOM.x + 120 + rand() * 160, y + rand() * 34 - 17);
      cable.lineTo(ROOM.x + 360 + rand() * 180, y + rand() * 44 - 22);
      cable.lineTo(ROOM.x + ROOM.w - 24, y + rand() * 34 - 17);
      cable.strokePath();
    }
    this.decorSprites.push(cable);
  }

  updatePlayer(time, dt) {
    const left = this.keys.left.isDown || this.keys.arrowLeft.isDown;
    const right = this.keys.right.isDown || this.keys.arrowRight.isDown;
    const up = this.keys.up.isDown || this.keys.arrowUp.isDown;
    const down = this.keys.down.isDown || this.keys.arrowDown.isDown;
    const running = this.keys.shift.isDown;

    let dx = (right ? 1 : 0) - (left ? 1 : 0);
    let dy = (down ? 1 : 0) - (up ? 1 : 0);
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    const maxSpeed = (running ? 290 : 215) * this.playerStats.speedBonus;
    const accel = running ? 1460 : 1160;
    this.player.body.setMaxVelocity(maxSpeed, maxSpeed);
    this.player.setAcceleration(dx * accel, dy * accel);

    if (Phaser.Input.Keyboard.JustDown(this.keys.dash) && time > this.dashReadyAt) {
      const dashX = len > 0 ? dx : Math.cos(this.pointerAngle());
      const dashY = len > 0 ? dy : Math.sin(this.pointerAngle());
      this.player.setVelocity(dashX * 560, dashY * 560);
      this.dashReadyAt = time + 780;
      this.emitBurst(this.player.x, this.player.y, 0x5dff9d, 18);
      this.cameras.main.shake(90, 0.004);
    }

    this.player.x = clamp(this.player.x, ROOM.x + 18, ROOM.x + ROOM.w - 18);
    this.player.y = clamp(this.player.y, ROOM.y + 18, ROOM.y + ROOM.h - 18);

    this.updateWalkAnimation(dt, len > 0, running);
    this.updateWeaponSprite();

    if (this.input.activePointer.isDown) this.fireWeapon(time);
    if (Phaser.Input.Keyboard.JustDown(this.keys.e1)) this.queueElement("fire");
    if (Phaser.Input.Keyboard.JustDown(this.keys.e2)) this.queueElement("ice");
    if (Phaser.Input.Keyboard.JustDown(this.keys.e3)) this.queueElement("volt");
    if (Phaser.Input.Keyboard.JustDown(this.keys.e4)) this.queueElement("matter");
    if (Phaser.Input.Keyboard.JustDown(this.keys.spell)) this.castSpell(time);
  }

  updateWalkAnimation(dt, moving, running) {
    if (!moving) {
      this.player.setTexture("player_idle");
      return;
    }
    this.walkClock += dt * (running ? 14 : 10);
    const frame = Math.floor(this.walkClock) % 4;
    this.player.setTexture(`player_walk_${frame}`);
  }

  updateWeaponSprite() {
    const angle = this.pointerAngle();
    const weapon = weapons[this.playerStats.weapon];
    this.weaponSprite.setTexture(weapon.texture);
    this.weaponSprite.setPosition(
      this.player.x + Math.cos(angle) * 13,
      this.player.y + Math.sin(angle) * 13,
    );
    this.weaponSprite.setRotation(angle);
    this.weaponSprite.setFlipY(Math.cos(angle) < 0);
  }

  pointerAngle() {
    const pointer = this.input.activePointer;
    return Math.atan2(pointer.worldY - this.player.y, pointer.worldX - this.player.x);
  }

  fireWeapon(time) {
    if (time < this.nextShotAt) return;
    const weapon = weapons[this.playerStats.weapon];
    this.nextShotAt = time + weapon.cooldown;
    const angle = this.pointerAngle();

    for (let i = 0; i < weapon.count; i += 1) {
      const offset = (i - (weapon.count - 1) / 2) * weapon.spread + Phaser.Math.FloatBetween(-weapon.spread, weapon.spread);
      this.spawnProjectile(this.playerBullets, {
        x: this.player.x + Math.cos(angle) * 27,
        y: this.player.y + Math.sin(angle) * 27,
        angle: angle + offset,
        speed: weapon.speed,
        damage: weapon.damage * this.playerStats.damageBonus,
        tint: weapon.color,
        texture: "bullet_player",
        life: 900,
      });
    }
    this.emitBurst(this.player.x + Math.cos(angle) * 24, this.player.y + Math.sin(angle) * 24, weapon.color, 4);
  }

  queueElement(element) {
    run.elementQueue.push(element);
    if (run.elementQueue.length > 2) run.elementQueue.shift();
    updateElementHud();
  }

  castSpell(time) {
    if (time < this.nextSpellAt || this.playerStats.energy < 28 || run.elementQueue.length === 0) return;
    this.playerStats.energy -= 28;
    this.nextSpellAt = time + 640;

    const combo = [...run.elementQueue].sort().join("+");
    const angle = this.pointerAngle();
    const primary = run.elementQueue[run.elementQueue.length - 1];
    const tint = elementDefs[primary].tint;

    if (combo === "fire+volt") {
      this.chainLightning();
      this.showMessage("PLASMA ARC", 1000);
    } else if (combo === "ice+matter") {
      this.freezeWave();
      this.showMessage("CRYO WALL", 1000);
    } else if (combo === "fire+matter") {
      this.placeMine(angle);
      this.showMessage("LAVA MINE", 1000);
    } else if (combo === "ice+volt") {
      this.spawnProjectile(this.playerBullets, {
        x: this.player.x,
        y: this.player.y,
        angle,
        speed: 420,
        damage: 52,
        tint: 0xb8f7ff,
        texture: "spell_orb",
        life: 1300,
        element: "ice",
      });
      this.showMessage("FROST DISCHARGE", 1000);
    } else if (combo === "matter+volt") {
      this.magnetPulse();
      this.showMessage("MAGNET TRAP", 1000);
    } else if (combo === "fire+ice") {
      this.steamBlast();
      this.showMessage("STEAM BURST", 1000);
    } else {
      this.spawnProjectile(this.playerBullets, {
        x: this.player.x,
        y: this.player.y,
        angle,
        speed: 510,
        damage: 38,
        tint,
        texture: "spell_orb",
        life: 1100,
        element: primary,
      });
      this.showMessage(`${elementDefs[primary].label} CAST`, 1000);
    }
  }

  spawnProjectile(group, spec) {
    const bullet = this.physics.add.image(spec.x, spec.y, spec.texture || "bullet_player");
    bullet.setDepth(18).setTint(spec.tint || 0xffffff);
    bullet.body.setSize(8, 8);
    bullet.setVelocity(Math.cos(spec.angle) * spec.speed, Math.sin(spec.angle) * spec.speed);
    bullet.setData("damage", spec.damage);
    bullet.setData("life", spec.life || 900);
    bullet.setData("element", spec.element || null);
    bullet.setData("tint", spec.tint || 0xffffff);
    group.add(bullet);
    return bullet;
  }

  updateProjectiles(dt) {
    [this.playerBullets, this.enemyBullets].forEach((group) => {
      group.children.each((bullet) => {
        if (!bullet.active) return;
        bullet.setData("life", bullet.getData("life") - dt * 1000);
        if (
          bullet.getData("life") <= 0 ||
          bullet.x < ROOM.x - 18 ||
          bullet.x > ROOM.x + ROOM.w + 18 ||
          bullet.y < ROOM.y - 18 ||
          bullet.y > ROOM.y + ROOM.h + 18
        ) {
          bullet.destroy();
        }
      });
    });
  }

  onBulletEnemy(bullet, enemy) {
    const damage = bullet.getData("damage") || 0;
    enemy.setData("hp", enemy.getData("hp") - damage);
    const element = bullet.getData("element");
    if (element === "ice") enemy.setData("stunUntil", this.time.now + 800);
    if (element === "fire") enemy.setData("burnUntil", this.time.now + 1200);
    this.emitBurst(bullet.x, bullet.y, bullet.getData("tint") || 0xffffff, 8);
    bullet.destroy();
    if (enemy.getData("hp") <= 0) this.killEnemy(enemy);
  }

  onBulletBoss(bullet, boss) {
    boss.setData("hp", boss.getData("hp") - (bullet.getData("damage") || 0));
    this.emitBurst(bullet.x, bullet.y, bullet.getData("tint") || 0xffffff, 10);
    bullet.destroy();
    if (boss.getData("hp") <= 0) {
      run.score += 1400;
      run.roomsCleared += 1;
      this.endRun(true);
    }
  }

  onEnemyBulletPlayer(player, bullet) {
    this.damagePlayer(13 + run.room * 2);
    this.emitBurst(bullet.x, bullet.y, 0xff4d6d, 8);
    bullet.destroy();
  }

  onEnemyBodyHit(player, enemy) {
    this.damagePlayer(enemy.getData("type") === "arm" ? 15 : 9);
  }

  onBossBodyHit() {
    this.damagePlayer(18);
  }

  damagePlayer(amount) {
    const now = this.time.now;
    if (now < this.lastDamageAt + 420 || run.runEnded) return;
    this.lastDamageAt = now;
    this.playerStats.hp -= amount;
    this.player.setTint(0xffffff);
    this.time.delayedCall(90, () => this.player.clearTint());
    this.cameras.main.shake(120, 0.007);
    this.emitBurst(this.player.x, this.player.y, 0xffffff, 12);
    if (this.playerStats.hp <= 0) this.endRun(false);
  }

  pickEnemyType(index) {
    if (run.room >= 3 && index % 5 === 0) return "arm";
    if (run.room >= 2 && index % 4 === 0) return "turret";
    if (run.room >= 2 && index % 3 === 0) return "drone";
    return "robot";
  }

  spawnEnemy(type, atX, atY) {
    const point = atX === undefined ? this.findSpawnPoint() : { x: atX, y: atY };
    const texture = `enemy_${type}`;
    const enemy = this.physics.add.sprite(point.x, point.y, texture).setDepth(14);
    const hp = type === "arm" ? 88 + run.room * 10 : type === "turret" ? 72 + run.room * 10 : 42 + run.room * 8;
    enemy.setData({
      type,
      hp,
      maxHp: hp,
      cooldownAt: this.time.now + Phaser.Math.Between(400, 1400),
      stunUntil: 0,
      burnUntil: 0,
      phase: Math.random() * Math.PI * 2,
    });
    enemy.body.setDrag(650, 650);
    enemy.body.setSize(type === "drone" ? 18 : 24, type === "drone" ? 18 : 24);
    this.enemies.add(enemy);
    return enemy;
  }

  findSpawnPoint() {
    for (let i = 0; i < 40; i += 1) {
      const point = {
        x: Phaser.Math.Between(ROOM.x + 110, ROOM.x + ROOM.w - 96),
        y: Phaser.Math.Between(ROOM.y + 70, ROOM.y + ROOM.h - 70),
      };
      if (Phaser.Math.Distance.Between(point.x, point.y, this.player.x, this.player.y) > 180) return point;
    }
    return { x: ROOM.x + ROOM.w - 120, y: ROOM.y + ROOM.h / 2 };
  }

  updateEnemies(time, dt) {
    this.enemies.children.each((enemy) => {
      if (!enemy.active) return;
      const type = enemy.getData("type");
      const burnUntil = enemy.getData("burnUntil") || 0;
      if (time < burnUntil) enemy.setData("hp", enemy.getData("hp") - dt * 14);
      if (enemy.getData("hp") <= 0) {
        this.killEnemy(enemy);
        return;
      }

      if (time < (enemy.getData("stunUntil") || 0)) {
        enemy.setVelocity(0, 0);
        return;
      }

      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      const cooldownAt = enemy.getData("cooldownAt") || 0;
      const phase = (enemy.getData("phase") || 0) + dt;
      enemy.setData("phase", phase);

      if (type === "robot") {
        this.physics.velocityFromRotation(angle, 120 + run.room * 5, enemy.body.velocity);
      } else if (type === "drone") {
        const orbit = angle + Math.sin(phase * 3.2) * 0.9;
        this.physics.velocityFromRotation(orbit, 170 + run.room * 4, enemy.body.velocity);
        if (time > cooldownAt) {
          enemy.setData("cooldownAt", time + 1150);
          this.enemyShot(enemy, angle, 0xff4d6d);
        }
      } else if (type === "turret") {
        enemy.setVelocity(0, 0);
        enemy.setRotation(angle);
        if (time > cooldownAt) {
          enemy.setData("cooldownAt", time + 980 + Math.random() * 300);
          this.enemyShot(enemy, angle, 0xff4d6d);
        }
      } else if (type === "arm") {
        this.physics.velocityFromRotation(angle + Math.sin(phase * 2) * 0.25, 58, enemy.body.velocity);
        enemy.setRotation(angle);
        if (time > cooldownAt) {
          enemy.setData("cooldownAt", time + 1500);
          this.armStrike(enemy, angle);
        }
      }

      enemy.x = clamp(enemy.x, ROOM.x + 22, ROOM.x + ROOM.w - 22);
      enemy.y = clamp(enemy.y, ROOM.y + 22, ROOM.y + ROOM.h - 22);
    });
  }

  enemyShot(enemy, angle, tint) {
    this.spawnProjectile(this.enemyBullets, {
      x: enemy.x + Math.cos(angle) * 20,
      y: enemy.y + Math.sin(angle) * 20,
      angle,
      speed: 270 + run.room * 18,
      damage: 13,
      tint,
      texture: "bullet_enemy",
      life: 2200,
    });
  }

  armStrike(enemy, angle) {
    const tipX = enemy.x + Math.cos(angle) * 76;
    const tipY = enemy.y + Math.sin(angle) * 76;
    const slash = this.add.image(tipX, tipY, "arm_slash").setDepth(20).setRotation(angle).setAlpha(0.85);
    this.tweens.add({ targets: slash, alpha: 0, scaleX: 1.5, scaleY: 1.4, duration: 160, onComplete: () => slash.destroy() });
    if (Phaser.Math.Distance.Between(tipX, tipY, this.player.x, this.player.y) < 36) this.damagePlayer(20);
  }

  killEnemy(enemy) {
    if (!enemy.active) return;
    const type = enemy.getData("type");
    run.kills += 1;
    run.score += type === "turret" ? 95 : type === "arm" ? 130 : 65;
    if (run.kills % 5 === 0) this.playerStats.upgradePoints += 1;
    this.emitBurst(enemy.x, enemy.y, enemyTint(type), 22);
    if (Math.random() < 0.2) this.spawnPickup(enemy.x, enemy.y, Math.random() < 0.5 ? "health" : "energy");
    enemy.destroy();
  }

  createBoss() {
    const forecast = getBuildForecast();
    const boss = this.physics.add.sprite(ROOM.x + ROOM.w * 0.68, ROOM.y + ROOM.h / 2, "boss_core").setDepth(14);
    const hp = 680 + forecast.risk * 5;
    boss.setData({
      hp,
      maxHp: hp,
      phase: 1,
      traits: forecast.traits,
      cooldownAt: this.time.now + 900,
      summonAt: this.time.now + 3000,
      dashAt: this.time.now + 2400,
    });
    boss.body.setSize(56, 56);
    boss.body.setDrag(900, 900);
    this.boss = boss;
    this.bossGroup.add(boss);
  }

  updateBoss(time) {
    if (!this.boss?.active) return;
    const boss = this.boss;
    const hp = boss.getData("hp");
    const maxHp = boss.getData("maxHp");
    const phase = hp < maxHp * 0.34 ? 3 : hp < maxHp * 0.67 ? 2 : 1;
    boss.setData("phase", phase);
    boss.setRotation(boss.rotation + 0.014 * phase);

    const traits = boss.getData("traits") || [];
    const angle = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y);
    const driftSpeed = traits.includes("dash") ? 38 : 26;
    this.physics.velocityFromRotation(angle + Math.sin(time / 700) * 0.4, driftSpeed, boss.body.velocity);

    if (time > boss.getData("cooldownAt")) {
      boss.setData("cooldownAt", time + (phase === 3 ? 690 : 1060));
      this.bossVolley(boss, angle, phase);
    }
    if (traits.includes("summon") && time > boss.getData("summonAt")) {
      boss.setData("summonAt", time + 3900);
      this.spawnEnemy(Math.random() < 0.5 ? "drone" : "robot", boss.x + Phaser.Math.Between(-90, 90), boss.y + Phaser.Math.Between(-70, 70));
    }
    if (traits.includes("dash") && time > boss.getData("dashAt")) {
      boss.setData("dashAt", time + 3200);
      boss.setVelocity(Math.cos(angle) * 360, Math.sin(angle) * 360);
      this.emitBurst(boss.x, boss.y, 0xff4d6d, 22);
    }

    boss.x = clamp(boss.x, ROOM.x + 42, ROOM.x + ROOM.w - 42);
    boss.y = clamp(boss.y, ROOM.y + 42, ROOM.y + ROOM.h - 42);
  }

  bossVolley(boss, angle, phase) {
    const traits = boss.getData("traits") || [];
    const tint = traits.includes("ice") ? 0x79e7ff : traits.includes("matter") ? 0xa0ff8f : 0xff4d6d;
    if (phase === 1) {
      [-0.18, 0, 0.18].forEach((offset) => {
        this.spawnProjectile(this.enemyBullets, {
          x: boss.x,
          y: boss.y,
          angle: angle + offset,
          speed: 315,
          damage: 16,
          tint,
          texture: "bullet_enemy",
          life: 2400,
        });
      });
      return;
    }

    const count = phase === 3 ? 14 : 9;
    for (let i = 0; i < count; i += 1) {
      this.spawnProjectile(this.enemyBullets, {
        x: boss.x,
        y: boss.y,
        angle: boss.rotation + (Math.PI * 2 * i) / count,
        speed: 210 + phase * 34,
        damage: 13,
        tint,
        texture: "bullet_enemy",
        life: 2700,
      });
    }
  }

  chainLightning() {
    const targets = this.enemies.getChildren()
      .filter((enemy) => enemy.active)
      .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, this.player.x, this.player.y) - Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y))
      .slice(0, 4);
    targets.forEach((enemy, index) => {
      enemy.setData("hp", enemy.getData("hp") - (62 - index * 8));
      enemy.setData("stunUntil", this.time.now + 420);
      this.drawLightning(this.player.x, this.player.y, enemy.x, enemy.y, 0xffe45e);
      if (enemy.getData("hp") <= 0) this.killEnemy(enemy);
    });
    if (this.boss?.active) {
      this.boss.setData("hp", this.boss.getData("hp") - 44);
      this.drawLightning(this.player.x, this.player.y, this.boss.x, this.boss.y, 0xffe45e);
    }
  }

  freezeWave() {
    this.enemies.children.each((enemy) => {
      if (!enemy.active) return;
      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 180) {
        enemy.setData("hp", enemy.getData("hp") - 24);
        enemy.setData("stunUntil", this.time.now + 1350);
        this.emitBurst(enemy.x, enemy.y, 0x79e7ff, 12);
        if (enemy.getData("hp") <= 0) this.killEnemy(enemy);
      }
    });
    if (this.boss?.active && Phaser.Math.Distance.Between(this.boss.x, this.boss.y, this.player.x, this.player.y) < 200) {
      this.boss.setData("cooldownAt", this.boss.getData("cooldownAt") + 420);
      this.boss.setData("hp", this.boss.getData("hp") - 28);
    }
  }

  placeMine(angle) {
    const x = this.player.x + Math.cos(angle) * 88;
    const y = this.player.y + Math.sin(angle) * 88;
    const mine = this.add.image(x, y, "mine").setDepth(12);
    this.decorSprites.push(mine);
    this.tweens.add({
      targets: mine,
      scale: 1.25,
      yoyo: true,
      repeat: 2,
      duration: 170,
      onComplete: () => {
        this.explode(x, y, 92, 78, 0xff6b35);
        mine.destroy();
      },
    });
  }

  magnetPulse() {
    this.enemies.children.each((enemy) => {
      if (!enemy.active) return;
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      enemy.setVelocity(Math.cos(angle) * 360, Math.sin(angle) * 360);
      enemy.setData("hp", enemy.getData("hp") - 24);
      enemy.setData("stunUntil", this.time.now + 360);
      this.emitBurst(enemy.x, enemy.y, 0xa0ff8f, 8);
      if (enemy.getData("hp") <= 0) this.killEnemy(enemy);
    });
  }

  steamBlast() {
    for (let i = 0; i < 18; i += 1) {
      this.spawnProjectile(this.playerBullets, {
        x: this.player.x,
        y: this.player.y,
        angle: (Math.PI * 2 * i) / 18,
        speed: 320 + Math.random() * 160,
        damage: 20,
        tint: 0xd6f4ff,
        texture: "spell_orb",
        life: 460,
      });
    }
  }

  explode(x, y, radius, damage, tint) {
    this.emitBurst(x, y, tint, 34);
    this.cameras.main.shake(110, 0.006);
    this.enemies.children.each((enemy) => {
      if (!enemy.active) return;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) < radius) {
        enemy.setData("hp", enemy.getData("hp") - damage);
        if (enemy.getData("hp") <= 0) this.killEnemy(enemy);
      }
    });
    if (this.boss?.active && Phaser.Math.Distance.Between(x, y, this.boss.x, this.boss.y) < radius + 34) {
      this.boss.setData("hp", this.boss.getData("hp") - damage);
    }
  }

  drawLightning(x1, y1, x2, y2, tint) {
    const line = this.add.graphics().setDepth(22);
    line.lineStyle(3, tint, 0.9);
    line.beginPath();
    line.moveTo(x1, y1);
    const segments = 5;
    for (let i = 1; i < segments; i += 1) {
      const t = i / segments;
      line.lineTo(
        Phaser.Math.Linear(x1, x2, t) + Phaser.Math.Between(-14, 14),
        Phaser.Math.Linear(y1, y2, t) + Phaser.Math.Between(-14, 14),
      );
    }
    line.lineTo(x2, y2);
    line.strokePath();
    this.tweens.add({ targets: line, alpha: 0, duration: 130, onComplete: () => line.destroy() });
  }

  emitBurst(x, y, tint, count) {
    for (let i = 0; i < count; i += 1) {
      const particle = this.add.image(x, y, "pixel")
        .setTint(tint)
        .setDepth(40)
        .setDisplaySize(Phaser.Math.Between(3, 8), Phaser.Math.Between(3, 8));
      const angle = Math.random() * Math.PI * 2;
      const distance = Phaser.Math.Between(18, 62);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: Phaser.Math.Between(180, 440),
        onComplete: () => particle.destroy(),
      });
    }
  }

  spawnPickup(x, y, type) {
    const texture = type === "health" ? "pickup_health" : type === "energy" ? "pickup_energy" : `pickup_${type}`;
    const pickup = this.physics.add.image(x, y, texture).setDepth(13);
    pickup.setData("type", type);
    pickup.body.setCircle(12);
    this.pickups.add(pickup);
    this.tweens.add({ targets: pickup, y: y - 5, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  updatePickups() {
    if (this.roomClear && this.player.x > ROOM.x + ROOM.w - 18) this.nextRoom();
  }

  onPickup(player, pickup) {
    const type = pickup.getData("type");
    if (weapons[type]) {
      this.playerStats.weapon = type;
      this.weaponSprite.setTexture(weapons[type].texture);
      this.showMessage(`${weapons[type].name} ONLINE`, 1200);
    } else if (type === "health") {
      this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + 34);
      this.showMessage("MED FOAM", 1000);
    } else if (type === "energy") {
      this.playerStats.energy = Math.min(this.playerStats.maxEnergy, this.playerStats.energy + 46);
      this.showMessage("CAPACITOR", 1000);
    }
    pickup.destroy();
  }

  checkRoomState() {
    if (this.boss?.active || this.roomClear || this.enemies.countActive(true) > 0) return;
    this.roomClear = true;
    run.roomsCleared += 1;
    run.score += 170 + run.room * 55;
    this.playerStats.upgradePoints += 1;
    this.openDoor();
    this.spawnRoomRewards();
    this.showMessage("ROOM STABLE", 1500);
  }

  openDoor() {
    this.rightDoorBlocker?.destroy();
    this.doorLight?.setFillStyle(0x5dff9d, 0.85);
  }

  spawnRoomRewards() {
    const centerX = ROOM.x + ROOM.w * 0.52;
    const centerY = ROOM.y + ROOM.h * 0.5;
    const first = ["shotgun", "rifle", "health", "energy"][Math.floor(Math.random() * 4)];
    this.spawnPickup(centerX - 28, centerY, first);
    this.spawnPickup(centerX + 28, centerY, run.room % 2 === 0 ? "rifle" : "shotgun");
  }

  nextRoom() {
    run.room += 1;
    this.player.setPosition(ROOM.x + 58, ROOM.y + ROOM.h / 2);
    this.player.setVelocity(0, 0);
    this.createRoom();
  }

  applyUpgrade(type) {
    if (this.playerStats.upgradePoints <= 0) return;
    this.playerStats.upgradePoints -= 1;
    if (type === "damage") this.playerStats.damageBonus += 0.17;
    if (type === "health") {
      this.playerStats.maxHp += 18;
      this.playerStats.hp += 18;
    }
    if (type === "speed") this.playerStats.speedBonus += 0.07;
    if (type === "energy") {
      this.playerStats.maxEnergy += 20;
      this.playerStats.energy += 20;
    }
    this.showMessage(`${type.toUpperCase()} UPGRADE`, 1000);
  }

  showMessage(text, duration) {
    this.message = text;
    this.messageUntil = this.time.now + duration;
    this.messageText.setText(text).setVisible(true);
  }

  updateMessage(time) {
    if (time > this.messageUntil) this.messageText.setText("");
  }

  endRun(victory) {
    if (run.runEnded) return;
    run.runEnded = true;
    run.lastResult = victory ? "victory" : "defeat";
    run.score = Math.floor(run.score + run.kills * 12 + (victory ? 1500 : 0));
    this.setGameplayActive(false);
    hud.hidden = true;

    document.getElementById("resultEyebrow").textContent = victory ? "MODEL TERMINATED" : "RUN FAILED";
    document.getElementById("resultTitle").textContent = victory ? "Нейросеть уничтожена" : "Комплекс поглотил ран";
    document.getElementById("resultStats").innerHTML = [
      ["Score", run.score],
      ["Kills", run.kills],
      ["Rooms", run.roomsCleared],
    ].map(([label, value]) => `<div class="stat-tile"><span>${label}</span><strong>${value}</strong></div>`).join("");
    document.getElementById("scoreForm").dataset.result = run.lastResult;
    showScreen("gameover");
  }
}

function createTextures(scene) {
  makeTexture(scene, "solid", 4, 4, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 4, 4));
  makeTexture(scene, "pixel", 4, 4, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 4, 4));

  makeTile(scene, "tile_a", 0x161e29, 0x243142, 0x1d2835);
  makeTile(scene, "tile_b", 0x121923, 0x223040, 0x182230);
  makeTile(scene, "tile_c", 0x19212d, 0x314055, 0x1f2a38);
  makeTile(scene, "tile_d", 0x141b24, 0x263344, 0x1a2431);

  makeTexture(scene, "server_rack", 44, 58, (g) => {
    g.fillStyle(0x0b1118).fillRect(0, 0, 44, 58);
    g.fillStyle(0x1f2a38).fillRect(4, 4, 36, 50);
    for (let y = 8; y < 50; y += 10) {
      g.fillStyle(0x34d5ff).fillRect(8, y, 5, 3);
      g.fillStyle(0x5dff9d).fillRect(16, y, 5, 3);
      g.fillStyle(0x64748b).fillRect(26, y, 10, 2);
    }
  });

  makeTexture(scene, "glass_tank", 40, 62, (g) => {
    g.fillStyle(0x0b1118).fillRect(0, 0, 40, 62);
    g.fillStyle(0x12384a, 0.9).fillRect(6, 8, 28, 44);
    g.fillStyle(0x79e7ff, 0.45).fillRect(10, 12, 20, 36);
    g.fillStyle(0xa0ff8f).fillRect(18, 26, 5, 10);
    g.fillStyle(0xe5e7eb).fillRect(8, 6, 24, 3).fillRect(8, 53, 24, 3);
  });

  makeTexture(scene, "lab_table", 58, 34, (g) => {
    g.fillStyle(0x111827).fillRect(0, 0, 58, 34);
    g.fillStyle(0x334155).fillRect(4, 4, 50, 24);
    g.fillStyle(0xffd166).fillRect(10, 9, 12, 5);
    g.fillStyle(0xb978ff).fillRect(30, 8, 14, 8);
    g.fillStyle(0x94a3b8).fillRect(8, 28, 42, 3);
  });

  makeTexture(scene, "floor_rune", 34, 34, (g) => {
    g.lineStyle(2, 0xb978ff, 0.8).strokeRect(5, 5, 24, 24);
    g.lineStyle(1, 0x34d5ff, 0.8).strokeCircle(17, 17, 10);
    g.fillStyle(0xb978ff, 0.7).fillRect(15, 15, 4, 4);
  });

  makeTexture(scene, "warning_panel", 32, 16, (g) => {
    g.fillStyle(0x2a1b21).fillRect(0, 0, 32, 16);
    g.fillStyle(0xff4d6d).fillRect(3, 4, 6, 8);
    g.fillStyle(0xffd166).fillRect(13, 5, 15, 2).fillRect(13, 10, 10, 2);
  });

  makeTexture(scene, "cable_junction", 24, 24, (g) => {
    g.fillStyle(0x0f172a).fillRect(4, 4, 16, 16);
    g.fillStyle(0x34d5ff).fillRect(10, 2, 4, 20).fillRect(2, 10, 20, 4);
  });

  makePlayerTextures(scene);
  makeWeapons(scene);
  makeEnemies(scene);
  makePickups(scene);

  makeTexture(scene, "bullet_player", 10, 10, (g) => {
    g.fillStyle(0xffffff).fillRect(2, 2, 6, 6);
    g.fillStyle(0xffffff, 0.45).fillRect(0, 4, 10, 2);
  });
  makeTexture(scene, "bullet_enemy", 12, 12, (g) => {
    g.fillStyle(0xff4d6d).fillRect(2, 2, 8, 8);
    g.fillStyle(0xffd166).fillRect(5, 5, 2, 2);
  });
  makeTexture(scene, "spell_orb", 16, 16, (g) => {
    g.fillStyle(0xffffff, 0.32).fillRect(2, 2, 12, 12);
    g.fillStyle(0xffffff).fillRect(5, 5, 6, 6);
  });
  makeTexture(scene, "mine", 24, 24, (g) => {
    g.fillStyle(0x3a1515).fillRect(4, 4, 16, 16);
    g.fillStyle(0xff6b35).fillRect(9, 0, 6, 24).fillRect(0, 9, 24, 6);
  });
  makeTexture(scene, "arm_slash", 82, 22, (g) => {
    g.fillStyle(0xb978ff, 0.62).fillRect(0, 7, 76, 8);
    g.fillStyle(0xffffff, 0.85).fillRect(50, 5, 30, 12);
  });
}

function makeTile(scene, key, base, line, accent) {
  makeTexture(scene, key, 32, 32, (g) => {
    g.fillStyle(base).fillRect(0, 0, 32, 32);
    g.fillStyle(line).fillRect(0, 0, 32, 1).fillRect(0, 0, 1, 32);
    g.fillStyle(accent).fillRect(24, 4, 4, 4).fillRect(5, 24, 7, 2);
  });
}

function makePlayerTextures(scene) {
  makeTexture(scene, "player_idle", 30, 34, (g) => drawPlayer(g, 0, 0));
  for (let i = 0; i < 4; i += 1) {
    const leg = i === 0 ? -3 : i === 1 ? 1 : i === 2 ? 3 : -1;
    const arm = i === 0 ? 2 : i === 1 ? -1 : i === 2 ? -2 : 1;
    makeTexture(scene, `player_walk_${i}`, 30, 34, (g) => drawPlayer(g, leg, arm));
  }
}

function drawPlayer(g, legOffset, armOffset) {
  g.fillStyle(0x06090f).fillRect(7, 24 + legOffset, 6, 8);
  g.fillStyle(0x06090f).fillRect(17, 24 - legOffset, 6, 8);
  g.fillStyle(0x1d2938).fillRect(5, 9, 20, 19);
  g.fillStyle(0x34d5ff).fillRect(8, 6, 14, 8);
  g.fillStyle(0x0f172a).fillRect(10, 10, 10, 4);
  g.fillStyle(0xffd166).fillRect(10, 17, 10, 8);
  g.fillStyle(0x94a3b8).fillRect(3, 13 + armOffset, 5, 12);
  g.fillStyle(0x94a3b8).fillRect(22, 13 - armOffset, 5, 12);
  g.fillStyle(0x5dff9d).fillRect(12, 2, 6, 4);
}

function makeWeapons(scene) {
  makeTexture(scene, "weapon_pistol", 30, 10, (g) => {
    g.fillStyle(0xe5e7eb).fillRect(2, 3, 20, 4);
    g.fillStyle(0x64748b).fillRect(7, 7, 8, 3);
    g.fillStyle(0xffd166).fillRect(22, 4, 6, 2);
  });
  makeTexture(scene, "weapon_shotgun", 42, 12, (g) => {
    g.fillStyle(0xe5e7eb).fillRect(2, 4, 30, 4);
    g.fillStyle(0x8b5a2b).fillRect(7, 8, 12, 3);
    g.fillStyle(0xff8a4d).fillRect(32, 4, 8, 4);
  });
  makeTexture(scene, "weapon_rifle", 50, 10, (g) => {
    g.fillStyle(0xe5e7eb).fillRect(2, 3, 39, 4);
    g.fillStyle(0x334155).fillRect(12, 7, 12, 3);
    g.fillStyle(0x34d5ff).fillRect(41, 4, 7, 2);
  });
}

function makeEnemies(scene) {
  makeTexture(scene, "enemy_robot", 30, 30, (g) => {
    g.fillStyle(0x263241).fillRect(4, 4, 22, 22);
    g.fillStyle(0x94a3b8).fillRect(1, 18, 28, 5);
    g.fillStyle(0xff4d6d).fillRect(9, 10, 4, 4).fillRect(18, 10, 4, 4);
    g.fillStyle(0x0b1118).fillRect(11, 20, 10, 3);
  });
  makeTexture(scene, "enemy_drone", 28, 28, (g) => {
    g.fillStyle(0x111827).fillRect(7, 7, 14, 14);
    g.fillStyle(0xffd166).fillRect(11, 11, 6, 6);
    g.fillStyle(0x94a3b8).fillRect(0, 11, 8, 6).fillRect(20, 11, 8, 6).fillRect(11, 0, 6, 8).fillRect(11, 20, 6, 8);
  });
  makeTexture(scene, "enemy_turret", 34, 34, (g) => {
    g.fillStyle(0x0f172a).fillRect(4, 4, 26, 26);
    g.fillStyle(0x4b5563).fillRect(9, 9, 16, 16);
    g.fillStyle(0xff4d6d).fillRect(17, 14, 15, 6);
    g.fillStyle(0xffd166).fillRect(14, 14, 5, 6);
  });
  makeTexture(scene, "enemy_arm", 44, 28, (g) => {
    g.fillStyle(0x312246).fillRect(3, 6, 18, 16);
    g.fillStyle(0xb978ff).fillRect(19, 10, 17, 8);
    g.fillStyle(0xe9d5ff).fillRect(34, 7, 8, 14);
  });
  makeTexture(scene, "boss_core", 78, 78, (g) => {
    g.fillStyle(0x07080c).fillRect(5, 5, 68, 68);
    g.fillStyle(0x1f2937).fillRect(12, 12, 54, 54);
    g.fillStyle(0xff4d6d).fillRect(20, 20, 38, 38);
    g.fillStyle(0x07080c).fillRect(28, 28, 22, 22);
    g.fillStyle(0x5dff9d).fillRect(35, 35, 8, 8);
    g.fillStyle(0x34d5ff).fillRect(4, 34, 70, 3).fillRect(34, 4, 3, 70);
  });
}

function makePickups(scene) {
  makeTexture(scene, "pickup_health", 24, 24, (g) => {
    g.fillStyle(0x40151f).fillRect(3, 3, 18, 18);
    g.fillStyle(0xff4d6d).fillRect(10, 6, 4, 12).fillRect(6, 10, 12, 4);
  });
  makeTexture(scene, "pickup_energy", 24, 24, (g) => {
    g.fillStyle(0x102a3a).fillRect(3, 3, 18, 18);
    g.fillStyle(0x34d5ff).fillRect(9, 5, 7, 14);
    g.fillStyle(0xffffff).fillRect(11, 8, 3, 8);
  });
  makeTexture(scene, "pickup_shotgun", 26, 18, (g) => {
    g.fillStyle(0xff8a4d).fillRect(3, 7, 20, 4);
    g.fillStyle(0x8b5a2b).fillRect(8, 11, 9, 3);
  });
  makeTexture(scene, "pickup_rifle", 30, 18, (g) => {
    g.fillStyle(0x5dff9d).fillRect(3, 7, 24, 4);
    g.fillStyle(0x334155).fillRect(10, 11, 10, 3);
  });
}

function makeTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function enemyTint(type) {
  if (type === "drone") return 0xffd166;
  if (type === "turret") return 0xff4d6d;
  if (type === "arm") return 0xb978ff;
  return 0x34d5ff;
}

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967295;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  const entry = {
    player: document.getElementById("playerName").value || "runner",
    score: run.score,
    kills: run.kills,
    rooms: run.roomsCleared,
    result: event.currentTarget.dataset.result || run.lastResult,
    build: run.buildSummary,
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

function bootPhaser() {
  const config = {
    type: Phaser.AUTO,
    parent: "gameHost",
    width: WORLD_W,
    height: WORLD_H,
    backgroundColor: "#07080c",
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
        gravity: { y: 0 },
      },
    },
    scene: RunScene,
  };

  new Phaser.Game(config);
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
document.getElementById("breachButton").addEventListener("click", () => showScreen("tutorial"));
document.getElementById("startGameButton").addEventListener("click", startRun);
document.getElementById("againButton").addEventListener("click", () => {
  renderEditor();
  showScreen("editor");
});
document.getElementById("menuButton").addEventListener("click", () => showScreen("main"));
document.getElementById("scoreForm").addEventListener("submit", submitScore);
upgradePanel.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-upgrade]");
  if (button && sceneRef) sceneRef.applyUpgrade(button.dataset.upgrade);
});

initEditor();
updateElementHud();

if (window.Phaser) {
  bootPhaser();
} else {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div style="position:fixed;left:16px;right:16px;bottom:16px;z-index:99;padding:14px;border:1px solid #ff4d6d;background:#14070b;color:#fff;font-family:monospace">Phaser не загрузился. Проверь интернет или завендори phaser.min.js.</div>',
  );
}

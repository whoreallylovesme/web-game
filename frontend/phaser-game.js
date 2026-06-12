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
    this.playerShadow = this.add.image(0, 0, "soft_shadow").setDepth(11).setVisible(false);
    this.playerMarker = this.add.image(0, 0, "player_marker").setDepth(120).setVisible(false);
    this.weaponSprite = this.add.image(0, 0, "weapon_pistol").setDepth(36).setOrigin(0.08, 0.5).setVisible(false);
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
    this.player.setDepth(35).setCollideWorldBounds(false).setVisible(false);
    this.player.body.setSize(28, 34).setOffset(14, 26);
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
    this.player.setTexture("player_idle").setVisible(true).setScale(1).clearTint();
    this.playerShadow.setVisible(true).setScale(1.05, 0.72);
    this.playerMarker.setVisible(true).setAlpha(1);
    this.playerMarkerUntil = this.time.now + 4500;
    this.weaponSprite.setVisible(true).setTexture("weapon_pistol").setScale(1);
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
    this.updateDepths(time);

    this.playerStats.energy = Math.min(this.playerStats.maxEnergy, this.playerStats.energy + dt * 16);
    updateHud(this);
  }

  drawMenuBackdrop() {
    this.clearRoomObjects();
    this.createRoomFloor(12345, true);
    this.messageText.setVisible(false);
    this.weaponSprite.setVisible(false);
    this.player.setVisible(false);
    this.playerShadow.setVisible(false);
    this.playerMarker.setVisible(false);
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
    this.enemies?.children?.each((enemy) => enemy.getData("shadow")?.destroy());
    this.pickups?.children?.each((pickup) => pickup.getData("shadow")?.destroy());
    this.boss?.getData?.("shadow")?.destroy();
    this.bossHealthBack?.destroy();
    this.bossHealthFill?.destroy();
    this.bossHealthBack = null;
    this.bossHealthFill = null;
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
    for (let x = ROOM.x; x < ROOM.x + ROOM.w; x += 64) {
      for (let y = ROOM.y; y < ROOM.y + ROOM.h; y += 64) {
        const key = tileKeys[Math.floor(rand() * tileKeys.length)];
        const tile = this.add.image(x + 32, y + 32, key).setDepth(0);
        this.floorLayer.add(tile);
        this.roomSprites.push(tile);
      }
    }

    const glow = this.add.rectangle(ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h / 2, ROOM.w, ROOM.h, menuMode ? 0x113344 : 0x182338, 0.22)
      .setDepth(1);
    this.roomSprites.push(glow);

    const vignette = this.add.image(ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h / 2, "room_vignette").setDepth(4).setAlpha(menuMode ? 0.38 : 0.26);
    this.roomSprites.push(vignette);
  }

  createWalls() {
    const wallColor = 0x252d3d;
    this.addWall(ROOM.x + ROOM.w / 2, ROOM.y - 14, ROOM.w + 52, 36, wallColor, 0.98);
    this.addWall(ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h + 14, ROOM.w + 52, 36, wallColor, 0.98);
    this.addWall(ROOM.x - 14, ROOM.y + ROOM.h / 2, 36, ROOM.h + 54, wallColor, 0.98);
    this.addWall(ROOM.x + ROOM.w + 14, ROOM.y + ROOM.h / 2 - 122, 36, 184, wallColor, 0.98);
    this.addWall(ROOM.x + ROOM.w + 14, ROOM.y + ROOM.h / 2 + 122, 36, 184, wallColor, 0.98);
    this.rightDoorBlocker = this.addWall(ROOM.x + ROOM.w + 14, ROOM.y + ROOM.h / 2, 34, 112, 0x111827, 0);

    this.leftDoorSprite = this.add.image(ROOM.x - 10, ROOM.y + ROOM.h / 2, "door_entry").setDepth(26);
    this.rightDoorSprite = this.add.image(ROOM.x + ROOM.w + 14, ROOM.y + ROOM.h / 2, "door_locked").setDepth(28);
    this.exitArrow = this.add.image(ROOM.x + ROOM.w - 44, ROOM.y + ROOM.h / 2, "exit_arrow").setDepth(30).setAlpha(0.35);
    this.decorSprites.push(this.leftDoorSprite, this.rightDoorSprite, this.exitArrow);

    this.tweens.add({
      targets: this.rightDoorSprite,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  addWall(x, y, w, h, color, alpha = 1) {
    const sprite = this.walls.create(x, y, "solid");
    sprite.setDisplaySize(w, h).setTint(color).setAlpha(alpha).refreshBody().setDepth(24);
    this.roomSprites.push(sprite);
    return sprite;
  }

  createDecorations(seed) {
    const rand = seeded(seed);
    this.addCables(rand);

    const obstacleSpots = [
      [ROOM.x + 174, ROOM.y + 118, "server_rack"],
      [ROOM.x + 336, ROOM.y + 324, "glass_tank"],
      [ROOM.x + 512, ROOM.y + 132, "lab_table"],
      [ROOM.x + 696, ROOM.y + 330, "reactor"],
    ];

    obstacleSpots.forEach(([x, y, key], index) => {
      if (run.room % 2 === index % 2 || index < 2) {
        const shadow = this.add.image(x + 8, y + 28, "object_shadow").setDepth(35 + y / 10);
        const obstacle = this.obstacles.create(x + rand() * 24 - 12, y + rand() * 24 - 12, key);
        obstacle.refreshBody().setDepth(42 + y / 10);
        this.decorSprites.push(shadow, obstacle);
      }
    });

    for (let i = 0; i < 24; i += 1) {
      const key = rand() > 0.72 ? "floor_rune" : rand() > 0.48 ? "warning_panel" : "cable_junction";
      const x = ROOM.x + 64 + rand() * (ROOM.w - 128);
      const y = ROOM.y + 48 + rand() * (ROOM.h - 96);
      const deco = this.add.image(x, y, key).setDepth(key === "floor_rune" ? 1 : 3);
      deco.setRotation(Math.floor(rand() * 4) * Math.PI / 2);
      deco.setAlpha(key === "floor_rune" ? 0.72 : 1);
      this.decorSprites.push(deco);
    }

    for (let i = 0; i < 10; i += 1) {
      const light = this.add.image(
        ROOM.x + 24 + i * 86,
        ROOM.y + (i % 2 === 0 ? 8 : ROOM.h - 8),
        i % 3 === 0 ? "wall_light_red" : "wall_light_blue",
      ).setDepth(27).setAlpha(0.88);
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
      this.player.setScale(1, 1);
      return;
    }
    this.walkClock += dt * (running ? 14 : 10);
    const frame = Math.floor(this.walkClock) % 6;
    const bob = Math.sin(this.walkClock * Math.PI * 2) * (running ? 0.045 : 0.03);
    this.player.setTexture(`player_walk_${frame}`);
    this.player.setScale(1 + bob, 1 - bob * 0.65);
  }

  updateWeaponSprite() {
    const angle = this.pointerAngle();
    const weapon = weapons[this.playerStats.weapon];
    this.weaponSprite.setTexture(weapon.texture);
    this.weaponSprite.setPosition(
      this.player.x + Math.cos(angle) * 23,
      this.player.y + Math.sin(angle) * 18 + 4,
    );
    this.weaponSprite.setRotation(angle);
    this.weaponSprite.setFlipY(Math.cos(angle) < 0);
    this.player.setFlipX(Math.cos(angle) < 0);
  }

  updateDepths(time) {
    if (this.playerShadow.visible) {
      this.playerShadow.setPosition(this.player.x, this.player.y + 24);
      this.playerShadow.setAlpha(0.42 + Math.sin(time / 180) * 0.035);
    }
    if (this.playerMarker.visible) {
      this.playerMarker.setPosition(this.player.x, this.player.y - 58 + Math.sin(time / 140) * 4);
      this.playerMarker.setAlpha(time < this.playerMarkerUntil ? 0.86 : Math.max(0, this.playerMarker.alpha - 0.04));
      if (this.playerMarker.alpha <= 0.03) this.playerMarker.setVisible(false);
    }
    this.player.setDepth(70 + this.player.y / 10);
    this.weaponSprite.setDepth(this.player.depth + 1);

    this.enemies.children.each((enemy) => {
      if (!enemy.active) return;
      const shadow = enemy.getData("shadow");
      if (shadow) {
        shadow.setPosition(enemy.x, enemy.y + enemy.getData("shadowOffset"));
        shadow.setDepth(55 + enemy.y / 10);
      }
      enemy.setDepth(60 + enemy.y / 10);
    });

    if (this.boss?.active) {
      const shadow = this.boss.getData("shadow");
      if (shadow) {
        shadow.setPosition(this.boss.x, this.boss.y + 42);
        shadow.setDepth(55 + this.boss.y / 10);
      }
      this.boss.setDepth(64 + this.boss.y / 10);
    }
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
    enemy.setTint(0xffffff);
    this.time.delayedCall(80, () => enemy.active && enemy.clearTint());
    const element = bullet.getData("element");
    if (element === "ice") enemy.setData("stunUntil", this.time.now + 800);
    if (element === "fire") enemy.setData("burnUntil", this.time.now + 1200);
    this.emitBurst(bullet.x, bullet.y, bullet.getData("tint") || 0xffffff, 8);
    bullet.destroy();
    if (enemy.getData("hp") <= 0) this.killEnemy(enemy);
  }

  onBulletBoss(bullet, boss) {
    boss.setData("hp", boss.getData("hp") - (bullet.getData("damage") || 0));
    boss.setTint(0xffffff);
    this.time.delayedCall(80, () => boss.active && boss.clearTint());
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
    const shadow = this.add.image(point.x, point.y + 22, "soft_shadow")
      .setDepth(55 + point.y / 10)
      .setAlpha(type === "drone" ? 0.28 : 0.42)
      .setScale(type === "arm" ? 1.12 : type === "turret" ? 1.0 : 0.84, type === "drone" ? 0.42 : 0.58);
    const enemy = this.physics.add.sprite(point.x, point.y, texture).setDepth(14);
    const hp = type === "arm" ? 88 + run.room * 10 : type === "turret" ? 72 + run.room * 10 : 42 + run.room * 8;
    enemy.setData({
      type,
      hp,
      maxHp: hp,
      shadow,
      shadowOffset: type === "drone" ? 28 : 24,
      cooldownAt: this.time.now + Phaser.Math.Between(400, 1400),
      stunUntil: 0,
      burnUntil: 0,
      phase: Math.random() * Math.PI * 2,
    });
    enemy.body.setDrag(650, 650);
    if (type === "drone") enemy.body.setSize(34, 30).setOffset(10, 12);
    if (type === "robot") enemy.body.setSize(32, 34).setOffset(12, 18);
    if (type === "turret") enemy.body.setSize(40, 38).setOffset(10, 16);
    if (type === "arm") enemy.body.setSize(42, 32).setOffset(18, 16);
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
        enemy.setFlipX(Math.cos(angle) < 0);
      } else if (type === "drone") {
        const orbit = angle + Math.sin(phase * 3.2) * 0.9;
        this.physics.velocityFromRotation(orbit, 170 + run.room * 4, enemy.body.velocity);
        enemy.y += Math.sin(phase * 8) * 0.35;
        if (time > cooldownAt) {
          enemy.setData("cooldownAt", time + 1150);
          this.enemyShot(enemy, angle, 0xff4d6d);
        }
      } else if (type === "turret") {
        enemy.setVelocity(0, 0);
        enemy.setRotation(angle * 0.08);
        if (time > cooldownAt) {
          enemy.setData("cooldownAt", time + 980 + Math.random() * 300);
          this.enemyShot(enemy, angle, 0xff4d6d);
        }
      } else if (type === "arm") {
        this.physics.velocityFromRotation(angle + Math.sin(phase * 2) * 0.25, 58, enemy.body.velocity);
        enemy.setRotation(Math.sin(phase * 3) * 0.08);
        enemy.setFlipX(Math.cos(angle) < 0);
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
    const shadow = enemy.getData("shadow");
    run.kills += 1;
    run.score += type === "turret" ? 95 : type === "arm" ? 130 : 65;
    if (run.kills % 5 === 0) this.playerStats.upgradePoints += 1;
    this.emitBurst(enemy.x, enemy.y, enemyTint(type), 22);
    if (Math.random() < 0.2) this.spawnPickup(enemy.x, enemy.y, Math.random() < 0.5 ? "health" : "energy");
    shadow?.destroy();
    enemy.destroy();
  }

  createBoss() {
    const forecast = getBuildForecast();
    const shadow = this.add.image(ROOM.x + ROOM.w * 0.68, ROOM.y + ROOM.h / 2 + 42, "boss_shadow")
      .setDepth(58)
      .setAlpha(0.48);
    const boss = this.physics.add.sprite(ROOM.x + ROOM.w * 0.68, ROOM.y + ROOM.h / 2, "boss_core").setDepth(14);
    const hp = 680 + forecast.risk * 5;
    boss.setData({
      hp,
      maxHp: hp,
      shadow,
      phase: 1,
      traits: forecast.traits,
      cooldownAt: this.time.now + 900,
      summonAt: this.time.now + 3000,
      dashAt: this.time.now + 2400,
    });
    boss.body.setSize(76, 76).setOffset(18, 22);
    boss.body.setDrag(900, 900);
    this.boss = boss;
    this.bossGroup.add(boss);
    this.bossHealthBack = this.add.rectangle(WORLD_W / 2, 34, 520, 18, 0x07080c, 0.72).setDepth(92);
    this.bossHealthFill = this.add.rectangle(WORLD_W / 2 - 258, 34, 516, 12, 0xff4d6d, 0.95).setOrigin(0, 0.5).setDepth(93);
  }

  updateBoss(time) {
    if (!this.boss?.active) return;
    const boss = this.boss;
    const hp = boss.getData("hp");
    const maxHp = boss.getData("maxHp");
    const phase = hp < maxHp * 0.34 ? 3 : hp < maxHp * 0.67 ? 2 : 1;
    boss.setData("phase", phase);
    boss.setRotation(Math.sin(time / 320) * 0.05 * phase);
    boss.setScale(1 + Math.sin(time / 210) * 0.025);

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
    if (this.bossHealthFill) {
      this.bossHealthFill.width = 516 * clamp(hp / maxHp, 0, 1);
    }
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
    const shadow = this.add.image(x, y + 14, "pickup_shadow").setDepth(59).setAlpha(0.32);
    const pickup = this.physics.add.image(x, y, texture).setDepth(13);
    pickup.setData("type", type);
    pickup.setData("shadow", shadow);
    pickup.body.setCircle(14, 5, 5);
    this.pickups.add(pickup);
    this.tweens.add({ targets: pickup, y: y - 7, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  updatePickups() {
    this.pickups.children.each((pickup) => {
      if (!pickup.active) return;
      const shadow = pickup.getData("shadow");
      if (shadow) {
        shadow.setPosition(pickup.x, pickup.y + 16);
        shadow.setDepth(58 + pickup.y / 10);
      }
      pickup.setDepth(60 + pickup.y / 10);
    });
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
    pickup.getData("shadow")?.destroy();
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
    this.rightDoorSprite?.setTexture("door_open").setScale(1.08);
    this.exitArrow?.setTexture("exit_arrow_open").setAlpha(1);
    this.tweens.add({
      targets: [this.rightDoorSprite, this.exitArrow],
      alpha: { from: 0.72, to: 1 },
      duration: 260,
      yoyo: true,
      repeat: 3,
    });
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
  makeTexture(scene, "soft_shadow", 96, 38, (g) => {
    g.fillStyle(0x000000, 0.22).fillEllipse(48, 20, 88, 28);
    g.fillStyle(0x000000, 0.16).fillEllipse(48, 20, 58, 18);
  });
  makeTexture(scene, "object_shadow", 120, 46, (g) => g.fillStyle(0x000000, 0.28).fillEllipse(60, 24, 110, 32));
  makeTexture(scene, "pickup_shadow", 42, 18, (g) => g.fillStyle(0x000000, 0.22).fillEllipse(21, 9, 36, 12));
  makeTexture(scene, "boss_shadow", 150, 60, (g) => g.fillStyle(0x000000, 0.32).fillEllipse(75, 32, 140, 42));
  makeTexture(scene, "player_marker", 44, 34, (g) => {
    g.fillStyle(0x000000, 0.34).fillTriangle(22, 34, 4, 6, 40, 6);
    g.fillStyle(0x5dff9d).fillTriangle(22, 30, 8, 8, 36, 8);
    g.fillStyle(0xf8fff9).fillTriangle(22, 24, 15, 12, 29, 12);
  });

  makeTile(scene, "tile_a", 0x1c2635, 0x2f3e53, 0x263347);
  makeTile(scene, "tile_b", 0x20293a, 0x37465d, 0x28364b);
  makeTile(scene, "tile_c", 0x182334, 0x2e4058, 0x223249);
  makeTile(scene, "tile_d", 0x22283a, 0x465169, 0x2a354a);
  makeTexture(scene, "room_vignette", ROOM.w, ROOM.h, (g) => {
    g.lineStyle(18, 0x05070d, 0.48).strokeRect(9, 9, ROOM.w - 18, ROOM.h - 18);
    g.lineStyle(8, 0x34d5ff, 0.14).strokeRect(20, 20, ROOM.w - 40, ROOM.h - 40);
  });

  makeDoors(scene);
  makeDecor(scene);

  makePlayerTextures(scene);
  makeWeapons(scene);
  makeEnemies(scene);
  makePickups(scene);

  makeTexture(scene, "bullet_player", 18, 18, (g) => {
    g.fillStyle(0xffffff, 0.24).fillCircle(9, 9, 9);
    g.fillStyle(0xffffff).fillCircle(9, 9, 5);
    g.fillStyle(0xffd166).fillCircle(11, 7, 2);
  });
  makeTexture(scene, "bullet_enemy", 20, 20, (g) => {
    g.fillStyle(0x220711, 0.86).fillCircle(10, 10, 10);
    g.fillStyle(0xff4d6d).fillCircle(10, 10, 7);
    g.fillStyle(0xffc2cf).fillCircle(8, 7, 2);
  });
  makeTexture(scene, "spell_orb", 28, 28, (g) => {
    g.fillStyle(0xffffff, 0.22).fillCircle(14, 14, 14);
    g.fillStyle(0xffffff, 0.52).fillCircle(14, 14, 10);
    g.fillStyle(0xffffff).fillCircle(14, 14, 5);
  });
  makeTexture(scene, "mine", 38, 38, (g) => {
    g.lineStyle(5, 0x0b1020).strokeCircle(19, 19, 14);
    g.fillStyle(0x3a1515).fillCircle(19, 19, 14);
    g.fillStyle(0xff6b35).fillCircle(19, 19, 8);
    g.fillStyle(0xffd166).fillCircle(19, 19, 3);
  });
  makeTexture(scene, "arm_slash", 112, 34, (g) => {
    g.fillStyle(0xb978ff, 0.3).fillEllipse(56, 17, 108, 22);
    g.fillStyle(0xe9d5ff, 0.78).fillEllipse(72, 17, 72, 16);
    g.fillStyle(0xffffff, 0.9).fillEllipse(88, 17, 42, 10);
  });
}

function makeTile(scene, key, base, line, accent) {
  makeTexture(scene, key, 64, 64, (g) => {
    g.fillStyle(base).fillRect(0, 0, 64, 64);
    g.lineStyle(2, line, 0.75).strokeRect(1, 1, 62, 62);
    g.lineStyle(1, 0xffffff, 0.08).strokeRect(8, 8, 48, 48);
    g.fillStyle(accent, 0.88).fillRoundedRect(45, 9, 10, 10, 3);
    g.fillStyle(0x34d5ff, 0.16).fillRoundedRect(10, 48, 18, 4, 2);
    g.fillStyle(0x000000, 0.1).fillRect(2, 54, 60, 8);
  });
}

function makeDoors(scene) {
  makeTexture(scene, "door_entry", 72, 142, (g) => {
    g.fillStyle(0x000000, 0.35).fillEllipse(36, 132, 58, 18);
    g.lineStyle(8, 0x0b1020).strokeRoundedRect(8, 10, 56, 112, 14);
    g.fillStyle(0x202a3a).fillRoundedRect(8, 10, 56, 112, 14);
    g.lineStyle(4, 0x34d5ff, 0.58).strokeRoundedRect(17, 22, 38, 88, 9);
    g.fillStyle(0x34d5ff, 0.2).fillRoundedRect(24, 32, 24, 68, 8);
    g.fillStyle(0x94a3b8).fillRoundedRect(28, 13, 16, 8, 4);
  });

  makeTexture(scene, "door_locked", 96, 152, (g) => {
    g.fillStyle(0x000000, 0.42).fillEllipse(48, 140, 76, 20);
    g.lineStyle(9, 0x0b1020).strokeRoundedRect(12, 8, 72, 126, 18);
    g.fillStyle(0x271822).fillRoundedRect(12, 8, 72, 126, 18);
    g.lineStyle(5, 0xff4d6d, 0.9).strokeRoundedRect(23, 22, 50, 94, 12);
    g.fillStyle(0xff4d6d, 0.17).fillRoundedRect(29, 30, 38, 78, 10);
    g.fillStyle(0xff4d6d).fillRoundedRect(34, 63, 28, 12, 6);
    g.fillStyle(0xffd166).fillCircle(48, 88, 6);
    g.fillStyle(0xffffff, 0.35).fillRoundedRect(27, 28, 10, 76, 5);
  });

  makeTexture(scene, "door_open", 104, 160, (g) => {
    g.fillStyle(0x000000, 0.38).fillEllipse(52, 148, 82, 22);
    g.lineStyle(9, 0x0b1020).strokeRoundedRect(11, 8, 82, 136, 20);
    g.fillStyle(0x17362d).fillRoundedRect(11, 8, 82, 136, 20);
    g.fillStyle(0x5dff9d, 0.28).fillRoundedRect(24, 22, 56, 108, 14);
    g.lineStyle(5, 0x5dff9d, 0.98).strokeRoundedRect(22, 20, 60, 112, 14);
    g.fillStyle(0xf8fff9, 0.7).fillRoundedRect(36, 44, 34, 60, 12);
    g.fillStyle(0x34d5ff).fillCircle(52, 28, 5).fillCircle(52, 124, 5);
  });

  makeTexture(scene, "exit_arrow", 68, 62, (g) => {
    g.fillStyle(0x000000, 0.28).fillEllipse(34, 54, 52, 12);
    g.lineStyle(6, 0x0b1020).strokeRoundedRect(8, 18, 33, 18, 8);
    g.fillStyle(0xff4d6d).fillRoundedRect(8, 18, 33, 18, 8);
    g.fillStyle(0xff4d6d).fillTriangle(38, 10, 62, 27, 38, 44);
    g.lineStyle(3, 0xffc2cf).strokeTriangle(38, 10, 62, 27, 38, 44);
  });

  makeTexture(scene, "exit_arrow_open", 68, 62, (g) => {
    g.fillStyle(0x000000, 0.26).fillEllipse(34, 54, 52, 12);
    g.lineStyle(6, 0x0b1020).strokeRoundedRect(8, 18, 33, 18, 8);
    g.fillStyle(0x5dff9d).fillRoundedRect(8, 18, 33, 18, 8);
    g.fillStyle(0x5dff9d).fillTriangle(38, 10, 62, 27, 38, 44);
    g.lineStyle(3, 0xf8fff9).strokeTriangle(38, 10, 62, 27, 38, 44);
  });
}

function makeDecor(scene) {
  makeTexture(scene, "wall_light_red", 48, 14, (g) => {
    g.fillStyle(0x0b1020).fillRoundedRect(0, 0, 48, 14, 7);
    g.fillStyle(0xff4d6d).fillRoundedRect(6, 4, 36, 6, 3);
  });
  makeTexture(scene, "wall_light_blue", 48, 14, (g) => {
    g.fillStyle(0x0b1020).fillRoundedRect(0, 0, 48, 14, 7);
    g.fillStyle(0x34d5ff).fillRoundedRect(6, 4, 36, 6, 3);
  });
  makeTexture(scene, "server_rack", 72, 96, (g) => {
    g.fillStyle(0x000000, 0.22).fillEllipse(38, 88, 58, 14);
    g.lineStyle(7, 0x0b1020).strokeRoundedRect(8, 4, 56, 82, 10);
    g.fillStyle(0x1f2a38).fillRoundedRect(8, 4, 56, 82, 10);
    for (let y = 15; y < 75; y += 14) {
      g.fillStyle(0x0f172a).fillRoundedRect(17, y, 38, 8, 3);
      g.fillStyle(0x34d5ff).fillCircle(22, y + 4, 3);
      g.fillStyle(0x5dff9d).fillCircle(31, y + 4, 3);
      g.fillStyle(0x94a3b8).fillRoundedRect(40, y + 2, 10, 4, 2);
    }
    g.fillStyle(0xffffff, 0.16).fillRoundedRect(15, 10, 7, 70, 4);
  });
  makeTexture(scene, "glass_tank", 68, 106, (g) => {
    g.fillStyle(0x000000, 0.22).fillEllipse(34, 98, 58, 16);
    g.lineStyle(7, 0x0b1020).strokeRoundedRect(9, 5, 50, 88, 18);
    g.fillStyle(0x12384a).fillRoundedRect(9, 5, 50, 88, 18);
    g.fillStyle(0x79e7ff, 0.34).fillRoundedRect(17, 16, 34, 62, 14);
    g.fillStyle(0xa0ff8f).fillEllipse(34, 52, 12, 28);
    g.lineStyle(3, 0xf8fafc, 0.34).strokeRoundedRect(22, 20, 22, 54, 10);
    g.fillStyle(0xe5e7eb).fillRoundedRect(18, 7, 32, 7, 4).fillRoundedRect(18, 83, 32, 7, 4);
  });
  makeTexture(scene, "lab_table", 112, 62, (g) => {
    g.fillStyle(0x000000, 0.24).fillEllipse(56, 55, 96, 14);
    g.lineStyle(7, 0x0b1020).strokeRoundedRect(7, 8, 98, 38, 12);
    g.fillStyle(0x334155).fillRoundedRect(7, 8, 98, 38, 12);
    g.fillStyle(0xffd166).fillRoundedRect(18, 18, 24, 9, 4);
    g.fillStyle(0xb978ff).fillRoundedRect(58, 17, 25, 14, 5);
    g.fillStyle(0x94a3b8).fillRoundedRect(20, 42, 72, 7, 4);
    g.fillStyle(0x34d5ff).fillCircle(91, 25, 5);
  });
  makeTexture(scene, "reactor", 96, 104, (g) => {
    g.fillStyle(0x000000, 0.26).fillEllipse(48, 95, 82, 18);
    g.lineStyle(8, 0x0b1020).strokeCircle(48, 50, 34);
    g.fillStyle(0x263247).fillCircle(48, 50, 34);
    g.fillStyle(0xb978ff, 0.28).fillCircle(48, 50, 25);
    g.lineStyle(5, 0xb978ff, 0.9).strokeCircle(48, 50, 24);
    g.fillStyle(0x5dff9d).fillCircle(48, 50, 9);
    g.fillStyle(0x94a3b8).fillRoundedRect(18, 79, 60, 10, 5);
  });
  makeTexture(scene, "floor_rune", 48, 48, (g) => {
    g.lineStyle(3, 0xb978ff, 0.72).strokeCircle(24, 24, 18);
    g.lineStyle(2, 0x34d5ff, 0.5).strokeRoundedRect(9, 9, 30, 30, 7);
    g.fillStyle(0xb978ff, 0.58).fillCircle(24, 24, 5);
  });
  makeTexture(scene, "warning_panel", 52, 26, (g) => {
    g.lineStyle(4, 0x0b1020).strokeRoundedRect(3, 3, 46, 20, 6);
    g.fillStyle(0x2a1b21).fillRoundedRect(3, 3, 46, 20, 6);
    g.fillStyle(0xff4d6d).fillCircle(13, 13, 5);
    g.fillStyle(0xffd166).fillRoundedRect(24, 8, 16, 3, 2).fillRoundedRect(24, 15, 11, 3, 2);
  });
  makeTexture(scene, "cable_junction", 38, 38, (g) => {
    g.lineStyle(5, 0x0b1020).strokeCircle(19, 19, 12);
    g.fillStyle(0x0f172a).fillCircle(19, 19, 12);
    g.fillStyle(0x34d5ff).fillRoundedRect(16, 2, 6, 34, 3).fillRoundedRect(2, 16, 34, 6, 3);
    g.fillStyle(0xffd166).fillCircle(19, 19, 4);
  });
}

function makePlayerTextures(scene) {
  makeTexture(scene, "player_idle", 56, 72, (g) => drawPlayer(g, 0, 0, 0));
  for (let i = 0; i < 6; i += 1) {
    const phase = (Math.PI * 2 * i) / 6;
    makeTexture(scene, `player_walk_${i}`, 56, 72, (g) => drawPlayer(g, Math.sin(phase), Math.cos(phase), i));
  }
}

function drawPlayer(g, legPhase, armPhase) {
  const outline = 0x0b1020;
  const legA = 49 + legPhase * 3;
  const legB = 49 - legPhase * 3;
  const armA = 32 + armPhase * 3;
  const armB = 32 - armPhase * 3;
  g.fillStyle(0x000000, 0.2).fillEllipse(28, 62, 38, 12);

  g.lineStyle(6, outline).strokeEllipse(18, legA, 13, 24);
  g.lineStyle(6, outline).strokeEllipse(38, legB, 13, 24);
  g.fillStyle(0x151c2b).fillEllipse(18, legA, 13, 24);
  g.fillStyle(0x151c2b).fillEllipse(38, legB, 13, 24);
  g.fillStyle(0x5dff9d).fillEllipse(18, legA + 7, 9, 9);
  g.fillStyle(0x5dff9d).fillEllipse(38, legB + 7, 9, 9);

  g.lineStyle(7, outline).strokeEllipse(28, 36, 38, 42);
  g.fillStyle(0x263247).fillEllipse(28, 36, 38, 42);
  g.fillStyle(0x384b68).fillEllipse(25, 30, 24, 24);
  g.fillStyle(0xffd166).fillRoundedRect(19, 37, 18, 14, 5);
  g.fillStyle(0x121826).fillRoundedRect(21, 40, 14, 6, 3);

  g.lineStyle(5, outline).strokeEllipse(9, armA, 13, 24);
  g.lineStyle(5, outline).strokeEllipse(47, armB, 13, 24);
  g.fillStyle(0x8aa0bd).fillEllipse(9, armA, 13, 24);
  g.fillStyle(0x8aa0bd).fillEllipse(47, armB, 13, 24);

  g.lineStyle(6, outline).strokeCircle(28, 17, 18);
  g.fillStyle(0x34d5ff).fillCircle(28, 17, 18);
  g.fillStyle(0xbdf4ff).fillEllipse(22, 12, 14, 10);
  g.fillStyle(0x07111f).fillRoundedRect(15, 18, 26, 10, 5);
  g.fillStyle(0x5dff9d).fillCircle(28, 4, 4);
}

function makeWeapons(scene) {
  makeTexture(scene, "weapon_pistol", 52, 20, (g) => {
    g.lineStyle(5, 0x0b1020).strokeRoundedRect(6, 5, 34, 8, 3);
    g.fillStyle(0xe5e7eb).fillRoundedRect(6, 5, 34, 8, 3);
    g.fillStyle(0x64748b).fillRoundedRect(15, 12, 12, 7, 2);
    g.fillStyle(0xffd166).fillRect(39, 8, 10, 3);
  });
  makeTexture(scene, "weapon_shotgun", 72, 22, (g) => {
    g.lineStyle(5, 0x0b1020).strokeRoundedRect(6, 6, 50, 8, 4);
    g.fillStyle(0xdde5ee).fillRoundedRect(6, 6, 50, 8, 4);
    g.fillStyle(0x8b5a2b).fillRoundedRect(14, 14, 20, 6, 2);
    g.fillStyle(0xff8a4d).fillRoundedRect(55, 6, 12, 8, 3);
  });
  makeTexture(scene, "weapon_rifle", 82, 22, (g) => {
    g.lineStyle(5, 0x0b1020).strokeRoundedRect(6, 6, 62, 7, 3);
    g.fillStyle(0xe5e7eb).fillRoundedRect(6, 6, 62, 7, 3);
    g.fillStyle(0x334155).fillRoundedRect(20, 13, 21, 6, 2);
    g.fillStyle(0x34d5ff).fillRoundedRect(67, 7, 10, 4, 2);
    g.fillStyle(0xffd166).fillRect(10, 2, 18, 4);
  });
}

function makeEnemies(scene) {
  makeTexture(scene, "enemy_robot", 56, 66, (g) => {
    const outline = 0x18090f;
    g.lineStyle(6, outline).strokeRoundedRect(10, 14, 36, 38, 12);
    g.fillStyle(0x6e3a43).fillRoundedRect(10, 14, 36, 38, 12);
    g.fillStyle(0xff4d6d).fillCircle(21, 28, 5).fillCircle(35, 28, 5);
    g.fillStyle(0x2a1017).fillRoundedRect(18, 42, 20, 6, 3);
    g.lineStyle(5, outline).strokeEllipse(12, 50, 13, 18);
    g.lineStyle(5, outline).strokeEllipse(44, 50, 13, 18);
    g.fillStyle(0x8a4b55).fillEllipse(12, 50, 13, 18).fillEllipse(44, 50, 13, 18);
    g.fillStyle(0xffd166).fillRect(26, 8, 5, 8);
  });
  makeTexture(scene, "enemy_drone", 54, 52, (g) => {
    const outline = 0x0b1020;
    g.lineStyle(5, outline).strokeCircle(27, 26, 15);
    g.fillStyle(0x273348).fillCircle(27, 26, 15);
    g.fillStyle(0xffd166).fillCircle(27, 26, 7);
    g.lineStyle(4, outline).strokeEllipse(7, 17, 16, 10);
    g.lineStyle(4, outline).strokeEllipse(47, 17, 16, 10);
    g.lineStyle(4, outline).strokeEllipse(7, 35, 16, 10);
    g.lineStyle(4, outline).strokeEllipse(47, 35, 16, 10);
    g.fillStyle(0x94a3b8).fillEllipse(7, 17, 16, 10).fillEllipse(47, 17, 16, 10).fillEllipse(7, 35, 16, 10).fillEllipse(47, 35, 16, 10);
    g.fillStyle(0xff4d6d).fillCircle(27, 14, 3);
  });
  makeTexture(scene, "enemy_turret", 62, 58, (g) => {
    const outline = 0x0b1020;
    g.lineStyle(6, outline).strokeCircle(30, 32, 20);
    g.fillStyle(0x374151).fillCircle(30, 32, 20);
    g.fillStyle(0x111827).fillCircle(30, 32, 11);
    g.lineStyle(5, outline).strokeRoundedRect(29, 24, 28, 11, 4);
    g.fillStyle(0xff4d6d).fillRoundedRect(29, 24, 28, 11, 4);
    g.fillStyle(0xffd166).fillCircle(30, 32, 5);
    g.fillStyle(0x64748b).fillRoundedRect(14, 45, 32, 8, 4);
  });
  makeTexture(scene, "enemy_arm", 76, 58, (g) => {
    const outline = 0x160c24;
    g.lineStyle(6, outline).strokeRoundedRect(5, 15, 30, 28, 10);
    g.fillStyle(0x49315f).fillRoundedRect(5, 15, 30, 28, 10);
    g.lineStyle(5, outline).strokeRoundedRect(32, 22, 28, 12, 6);
    g.fillStyle(0xb978ff).fillRoundedRect(32, 22, 28, 12, 6);
    g.lineStyle(4, outline).strokeEllipse(63, 28, 18, 25);
    g.fillStyle(0xe9d5ff).fillEllipse(63, 28, 18, 25);
    g.fillStyle(0xff4d6d).fillCircle(20, 28, 5);
  });
  makeTexture(scene, "boss_core", 112, 120, (g) => {
    const outline = 0x080b14;
    g.lineStyle(8, outline).strokeCircle(56, 58, 43);
    g.fillStyle(0x1b2435).fillCircle(56, 58, 43);
    g.lineStyle(5, 0xff4d6d, 0.95).strokeCircle(56, 58, 35);
    g.fillStyle(0xff4d6d, 0.28).fillCircle(56, 58, 35);
    g.fillStyle(0x07111f).fillCircle(56, 58, 20);
    g.fillStyle(0x5dff9d).fillCircle(56, 58, 9);
    g.fillStyle(0x34d5ff).fillRoundedRect(15, 55, 82, 6, 3).fillRoundedRect(53, 17, 6, 82, 3);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      g.fillStyle(i % 2 ? 0xb978ff : 0xffd166).fillCircle(56 + Math.cos(a) * 47, 58 + Math.sin(a) * 47, 5);
    }
  });
}

function makePickups(scene) {
  makeTexture(scene, "pickup_health", 38, 38, (g) => {
    g.lineStyle(5, 0x0b1020).strokeCircle(19, 19, 14);
    g.fillStyle(0x40151f).fillCircle(19, 19, 14);
    g.fillStyle(0xff4d6d).fillRoundedRect(16, 9, 6, 20, 3).fillRoundedRect(9, 16, 20, 6, 3);
  });
  makeTexture(scene, "pickup_energy", 38, 38, (g) => {
    g.lineStyle(5, 0x0b1020).strokeCircle(19, 19, 14);
    g.fillStyle(0x102a3a).fillCircle(19, 19, 14);
    g.fillStyle(0x34d5ff).fillRoundedRect(14, 8, 10, 22, 5);
    g.fillStyle(0xffffff).fillRoundedRect(17, 12, 4, 14, 2);
  });
  makeTexture(scene, "pickup_shotgun", 54, 36, (g) => {
    g.lineStyle(5, 0x0b1020).strokeRoundedRect(6, 12, 38, 8, 4);
    g.fillStyle(0xff8a4d).fillRoundedRect(6, 12, 38, 8, 4);
    g.fillStyle(0x8b5a2b).fillRoundedRect(16, 20, 16, 6, 3);
  });
  makeTexture(scene, "pickup_rifle", 62, 36, (g) => {
    g.lineStyle(5, 0x0b1020).strokeRoundedRect(6, 12, 48, 7, 4);
    g.fillStyle(0x5dff9d).fillRoundedRect(6, 12, 48, 7, 4);
    g.fillStyle(0x334155).fillRoundedRect(20, 19, 18, 6, 3);
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
    pixelArt: false,
    roundPixels: false,
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

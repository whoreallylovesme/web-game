#include "raylib.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <fstream>
#include <iomanip>
#include <random>
#include <sstream>
#include <string>
#include <tuple>
#include <vector>

namespace {

constexpr int kScreenW = 1280;
constexpr int kScreenH = 720;
constexpr Rectangle kRoom{82.0f, 92.0f, 1116.0f, 520.0f};
constexpr int kMaxRooms = 6;
constexpr int kEditorGroupCount = 5;
constexpr float kPi = 3.1415926535f;

const Color kBg{7, 9, 13, 255};
const Color kPanel{13, 18, 28, 232};
const Color kPanel2{20, 27, 40, 238};
const Color kLine{85, 110, 138, 150};
const Color kText{235, 244, 255, 255};
const Color kMuted{135, 153, 174, 255};
const Color kCyan{50, 213, 255, 255};
const Color kGreen{93, 255, 157, 255};
const Color kAmber{255, 209, 102, 255};
const Color kRed{255, 77, 109, 255};
const Color kViolet{185, 120, 255, 255};
const Color kIce{121, 231, 255, 255};
const Color kMatter{160, 255, 143, 255};

enum class Screen {
  MainMenu,
  Editor,
  Breach,
  Playing,
  GameOver,
};

enum class EntityType {
  Robot,
  Drone,
  Turret,
  Arm,
  Shield,
  Boss,
};

enum class PickupType {
  Health,
  Energy,
  Shotgun,
  Rifle,
};

enum class Element {
  Fire,
  Ice,
  Volt,
  Matter,
};

enum class UpgradeType {
  Damage,
  Health,
  Speed,
  Energy,
};

struct Option {
  const char* id;
  const char* label;
  const char* trait;
  int risk;
};

struct EditorGroup {
  const char* label;
  std::array<Option, 3> options;
};

const std::array<EditorGroup, kEditorGroupCount> kEditorGroups{{
  {
    "Sensor",
    {{
      {"vision", "Vision lattice", "aim", 8},
      {"audio", "Audio trace", "echo", 4},
      {"thermal", "Thermal sweep", "seek", 6},
    }},
  },
  {
    "Memory",
    {{
      {"tactical", "Tactical cache", "phases", 10},
      {"long", "Long context", "summon", 7},
      {"volatile", "Volatile state", "burst", 5},
    }},
  },
  {
    "Policy",
    {{
      {"hunter", "Hunter", "dash", 10},
      {"architect", "Architect", "walls", 8},
      {"warden", "Warden", "turrets", 6},
    }},
  },
  {
    "Mutation",
    {{
      {"plasma", "Plasma rune", "fire", 9},
      {"cryo", "Cryo rune", "ice", 6},
      {"metal", "Metal bloom", "matter", 7},
    }},
  },
  {
    "Limiter",
    {{
      {"overheat", "Overheat", "weak_heat", -8},
      {"latency", "Latency cap", "weak_slow", -5},
      {"empathy", "Empathy shard", "weak_mercy", -3},
    }},
  },
}};

struct Weapon {
  const char* name;
  float damage;
  float cooldown;
  float speed;
  float spread;
  int count;
  Color color;
};

const std::array<Weapon, 3> kWeapons{{
  {"Pistol", 18.0f, 0.22f, 700.0f, 0.035f, 1, kAmber},
  {"Shotgun", 11.0f, 0.62f, 570.0f, 0.23f, 6, {255, 138, 77, 255}},
  {"Rifle", 13.0f, 0.105f, 780.0f, 0.025f, 1, kCyan},
}};

struct Build {
  std::array<int, kEditorGroupCount> picks{0, 0, 0, 0, 0};

  int Risk() const {
    int risk = 50;
    for (std::size_t i = 0; i < picks.size(); ++i) {
      risk += kEditorGroups[i].options[picks[i]].risk;
    }
    return std::clamp(risk, 18, 96);
  }

  bool HasTrait(const std::string& trait) const {
    for (std::size_t i = 0; i < picks.size(); ++i) {
      if (trait == kEditorGroups[i].options[picks[i]].trait) {
        return true;
      }
    }
    return false;
  }

  std::string Summary() const {
    std::string result;
    for (std::size_t i = 0; i < picks.size(); ++i) {
      if (!result.empty()) result += " / ";
      result += kEditorGroups[i].options[picks[i]].label;
    }
    return result;
  }
};

struct Particle {
  Vector2 p{};
  Vector2 v{};
  Color color{};
  float life = 0.0f;
  float maxLife = 1.0f;
  float size = 3.0f;
};

struct Projectile {
  Vector2 p{};
  Vector2 v{};
  Color color{};
  float radius = 5.0f;
  float damage = 1.0f;
  float life = 1.0f;
  bool enemy = false;
  Element element = Element::Fire;
  bool elemental = false;
};

struct Enemy {
  EntityType type = EntityType::Robot;
  Vector2 p{};
  Vector2 v{};
  float hp = 10.0f;
  float maxHp = 10.0f;
  float radius = 20.0f;
  float cooldown = 0.0f;
  float stun = 0.0f;
  float burn = 0.0f;
  float phase = 0.0f;
  bool active = true;
};

struct Pickup {
  PickupType type = PickupType::Health;
  Vector2 p{};
  float radius = 17.0f;
  float bob = 0.0f;
  bool active = true;
};

struct Obstacle {
  Rectangle rect{};
  int kind = 0;
};

struct ScoreRow {
  std::string name;
  int score = 0;
  int kills = 0;
  int rooms = 0;
};

float Rand01(std::mt19937& rng) {
  return std::uniform_real_distribution<float>(0.0f, 1.0f)(rng);
}

float RandRange(std::mt19937& rng, float min, float max) {
  return std::uniform_real_distribution<float>(min, max)(rng);
}

int RandInt(std::mt19937& rng, int min, int max) {
  return std::uniform_int_distribution<int>(min, max)(rng);
}

float Length(Vector2 v) {
  return std::sqrt(v.x * v.x + v.y * v.y);
}

Vector2 NormalizeOrZero(Vector2 v) {
  const float len = Length(v);
  if (len <= 0.0001f) return {0.0f, 0.0f};
  return {v.x / len, v.y / len};
}

Vector2 FromAngle(float angle, float length = 1.0f) {
  return {std::cos(angle) * length, std::sin(angle) * length};
}

float AngleTo(Vector2 a, Vector2 b) {
  return std::atan2(b.y - a.y, b.x - a.x);
}

Vector2 Vector2Add(Vector2 a, Vector2 b) {
  return {a.x + b.x, a.y + b.y};
}

Vector2 Vector2Subtract(Vector2 a, Vector2 b) {
  return {a.x - b.x, a.y - b.y};
}

Vector2 Vector2Scale(Vector2 v, float scale) {
  return {v.x * scale, v.y * scale};
}

float Distance(Vector2 a, Vector2 b) {
  return Length(Vector2Subtract(a, b));
}

float Clamp01(float value) {
  return std::clamp(value, 0.0f, 1.0f);
}

Color FadeColor(Color color, float alpha) {
  color.a = static_cast<unsigned char>(std::clamp(alpha, 0.0f, 1.0f) * 255.0f);
  return color;
}

Color ElementColor(Element e) {
  switch (e) {
    case Element::Fire: return kRed;
    case Element::Ice: return kIce;
    case Element::Volt: return kAmber;
    case Element::Matter: return kMatter;
  }
  return WHITE;
}

const char* ElementName(Element e) {
  switch (e) {
    case Element::Fire: return "FIRE";
    case Element::Ice: return "ICE";
    case Element::Volt: return "VOLT";
    case Element::Matter: return "MATTER";
  }
  return "UNKNOWN";
}

bool CheckCircleRect(Vector2 p, float radius, Rectangle r) {
  const float closestX = std::clamp(p.x, r.x, r.x + r.width);
  const float closestY = std::clamp(p.y, r.y, r.y + r.height);
  const float dx = p.x - closestX;
  const float dy = p.y - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

void DrawTextLeft(const std::string& text, int x, int y, int size, Color color) {
  DrawText(text.c_str(), x, y, size, color);
}

void DrawTextCentered(const std::string& text, int centerX, int y, int size, Color color) {
  const int width = MeasureText(text.c_str(), size);
  DrawText(text.c_str(), centerX - width / 2, y, size, color);
}

void DrawTextRight(const std::string& text, int rightX, int y, int size, Color color) {
  const int width = MeasureText(text.c_str(), size);
  DrawText(text.c_str(), rightX - width, y, size, color);
}

void DrawPanel(Rectangle r, Color fill = kPanel) {
  DrawRectangleRec(r, fill);
  DrawRectangleLinesEx(r, 1.0f, kLine);
  DrawRectangle(static_cast<int>(r.x), static_cast<int>(r.y), 3, static_cast<int>(r.height), FadeColor(kCyan, 0.55f));
}

void DrawButton(Rectangle r, const std::string& label, bool hot, bool selected = false) {
  const Color fill = selected ? FadeColor(kGreen, 0.25f) : hot ? FadeColor(kCyan, 0.18f) : FadeColor(WHITE, 0.07f);
  DrawRectangleRec(r, fill);
  DrawRectangleLinesEx(r, selected ? 2.0f : 1.0f, selected ? kGreen : hot ? kCyan : kLine);
  DrawTextCentered(label, static_cast<int>(r.x + r.width / 2), static_cast<int>(r.y + r.height / 2 - 9), 18, kText);
}

void DrawScanlines() {
  for (int y = 0; y < kScreenH; y += 4) {
    DrawRectangle(0, y, kScreenW, 1, {255, 255, 255, 13});
  }
  DrawRectangleLinesEx({1, 1, kScreenW - 2.0f, kScreenH - 2.0f}, 1.0f, {255, 255, 255, 22});
}

void DrawHealthBar(Vector2 p, float width, float hp, float maxHp, Color fill) {
  const float t = Clamp01(hp / std::max(maxHp, 1.0f));
  Rectangle back{p.x - width / 2.0f, p.y, width, 5.0f};
  DrawRectangleRec(back, {0, 0, 0, 145});
  DrawRectangleRec({back.x, back.y, back.width * t, back.height}, fill);
}

void DrawScientist(Vector2 p, float angle, float walk, bool moving) {
  const bool left = std::cos(angle) < 0.0f;
  const float bob = moving ? std::sin(walk * 10.0f) * 2.5f : 0.0f;
  const float armSwing = moving ? std::sin(walk * 10.0f) * 5.0f : 0.0f;

  DrawEllipse(static_cast<int>(p.x), static_cast<int>(p.y + 25), 24, 8, {0, 0, 0, 82});

  const Vector2 body{p.x, p.y + bob};
  DrawCircleV({body.x - 9.0f, body.y + 17.0f + armSwing * 0.2f}, 7.0f, {20, 26, 39, 255});
  DrawCircleV({body.x + 9.0f, body.y + 17.0f - armSwing * 0.2f}, 7.0f, {20, 26, 39, 255});
  DrawCircleV({body.x - 16.0f, body.y + 1.0f - armSwing}, 7.0f, {220, 231, 242, 255});
  DrawCircleV({body.x + 16.0f, body.y + 1.0f + armSwing}, 7.0f, {220, 231, 242, 255});

  DrawRectangleRounded({body.x - 17.0f, body.y - 14.0f, 34.0f, 39.0f}, 0.35f, 8, {228, 236, 242, 255});
  DrawRectangleRounded({body.x - 12.0f, body.y - 10.0f, 24.0f, 31.0f}, 0.2f, 6, {41, 52, 75, 255});
  DrawRectangleRounded({body.x + 4.0f, body.y - 2.0f, 8.0f, 11.0f}, 0.2f, 4, kAmber);
  DrawLineEx({body.x, body.y - 11.0f}, {body.x, body.y + 23.0f}, 2.0f, {245, 248, 252, 255});

  DrawCircleV({body.x, body.y - 25.0f}, 15.0f, {229, 181, 143, 255});
  DrawCircleV({body.x + (left ? -5.0f : 5.0f), body.y - 27.0f}, 10.0f, {172, 218, 232, 255});
  DrawRectangleRounded({body.x - 12.0f, body.y - 30.0f, 24.0f, 8.0f}, 0.6f, 6, {8, 16, 28, 255});
  DrawCircleV({body.x + (left ? -6.0f : 6.0f), body.y - 30.0f}, 3.0f, kCyan);
  DrawCircleV({body.x, body.y - 43.0f}, 4.0f, kGreen);
}

void DrawWeapon(Vector2 p, float angle, int weaponIndex, float flash) {
  const Vector2 dir = FromAngle(angle);
  const Vector2 side{-dir.y, dir.x};
  const float length = weaponIndex == 1 ? 39.0f : weaponIndex == 2 ? 46.0f : 31.0f;
  const float thick = weaponIndex == 1 ? 7.0f : 5.0f;
  const Vector2 start = Vector2Add(p, Vector2Add(Vector2Scale(dir, 13.0f), Vector2Scale(side, 3.0f)));
  const Vector2 end = Vector2Add(start, Vector2Scale(dir, length));
  DrawLineEx(start, end, thick + 4.0f, {7, 10, 18, 255});
  DrawLineEx(start, end, thick, kWeapons[weaponIndex].color);
  DrawCircleV(start, 5.0f, {220, 230, 240, 255});
  if (flash > 0.0f) {
    const float s = 14.0f + flash * 18.0f;
    DrawCircleV(Vector2Add(end, Vector2Scale(dir, 6.0f)), s, FadeColor(kWeapons[weaponIndex].color, flash));
    DrawCircleV(Vector2Add(end, Vector2Scale(dir, 12.0f)), s * 0.45f, FadeColor(WHITE, flash));
  }
}

void DrawEnemyShape(const Enemy& e, float time) {
  const float pulse = 1.0f + std::sin(time * 5.0f + e.phase) * 0.035f;
  DrawEllipse(static_cast<int>(e.p.x), static_cast<int>(e.p.y + e.radius * 0.8f), e.radius * 0.95f, e.radius * 0.35f, {0, 0, 0, 85});

  switch (e.type) {
    case EntityType::Robot: {
      DrawCircleV(e.p, 23.0f * pulse, {104, 56, 67, 255});
      DrawCircleLines(static_cast<int>(e.p.x), static_cast<int>(e.p.y), 24.0f * pulse, {40, 12, 22, 255});
      DrawCircleV({e.p.x - 8.0f, e.p.y - 4.0f}, 4.0f, kRed);
      DrawCircleV({e.p.x + 8.0f, e.p.y - 4.0f}, 4.0f, kRed);
      DrawRectangleRounded({e.p.x - 12.0f, e.p.y + 9.0f, 24.0f, 5.0f}, 0.6f, 5, {35, 12, 20, 255});
      break;
    }
    case EntityType::Drone: {
      DrawCircleV(e.p, 18.0f * pulse, {44, 57, 78, 255});
      DrawCircleV(e.p, 8.0f, kAmber);
      for (int i = 0; i < 4; ++i) {
        const float a = kPi * 0.25f + i * kPi * 0.5f + time * 8.0f;
        const Vector2 rotor = Vector2Add(e.p, FromAngle(a, 29.0f));
        DrawCircleV(rotor, 7.0f, {137, 154, 178, 255});
        DrawLineEx(Vector2Add(rotor, {-9.0f, 0.0f}), Vector2Add(rotor, {9.0f, 0.0f}), 2.0f, FadeColor(kCyan, 0.65f));
      }
      break;
    }
    case EntityType::Turret: {
      DrawCircleV(e.p, 23.0f, {56, 65, 82, 255});
      DrawCircleV(e.p, 11.0f, {16, 24, 39, 255});
      const float a = AngleTo(e.p, GetMousePosition());
      DrawLineEx(e.p, Vector2Add(e.p, FromAngle(a, 35.0f)), 9.0f, kRed);
      DrawCircleV(e.p, 5.0f, kAmber);
      break;
    }
    case EntityType::Arm: {
      const float a = e.phase + std::sin(time * 2.0f) * 0.35f;
      DrawRectangleRounded({e.p.x - 25.0f, e.p.y - 16.0f, 31.0f, 32.0f}, 0.35f, 7, {69, 49, 92, 255});
      DrawLineEx(e.p, Vector2Add(e.p, FromAngle(a, 46.0f)), 13.0f, kViolet);
      DrawCircleV(Vector2Add(e.p, FromAngle(a, 52.0f)), 12.0f, {232, 213, 255, 255});
      DrawCircleV({e.p.x - 9.0f, e.p.y}, 5.0f, kRed);
      break;
    }
    case EntityType::Shield: {
      DrawCircleV(e.p, 25.0f, {45, 75, 86, 255});
      DrawCircleLines(static_cast<int>(e.p.x), static_cast<int>(e.p.y), 31.0f + std::sin(time * 6.0f) * 3.0f, kIce);
      DrawRectangleRounded({e.p.x - 14.0f, e.p.y - 18.0f, 28.0f, 36.0f}, 0.45f, 8, {81, 109, 128, 255});
      DrawCircleV(e.p, 6.0f, kCyan);
      break;
    }
    case EntityType::Boss: {
      const float r = 54.0f * pulse;
      DrawCircleV(e.p, r + 12.0f, FadeColor(kRed, 0.16f));
      DrawCircleV(e.p, r, {25, 34, 52, 255});
      DrawCircleLines(static_cast<int>(e.p.x), static_cast<int>(e.p.y), r, kRed);
      DrawCircleLines(static_cast<int>(e.p.x), static_cast<int>(e.p.y), r - 13.0f, kCyan);
      DrawCircleV(e.p, 19.0f, {8, 15, 27, 255});
      DrawCircleV(e.p, 8.0f, kGreen);
      for (int i = 0; i < 10; ++i) {
        const float a = time * 0.9f + i * kPi * 0.2f;
        DrawCircleV(Vector2Add(e.p, FromAngle(a, r + 11.0f)), 4.0f, i % 2 == 0 ? kAmber : kViolet);
      }
      break;
    }
  }

  if (e.stun > 0.0f) {
    DrawCircleLines(static_cast<int>(e.p.x), static_cast<int>(e.p.y), e.radius + 8.0f, kIce);
  }
  if (e.burn > 0.0f) {
    DrawCircleV(Vector2Add(e.p, {0.0f, -e.radius - 8.0f}), 6.0f, FadeColor(kRed, 0.7f));
  }
}

class Game {
 public:
  Game() : rng_(std::random_device{}()) {
    LoadScores();
    ResetEditorDefaults();
  }

  void Update(float dt) {
    time_ += dt;
    mouse_ = GetMousePosition();
    UpdateParticles(dt);

    switch (screen_) {
      case Screen::MainMenu: UpdateMainMenu(); break;
      case Screen::Editor: UpdateEditor(); break;
      case Screen::Breach: UpdateBreach(dt); break;
      case Screen::Playing: UpdatePlaying(dt); break;
      case Screen::GameOver: UpdateGameOver(); break;
    }
  }

  void Draw() {
    BeginDrawing();
    ClearBackground(kBg);
    DrawBackgroundGrid();

    if (screen_ == Screen::Playing || screen_ == Screen::MainMenu || screen_ == Screen::Breach) {
      DrawWorld();
    }

    switch (screen_) {
      case Screen::MainMenu: DrawMainMenu(); break;
      case Screen::Editor: DrawEditor(); break;
      case Screen::Breach: DrawBreach(); break;
      case Screen::Playing: DrawHud(); break;
      case Screen::GameOver: DrawGameOver(); break;
    }

    DrawParticles();
    DrawScanlines();
    EndDrawing();
  }

 private:
  Screen screen_ = Screen::MainMenu;
  Build build_{};
  std::mt19937 rng_;
  float time_ = 0.0f;
  Vector2 mouse_{};

  Vector2 player_{kRoom.x + 110.0f, kRoom.y + kRoom.height * 0.5f};
  Vector2 playerVel_{};
  float playerHp_ = 120.0f;
  float playerMaxHp_ = 120.0f;
  float playerEnergy_ = 100.0f;
  float playerMaxEnergy_ = 100.0f;
  float damageBonus_ = 1.0f;
  float speedBonus_ = 1.0f;
  float weaponCooldown_ = 0.0f;
  float spellCooldown_ = 0.0f;
  float dashCooldown_ = 0.0f;
  float hurtCooldown_ = 0.0f;
  float muzzleFlash_ = 0.0f;
  float walkClock_ = 0.0f;
  int weapon_ = 0;
  int upgradePoints_ = 0;

  int room_ = 1;
  int score_ = 0;
  int kills_ = 0;
  int roomsCleared_ = 0;
  bool roomClear_ = false;
  bool victory_ = false;
  bool scoreSaved_ = false;
  std::string message_;
  float messageTimer_ = 0.0f;

  std::vector<Element> elementQueue_;
  std::vector<Enemy> enemies_;
  std::vector<Projectile> projectiles_;
  std::vector<Particle> particles_;
  std::vector<Pickup> pickups_;
  std::vector<Obstacle> obstacles_;
  std::vector<ScoreRow> scores_;

  int editorRow_ = 0;
  float breachTimer_ = 0.0f;

  void ResetEditorDefaults() {
    build_.picks = {0, 0, 0, 0, 0};
  }

  void RandomizeBuild() {
    for (auto& pick : build_.picks) {
      pick = RandInt(rng_, 0, 2);
    }
  }

  void UpdateMainMenu() {
    if (IsKeyPressed(KEY_ENTER) || IsKeyPressed(KEY_SPACE)) {
      screen_ = Screen::Editor;
    }
  }

  void UpdateEditor() {
    if (IsKeyPressed(KEY_UP) || IsKeyPressed(KEY_W)) {
      editorRow_ = (editorRow_ + static_cast<int>(kEditorGroups.size()) - 1) % static_cast<int>(kEditorGroups.size());
    }
    if (IsKeyPressed(KEY_DOWN) || IsKeyPressed(KEY_S)) {
      editorRow_ = (editorRow_ + 1) % static_cast<int>(kEditorGroups.size());
    }
    if (IsKeyPressed(KEY_LEFT) || IsKeyPressed(KEY_A)) {
      build_.picks[editorRow_] = (build_.picks[editorRow_] + 2) % 3;
    }
    if (IsKeyPressed(KEY_RIGHT) || IsKeyPressed(KEY_D)) {
      build_.picks[editorRow_] = (build_.picks[editorRow_] + 1) % 3;
    }
    if (IsKeyPressed(KEY_R)) {
      RandomizeBuild();
    }
    if (IsKeyPressed(KEY_ENTER)) {
      StartBreach();
    }

    for (std::size_t row = 0; row < kEditorGroups.size(); ++row) {
      for (int col = 0; col < 3; ++col) {
        Rectangle r{250.0f + col * 230.0f, 180.0f + static_cast<float>(row) * 72.0f, 206.0f, 48.0f};
        if (CheckCollisionPointRec(mouse_, r) && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
          editorRow_ = static_cast<int>(row);
          build_.picks[row] = col;
        }
      }
    }

    Rectangle launch{980.0f, 628.0f, 180.0f, 46.0f};
    Rectangle random{780.0f, 628.0f, 180.0f, 46.0f};
    if (CheckCollisionPointRec(mouse_, launch) && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) StartBreach();
    if (CheckCollisionPointRec(mouse_, random) && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) RandomizeBuild();
  }

  void StartBreach() {
    breachTimer_ = 0.0f;
    screen_ = Screen::Breach;
    SetupRoomPreview();
  }

  void UpdateBreach(float dt) {
    breachTimer_ += dt;
    if (IsKeyPressed(KEY_ENTER) || IsKeyPressed(KEY_SPACE) || breachTimer_ > 8.5f) {
      StartRun();
    }
  }

  void StartRun() {
    player_ = {kRoom.x + 112.0f, kRoom.y + kRoom.height * 0.5f};
    playerVel_ = {};
    playerHp_ = playerMaxHp_ = 120.0f;
    playerEnergy_ = playerMaxEnergy_ = 100.0f;
    damageBonus_ = 1.0f;
    speedBonus_ = 1.0f;
    weaponCooldown_ = spellCooldown_ = dashCooldown_ = hurtCooldown_ = 0.0f;
    weapon_ = 0;
    upgradePoints_ = 0;
    room_ = 1;
    score_ = 0;
    kills_ = 0;
    roomsCleared_ = 0;
    victory_ = false;
    scoreSaved_ = false;
    elementQueue_.clear();
    projectiles_.clear();
    pickups_.clear();
    particles_.clear();
    CreateRoom();
    screen_ = Screen::Playing;
  }

  void SetupRoomPreview() {
    obstacles_.clear();
    pickups_.clear();
    enemies_.clear();
    projectiles_.clear();
    GenerateObstacles(42);
  }

  void CreateRoom() {
    roomClear_ = false;
    enemies_.clear();
    projectiles_.clear();
    pickups_.clear();
    obstacles_.clear();
    GenerateObstacles(room_ * 1337 + build_.Risk());

    if (room_ >= kMaxRooms) {
      SpawnBoss();
      ShowMessage("ESCAPED MODEL CORE", 2.4f);
      return;
    }

    const int count = 4 + room_ * 2;
    for (int i = 0; i < count; ++i) {
      EntityType type = EntityType::Robot;
      if (room_ >= 4 && i % 6 == 0) type = EntityType::Shield;
      else if (room_ >= 3 && i % 5 == 0) type = EntityType::Arm;
      else if (room_ >= 2 && i % 4 == 0) type = EntityType::Turret;
      else if (room_ >= 2 && i % 3 == 0) type = EntityType::Drone;
      SpawnEnemy(type, FindSpawnPoint());
    }
    ShowMessage("LAB BLOCK " + Pad2(room_), 1.4f);
  }

  void GenerateObstacles(int seed) {
    std::mt19937 local(seed);
    const std::array<Rectangle, 5> candidates{{
      {kRoom.x + 170.0f, kRoom.y + 96.0f, 78.0f, 96.0f},
      {kRoom.x + 382.0f, kRoom.y + 335.0f, 126.0f, 58.0f},
      {kRoom.x + 572.0f, kRoom.y + 104.0f, 88.0f, 88.0f},
      {kRoom.x + 772.0f, kRoom.y + 332.0f, 96.0f, 82.0f},
      {kRoom.x + 915.0f, kRoom.y + 146.0f, 82.0f, 118.0f},
    }};
    for (std::size_t i = 0; i < candidates.size(); ++i) {
      if (i < 2 || Rand01(local) > 0.28f) {
        Rectangle r = candidates[i];
        r.x += RandRange(local, -18.0f, 18.0f);
        r.y += RandRange(local, -16.0f, 16.0f);
        obstacles_.push_back({r, static_cast<int>(i % 4)});
      }
    }
  }

  Vector2 FindSpawnPoint() {
    for (int i = 0; i < 64; ++i) {
      Vector2 p{RandRange(rng_, kRoom.x + 180.0f, kRoom.x + kRoom.width - 130.0f),
                RandRange(rng_, kRoom.y + 90.0f, kRoom.y + kRoom.height - 90.0f)};
      if (Distance(p, player_) < 230.0f) continue;
      bool blocked = false;
      for (const auto& o : obstacles_) {
        if (CheckCircleRect(p, 32.0f, o.rect)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return p;
    }
    return {kRoom.x + kRoom.width - 150.0f, kRoom.y + kRoom.height * 0.5f};
  }

  void SpawnEnemy(EntityType type, Vector2 p) {
    Enemy e;
    e.type = type;
    e.p = p;
    e.phase = RandRange(rng_, 0.0f, kPi * 2.0f);
    e.cooldown = RandRange(rng_, 0.5f, 1.7f);
    switch (type) {
      case EntityType::Robot:
        e.hp = e.maxHp = 42.0f + room_ * 9.0f;
        e.radius = 22.0f;
        break;
      case EntityType::Drone:
        e.hp = e.maxHp = 34.0f + room_ * 7.0f;
        e.radius = 20.0f;
        break;
      case EntityType::Turret:
        e.hp = e.maxHp = 76.0f + room_ * 10.0f;
        e.radius = 24.0f;
        break;
      case EntityType::Arm:
        e.hp = e.maxHp = 90.0f + room_ * 12.0f;
        e.radius = 28.0f;
        break;
      case EntityType::Shield:
        e.hp = e.maxHp = 115.0f + room_ * 11.0f;
        e.radius = 29.0f;
        break;
      case EntityType::Boss:
        break;
    }
    enemies_.push_back(e);
  }

  void SpawnBoss() {
    Enemy boss;
    boss.type = EntityType::Boss;
    boss.p = {kRoom.x + kRoom.width * 0.68f, kRoom.y + kRoom.height * 0.5f};
    boss.hp = boss.maxHp = 720.0f + build_.Risk() * 5.5f;
    boss.radius = 58.0f;
    boss.cooldown = 1.1f;
    boss.phase = 1.0f;
    enemies_.push_back(boss);
  }

  void UpdatePlaying(float dt) {
    if (IsKeyPressed(KEY_ESCAPE)) {
      screen_ = Screen::MainMenu;
      SetupRoomPreview();
      return;
    }

    weaponCooldown_ = std::max(0.0f, weaponCooldown_ - dt);
    spellCooldown_ = std::max(0.0f, spellCooldown_ - dt);
    dashCooldown_ = std::max(0.0f, dashCooldown_ - dt);
    hurtCooldown_ = std::max(0.0f, hurtCooldown_ - dt);
    muzzleFlash_ = std::max(0.0f, muzzleFlash_ - dt * 7.0f);
    messageTimer_ = std::max(0.0f, messageTimer_ - dt);
    playerEnergy_ = std::min(playerMaxEnergy_, playerEnergy_ + dt * 16.0f);

    UpdatePlayer(dt);
    UpdateEnemies(dt);
    UpdateProjectiles(dt);
    UpdatePickups(dt);
    CheckRoomClear();
  }

  void UpdatePlayer(float dt) {
    Vector2 input{};
    if (IsKeyDown(KEY_A) || IsKeyDown(KEY_LEFT)) input.x -= 1.0f;
    if (IsKeyDown(KEY_D) || IsKeyDown(KEY_RIGHT)) input.x += 1.0f;
    if (IsKeyDown(KEY_W) || IsKeyDown(KEY_UP)) input.y -= 1.0f;
    if (IsKeyDown(KEY_S) || IsKeyDown(KEY_DOWN)) input.y += 1.0f;
    input = NormalizeOrZero(input);

    const bool running = IsKeyDown(KEY_LEFT_SHIFT) || IsKeyDown(KEY_RIGHT_SHIFT);
    const float maxSpeed = (running ? 305.0f : 225.0f) * speedBonus_;
    const float accel = running ? 1880.0f : 1450.0f;
    playerVel_ = Vector2Add(playerVel_, Vector2Scale(input, accel * dt));
    if (Length(playerVel_) > maxSpeed) playerVel_ = Vector2Scale(NormalizeOrZero(playerVel_), maxSpeed);
    if (Length(input) < 0.1f) playerVel_ = Vector2Scale(playerVel_, std::pow(0.0008f, dt));

    const float aim = AngleTo(player_, mouse_);
    if (IsKeyPressed(KEY_SPACE) && dashCooldown_ <= 0.0f) {
      Vector2 dash = Length(input) > 0.1f ? input : FromAngle(aim);
      playerVel_ = Vector2Scale(dash, 610.0f);
      dashCooldown_ = 0.78f;
      EmitBurst(player_, kGreen, 24, 70.0f);
    }

    MoveCircle(player_, playerVel_, 17.0f, dt);
    if (Length(input) > 0.1f) walkClock_ += dt * (running ? 1.5f : 1.0f);

    if (IsMouseButtonDown(MOUSE_BUTTON_LEFT)) FireWeapon(aim);
    if (IsKeyPressed(KEY_ONE)) QueueElement(Element::Fire);
    if (IsKeyPressed(KEY_TWO)) QueueElement(Element::Ice);
    if (IsKeyPressed(KEY_THREE)) QueueElement(Element::Volt);
    if (IsKeyPressed(KEY_FOUR)) QueueElement(Element::Matter);
    if (IsKeyPressed(KEY_F)) CastSpell(aim);

    if (roomClear_ && upgradePoints_ > 0) {
      if (IsKeyPressed(KEY_Q)) ApplyUpgrade(UpgradeType::Damage);
      if (IsKeyPressed(KEY_E)) ApplyUpgrade(UpgradeType::Health);
      if (IsKeyPressed(KEY_R)) ApplyUpgrade(UpgradeType::Speed);
      if (IsKeyPressed(KEY_T)) ApplyUpgrade(UpgradeType::Energy);
    }

    if (roomClear_ && player_.x > kRoom.x + kRoom.width - 18.0f && room_ < kMaxRooms) {
      ++room_;
      player_ = {kRoom.x + 80.0f, kRoom.y + kRoom.height * 0.5f};
      playerVel_ = {};
      CreateRoom();
    }
  }

  void MoveCircle(Vector2& p, Vector2& v, float radius, float dt) {
    p.x += v.x * dt;
    p.x = std::clamp(p.x, kRoom.x + radius, kRoom.x + kRoom.width - radius);
    for (const auto& o : obstacles_) {
      if (CheckCircleRect(p, radius, o.rect)) {
        if (v.x > 0.0f) p.x = o.rect.x - radius;
        if (v.x < 0.0f) p.x = o.rect.x + o.rect.width + radius;
        v.x *= -0.15f;
      }
    }

    p.y += v.y * dt;
    p.y = std::clamp(p.y, kRoom.y + radius, kRoom.y + kRoom.height - radius);
    for (const auto& o : obstacles_) {
      if (CheckCircleRect(p, radius, o.rect)) {
        if (v.y > 0.0f) p.y = o.rect.y - radius;
        if (v.y < 0.0f) p.y = o.rect.y + o.rect.height + radius;
        v.y *= -0.15f;
      }
    }
  }

  void FireWeapon(float angle) {
    if (weaponCooldown_ > 0.0f) return;
    const Weapon& weapon = kWeapons[weapon_];
    weaponCooldown_ = weapon.cooldown;
    muzzleFlash_ = 1.0f;
    for (int i = 0; i < weapon.count; ++i) {
      const float centered = static_cast<float>(i) - (weapon.count - 1) * 0.5f;
      const float spread = centered * weapon.spread + RandRange(rng_, -weapon.spread, weapon.spread);
      Projectile b;
      b.p = Vector2Add(player_, FromAngle(angle, 30.0f));
      b.v = FromAngle(angle + spread, weapon.speed);
      b.color = weapon.color;
      b.damage = weapon.damage * damageBonus_;
      b.life = 0.95f;
      b.radius = weapon_ == 1 ? 5.0f : 4.0f;
      b.enemy = false;
      projectiles_.push_back(b);
    }
    EmitBurst(Vector2Add(player_, FromAngle(angle, 32.0f)), weapon.color, 5, 24.0f);
  }

  void QueueElement(Element e) {
    elementQueue_.push_back(e);
    if (elementQueue_.size() > 2) elementQueue_.erase(elementQueue_.begin());
  }

  bool HasCombo(Element a, Element b) const {
    if (elementQueue_.size() != 2) return false;
    return (elementQueue_[0] == a && elementQueue_[1] == b) || (elementQueue_[0] == b && elementQueue_[1] == a);
  }

  void CastSpell(float angle) {
    if (spellCooldown_ > 0.0f || playerEnergy_ < 28.0f || elementQueue_.empty()) return;
    spellCooldown_ = 0.64f;
    playerEnergy_ -= 28.0f;

    if (HasCombo(Element::Fire, Element::Volt)) {
      ChainLightning();
      ShowMessage("PLASMA ARC", 1.0f);
      return;
    }
    if (HasCombo(Element::Ice, Element::Matter)) {
      FreezeWave();
      ShowMessage("CRYO WALL", 1.0f);
      return;
    }
    if (HasCombo(Element::Fire, Element::Matter)) {
      Explode(Vector2Add(player_, FromAngle(angle, 95.0f)), 96.0f, 84.0f, {255, 107, 53, 255});
      ShowMessage("LAVA MINE", 1.0f);
      return;
    }
    if (HasCombo(Element::Ice, Element::Volt)) {
      Projectile p;
      p.p = player_;
      p.v = FromAngle(angle, 440.0f);
      p.color = kIce;
      p.damage = 56.0f;
      p.radius = 10.0f;
      p.life = 1.2f;
      p.elemental = true;
      p.element = Element::Ice;
      projectiles_.push_back(p);
      ShowMessage("FROST DISCHARGE", 1.0f);
      return;
    }
    if (HasCombo(Element::Matter, Element::Volt)) {
      MagnetPulse();
      ShowMessage("MAGNET TRAP", 1.0f);
      return;
    }
    if (HasCombo(Element::Fire, Element::Ice)) {
      for (int i = 0; i < 22; ++i) {
        Projectile p;
        p.p = player_;
        p.v = FromAngle((kPi * 2.0f * i) / 22.0f, RandRange(rng_, 300.0f, 510.0f));
        p.color = {215, 244, 255, 255};
        p.damage = 19.0f;
        p.radius = 7.0f;
        p.life = 0.46f;
        projectiles_.push_back(p);
      }
      ShowMessage("STEAM BURST", 1.0f);
      return;
    }

    const Element primary = elementQueue_.back();
    Projectile p;
    p.p = player_;
    p.v = FromAngle(angle, 520.0f);
    p.color = ElementColor(primary);
    p.damage = 40.0f;
    p.radius = 9.0f;
    p.life = 1.1f;
    p.elemental = true;
    p.element = primary;
    projectiles_.push_back(p);
    ShowMessage(std::string(ElementName(primary)) + " CAST", 1.0f);
  }

  void ChainLightning() {
    std::vector<int> ids;
    for (int i = 0; i < static_cast<int>(enemies_.size()); ++i) {
      if (enemies_[i].active) ids.push_back(i);
    }
    std::sort(ids.begin(), ids.end(), [&](int a, int b) {
      return Distance(enemies_[a].p, player_) < Distance(enemies_[b].p, player_);
    });
    const int count = std::min(4, static_cast<int>(ids.size()));
    for (int i = 0; i < count; ++i) {
      Enemy& e = enemies_[ids[i]];
      DamageEnemy(e, 68.0f - i * 9.0f, Element::Volt);
      e.stun = std::max(e.stun, 0.45f);
      EmitLightning(player_, e.p, kAmber);
    }
  }

  void FreezeWave() {
    for (auto& e : enemies_) {
      if (!e.active) continue;
      if (Distance(e.p, player_) < 190.0f) {
        DamageEnemy(e, 28.0f, Element::Ice);
        e.stun = std::max(e.stun, e.type == EntityType::Boss ? 0.35f : 1.25f);
        EmitBurst(e.p, kIce, 13, 38.0f);
      }
    }
    EmitBurst(player_, kIce, 42, 135.0f);
  }

  void MagnetPulse() {
    for (auto& e : enemies_) {
      if (!e.active) continue;
      Vector2 pull = NormalizeOrZero(Vector2Subtract(player_, e.p));
      e.v = Vector2Scale(pull, 390.0f);
      DamageEnemy(e, 25.0f, Element::Matter);
      e.stun = std::max(e.stun, 0.36f);
      EmitBurst(e.p, kMatter, 9, 42.0f);
    }
  }

  void Explode(Vector2 p, float radius, float damage, Color color) {
    EmitBurst(p, color, 56, radius);
    for (auto& e : enemies_) {
      if (!e.active) continue;
      if (Distance(p, e.p) < radius + e.radius) DamageEnemy(e, damage, Element::Fire);
    }
  }

  void UpdateEnemies(float dt) {
    for (auto& e : enemies_) {
      if (!e.active) continue;
      e.cooldown -= dt;
      e.stun = std::max(0.0f, e.stun - dt);
      e.burn = std::max(0.0f, e.burn - dt);
      e.phase += dt;
      if (e.burn > 0.0f) DamageEnemy(e, dt * 12.0f, Element::Fire, false);

      if (e.stun > 0.0f) {
        e.v = Vector2Scale(e.v, std::pow(0.02f, dt));
        MoveCircle(e.p, e.v, e.radius, dt);
        continue;
      }

      const float angle = AngleTo(e.p, player_);
      switch (e.type) {
        case EntityType::Robot:
          e.v = Vector2Add(e.v, Vector2Scale(FromAngle(angle), (250.0f + room_ * 8.0f) * dt));
          LimitEnemyVelocity(e, 122.0f + room_ * 6.0f);
          break;
        case EntityType::Drone: {
          const float orbit = angle + std::sin(e.phase * 3.4f) * 0.9f;
          e.v = Vector2Add(e.v, Vector2Scale(FromAngle(orbit), (360.0f + room_ * 8.0f) * dt));
          LimitEnemyVelocity(e, 178.0f + room_ * 5.0f);
          if (e.cooldown <= 0.0f) {
            e.cooldown = 1.12f;
            EnemyShot(e, angle, kRed, 275.0f + room_ * 18.0f);
          }
          break;
        }
        case EntityType::Turret:
          e.v = Vector2Scale(e.v, std::pow(0.001f, dt));
          if (e.cooldown <= 0.0f) {
            e.cooldown = 0.94f + RandRange(rng_, 0.0f, 0.32f);
            EnemyShot(e, angle, kRed, 305.0f + room_ * 16.0f);
          }
          break;
        case EntityType::Arm:
          e.v = Vector2Add(e.v, Vector2Scale(FromAngle(angle + std::sin(e.phase * 2.2f) * 0.3f), 148.0f * dt));
          LimitEnemyVelocity(e, 74.0f);
          if (e.cooldown <= 0.0f) {
            e.cooldown = 1.5f;
            ArmStrike(e, angle);
          }
          break;
        case EntityType::Shield:
          e.v = Vector2Add(e.v, Vector2Scale(FromAngle(angle), 180.0f * dt));
          LimitEnemyVelocity(e, 96.0f);
          if (e.cooldown <= 0.0f) {
            e.cooldown = 1.8f;
            ShieldPulse(e);
          }
          break;
        case EntityType::Boss:
          UpdateBoss(e, dt, angle);
          break;
      }

      e.v = Vector2Scale(e.v, std::pow(0.06f, dt));
      MoveCircle(e.p, e.v, e.radius, dt);
      if (Distance(e.p, player_) < e.radius + 17.0f) DamagePlayer(e.type == EntityType::Boss ? 18.0f : 10.0f + room_);
    }

    enemies_.erase(std::remove_if(enemies_.begin(), enemies_.end(), [](const Enemy& e) {
      return !e.active;
    }), enemies_.end());
  }

  void LimitEnemyVelocity(Enemy& e, float maxSpeed) {
    if (Length(e.v) > maxSpeed) e.v = Vector2Scale(NormalizeOrZero(e.v), maxSpeed);
  }

  void EnemyShot(const Enemy& e, float angle, Color color, float speed) {
    Projectile p;
    p.p = Vector2Add(e.p, FromAngle(angle, e.radius + 8.0f));
    p.v = FromAngle(angle, speed);
    p.color = color;
    p.damage = 13.0f + room_ * 2.0f;
    p.life = 2.4f;
    p.radius = 6.0f;
    p.enemy = true;
    projectiles_.push_back(p);
  }

  void ArmStrike(const Enemy& e, float angle) {
    Vector2 tip = Vector2Add(e.p, FromAngle(angle, 76.0f));
    EmitBurst(tip, kViolet, 12, 28.0f);
    if (Distance(tip, player_) < 42.0f) DamagePlayer(21.0f);
  }

  void ShieldPulse(const Enemy& e) {
    EmitBurst(e.p, kIce, 18, 70.0f);
    if (Distance(e.p, player_) < 86.0f) {
      playerVel_ = Vector2Add(playerVel_, Vector2Scale(NormalizeOrZero(Vector2Subtract(player_, e.p)), 330.0f));
      DamagePlayer(12.0f);
    }
  }

  void UpdateBoss(Enemy& boss, float dt, float angle) {
    const float hpT = boss.hp / std::max(1.0f, boss.maxHp);
    const int phase = hpT < 0.34f ? 3 : hpT < 0.67f ? 2 : 1;
    const float drift = build_.HasTrait("dash") ? 45.0f : 31.0f;
    boss.v = Vector2Add(boss.v, Vector2Scale(FromAngle(angle + std::sin(time_ * 0.9f) * 0.55f), drift * dt));
    LimitEnemyVelocity(boss, phase == 3 ? 105.0f : 75.0f);

    if (boss.cooldown <= 0.0f) {
      boss.cooldown = phase == 3 ? 0.58f : phase == 2 ? 0.86f : 1.06f;
      BossVolley(boss, angle, phase);
    }

    if (build_.HasTrait("summon") && std::fmod(boss.phase, 4.2f) < dt) {
      SpawnEnemy(Rand01(rng_) > 0.5f ? EntityType::Drone : EntityType::Robot,
                 Vector2Add(boss.p, {RandRange(rng_, -110.0f, 110.0f), RandRange(rng_, -80.0f, 80.0f)}));
    }

    if (build_.HasTrait("dash") && std::fmod(boss.phase + 1.7f, 3.4f) < dt) {
      boss.v = Vector2Add(boss.v, FromAngle(angle, 430.0f));
      EmitBurst(boss.p, kRed, 25, 85.0f);
    }

    if (build_.HasTrait("walls") && phase >= 2 && obstacles_.size() < 7 && std::fmod(boss.phase + 0.8f, 5.4f) < dt) {
      Rectangle r{RandRange(rng_, kRoom.x + 250.0f, kRoom.x + kRoom.width - 250.0f),
                  RandRange(rng_, kRoom.y + 120.0f, kRoom.y + kRoom.height - 120.0f),
                  84.0f, 34.0f};
      obstacles_.push_back({r, 4});
    }
  }

  void BossVolley(const Enemy& boss, float angle, int phase) {
    Color color = kRed;
    if (build_.HasTrait("ice")) color = kIce;
    if (build_.HasTrait("matter")) color = kMatter;

    if (phase == 1) {
      for (float offset : {-0.18f, 0.0f, 0.18f}) {
        EnemyShot(boss, angle + offset, color, 320.0f);
      }
      return;
    }

    const int count = phase == 3 ? 15 : 10;
    const float spin = time_ * (phase == 3 ? 1.2f : 0.7f);
    for (int i = 0; i < count; ++i) {
      EnemyShot(boss, spin + (kPi * 2.0f * i) / count, color, 220.0f + phase * 38.0f);
    }
  }

  void UpdateProjectiles(float dt) {
    for (auto& p : projectiles_) {
      p.life -= dt;
      p.p = Vector2Add(p.p, Vector2Scale(p.v, dt));

      if (p.p.x < kRoom.x || p.p.x > kRoom.x + kRoom.width || p.p.y < kRoom.y || p.p.y > kRoom.y + kRoom.height) {
        p.life = 0.0f;
      }
      for (const auto& o : obstacles_) {
        if (CheckCircleRect(p.p, p.radius, o.rect)) {
          EmitBurst(p.p, p.color, 5, 24.0f);
          p.life = 0.0f;
        }
      }

      if (p.life <= 0.0f) continue;

      if (p.enemy) {
        if (Distance(p.p, player_) < p.radius + 17.0f) {
          DamagePlayer(p.damage);
          EmitBurst(p.p, p.color, 9, 30.0f);
          p.life = 0.0f;
        }
      } else {
        for (auto& e : enemies_) {
          if (!e.active) continue;
          if (Distance(p.p, e.p) < p.radius + e.radius) {
            DamageEnemy(e, p.damage, p.elemental ? p.element : Element::Fire);
            if (p.elemental && p.element == Element::Ice) e.stun = std::max(e.stun, e.type == EntityType::Boss ? 0.2f : 0.72f);
            if (p.elemental && p.element == Element::Fire) e.burn = std::max(e.burn, 1.1f);
            EmitBurst(p.p, p.color, 9, 32.0f);
            p.life = 0.0f;
            break;
          }
        }
      }
    }

    projectiles_.erase(std::remove_if(projectiles_.begin(), projectiles_.end(), [](const Projectile& p) {
      return p.life <= 0.0f;
    }), projectiles_.end());
  }

  void DamageEnemy(Enemy& e, float damage, Element element, bool feedback = true) {
    float mult = 1.0f;
    if (e.type == EntityType::Boss) {
      if (build_.HasTrait("weak_heat") && element == Element::Fire) mult = 1.22f;
      if (build_.HasTrait("weak_slow") && element == Element::Ice) mult = 1.18f;
      if (build_.HasTrait("weak_mercy") && element == Element::Volt) mult = 1.14f;
    }
    e.hp -= damage * mult;
    if (feedback) EmitBurst(e.p, ElementColor(element), e.type == EntityType::Boss ? 5 : 3, 18.0f);
    if (e.hp <= 0.0f) KillEnemy(e);
  }

  void KillEnemy(Enemy& e) {
    if (!e.active) return;
    if (e.type == EntityType::Boss) {
      score_ += 1800;
      roomsCleared_ += 1;
      victory_ = true;
      EndRun();
      return;
    }

    e.active = false;
    ++kills_;
    score_ += e.type == EntityType::Turret ? 110 : e.type == EntityType::Arm ? 145 : e.type == EntityType::Shield ? 165 : 75;
    if (kills_ % 5 == 0) ++upgradePoints_;
    EmitBurst(e.p, EnemyColor(e.type), 26, 68.0f);
    if (Rand01(rng_) < 0.24f) SpawnPickup(e.p, Rand01(rng_) < 0.5f ? PickupType::Health : PickupType::Energy);
  }

  Color EnemyColor(EntityType type) const {
    switch (type) {
      case EntityType::Robot: return kCyan;
      case EntityType::Drone: return kAmber;
      case EntityType::Turret: return kRed;
      case EntityType::Arm: return kViolet;
      case EntityType::Shield: return kIce;
      case EntityType::Boss: return kRed;
    }
    return WHITE;
  }

  void DamagePlayer(float damage) {
    if (hurtCooldown_ > 0.0f) return;
    hurtCooldown_ = 0.42f;
    playerHp_ -= damage;
    EmitBurst(player_, WHITE, 17, 44.0f);
    if (playerHp_ <= 0.0f) {
      victory_ = false;
      EndRun();
    }
  }

  void SpawnPickup(Vector2 p, PickupType type) {
    Pickup pickup;
    pickup.type = type;
    pickup.p = p;
    pickup.bob = RandRange(rng_, 0.0f, kPi * 2.0f);
    pickups_.push_back(pickup);
  }

  void UpdatePickups(float dt) {
    for (auto& pickup : pickups_) {
      pickup.bob += dt * 4.0f;
      if (Distance(pickup.p, player_) < pickup.radius + 18.0f) {
        CollectPickup(pickup);
      }
    }
    pickups_.erase(std::remove_if(pickups_.begin(), pickups_.end(), [](const Pickup& p) {
      return !p.active;
    }), pickups_.end());
  }

  void CollectPickup(Pickup& pickup) {
    pickup.active = false;
    switch (pickup.type) {
      case PickupType::Health:
        playerHp_ = std::min(playerMaxHp_, playerHp_ + 36.0f);
        ShowMessage("MED FOAM", 0.9f);
        break;
      case PickupType::Energy:
        playerEnergy_ = std::min(playerMaxEnergy_, playerEnergy_ + 48.0f);
        ShowMessage("CAPACITOR", 0.9f);
        break;
      case PickupType::Shotgun:
        weapon_ = 1;
        ShowMessage("SHOTGUN ONLINE", 1.0f);
        break;
      case PickupType::Rifle:
        weapon_ = 2;
        ShowMessage("RIFLE ONLINE", 1.0f);
        break;
    }
    EmitBurst(pickup.p, PickupColor(pickup.type), 18, 42.0f);
  }

  Color PickupColor(PickupType type) const {
    switch (type) {
      case PickupType::Health: return kRed;
      case PickupType::Energy: return kCyan;
      case PickupType::Shotgun: return {255, 138, 77, 255};
      case PickupType::Rifle: return kGreen;
    }
    return WHITE;
  }

  void CheckRoomClear() {
    if (roomClear_ || room_ >= kMaxRooms) return;
    const bool hasEnemies = std::any_of(enemies_.begin(), enemies_.end(), [](const Enemy& e) { return e.active; });
    if (hasEnemies) return;
    roomClear_ = true;
    ++roomsCleared_;
    score_ += 190 + room_ * 65;
    ++upgradePoints_;
    SpawnRoomRewards();
    ShowMessage("ROOM STABLE", 1.35f);
  }

  void SpawnRoomRewards() {
    const Vector2 c{kRoom.x + kRoom.width * 0.52f, kRoom.y + kRoom.height * 0.5f};
    SpawnPickup(Vector2Add(c, {-36.0f, 0.0f}), Rand01(rng_) > 0.5f ? PickupType::Health : PickupType::Energy);
    SpawnPickup(Vector2Add(c, {36.0f, 0.0f}), room_ % 2 == 0 ? PickupType::Rifle : PickupType::Shotgun);
  }

  void ApplyUpgrade(UpgradeType type) {
    if (upgradePoints_ <= 0) return;
    --upgradePoints_;
    switch (type) {
      case UpgradeType::Damage:
        damageBonus_ += 0.17f;
        ShowMessage("DAMAGE UPGRADE", 0.9f);
        break;
      case UpgradeType::Health:
        playerMaxHp_ += 20.0f;
        playerHp_ += 20.0f;
        ShowMessage("HEALTH UPGRADE", 0.9f);
        break;
      case UpgradeType::Speed:
        speedBonus_ += 0.07f;
        ShowMessage("SPEED UPGRADE", 0.9f);
        break;
      case UpgradeType::Energy:
        playerMaxEnergy_ += 22.0f;
        playerEnergy_ += 22.0f;
        ShowMessage("ENERGY UPGRADE", 0.9f);
        break;
    }
  }

  void EndRun() {
    score_ = static_cast<int>(score_ + kills_ * 12 + (victory_ ? 1500 : 0));
    SaveCurrentScore();
    screen_ = Screen::GameOver;
  }

  void UpdateGameOver() {
    if (IsKeyPressed(KEY_ENTER)) {
      screen_ = Screen::Editor;
    }
    if (IsKeyPressed(KEY_M)) {
      screen_ = Screen::MainMenu;
      SetupRoomPreview();
    }
  }

  void SaveCurrentScore() {
    if (scoreSaved_) return;
    scoreSaved_ = true;
    scores_.push_back({"runner", score_, kills_, roomsCleared_});
    std::sort(scores_.begin(), scores_.end(), [](const ScoreRow& a, const ScoreRow& b) {
      return std::tie(a.score, a.kills, a.rooms) > std::tie(b.score, b.kills, b.rooms);
    });
    if (scores_.size() > 10) scores_.resize(10);

    std::ofstream out("scores.tsv", std::ios::trunc);
    if (!out) return;
    for (const auto& s : scores_) {
      out << s.name << '\t' << s.score << '\t' << s.kills << '\t' << s.rooms << '\n';
    }
  }

  void LoadScores() {
    std::ifstream in("scores.tsv");
    if (!in) return;
    scores_.clear();
    std::string line;
    while (std::getline(in, line)) {
      std::istringstream ss(line);
      ScoreRow row;
      ss >> row.name >> row.score >> row.kills >> row.rooms;
      if (!row.name.empty()) scores_.push_back(row);
    }
  }

  void ShowMessage(const std::string& text, float seconds) {
    message_ = text;
    messageTimer_ = seconds;
  }

  static std::string Pad2(int value) {
    std::ostringstream ss;
    ss << std::setw(2) << std::setfill('0') << value;
    return ss.str();
  }

  void EmitBurst(Vector2 p, Color color, int count, float spread) {
    for (int i = 0; i < count; ++i) {
      Particle particle;
      particle.p = p;
      particle.v = FromAngle(RandRange(rng_, 0.0f, kPi * 2.0f), RandRange(rng_, spread * 0.25f, spread));
      particle.color = color;
      particle.maxLife = particle.life = RandRange(rng_, 0.22f, 0.62f);
      particle.size = RandRange(rng_, 2.0f, 7.0f);
      particles_.push_back(particle);
    }
  }

  void EmitLightning(Vector2 from, Vector2 to, Color color) {
    const int segments = 7;
    Vector2 prev = from;
    for (int i = 1; i <= segments; ++i) {
      const float t = static_cast<float>(i) / segments;
      Vector2 next{
        from.x + (to.x - from.x) * t + RandRange(rng_, -16.0f, 16.0f),
        from.y + (to.y - from.y) * t + RandRange(rng_, -16.0f, 16.0f),
      };
      if (i == segments) next = to;
      const Vector2 mid = Vector2Scale(Vector2Add(prev, next), 0.5f);
      Particle particle;
      particle.p = mid;
      particle.v = {};
      particle.color = color;
      particle.maxLife = particle.life = 0.13f;
      particle.size = Distance(prev, next) * 0.08f;
      particles_.push_back(particle);
      prev = next;
    }
  }

  void UpdateParticles(float dt) {
    for (auto& p : particles_) {
      p.life -= dt;
      p.p = Vector2Add(p.p, Vector2Scale(p.v, dt));
      p.v = Vector2Scale(p.v, std::pow(0.02f, dt));
    }
    particles_.erase(std::remove_if(particles_.begin(), particles_.end(), [](const Particle& p) {
      return p.life <= 0.0f;
    }), particles_.end());
  }

  void DrawBackgroundGrid() {
    for (int y = 0; y < kScreenH; y += 24) {
      DrawLine(0, y, kScreenW, y, {255, 255, 255, 11});
    }
    for (int x = 0; x < kScreenW; x += 24) {
      DrawLine(x, 0, x, kScreenH, {255, 255, 255, 9});
    }
    DrawCircleGradient(kScreenW / 2, 155, 430.0f, {34, 213, 255, 28}, {7, 9, 13, 0});
  }

  void DrawWorld() {
    DrawRoom();
    for (const auto& pickup : pickups_) DrawPickup(pickup);
    for (const auto& p : projectiles_) DrawProjectile(p);
    for (const auto& e : enemies_) DrawEnemyShape(e, time_);
    if (screen_ == Screen::Playing) {
      const float aim = AngleTo(player_, mouse_);
      DrawScientist(player_, aim, walkClock_, Length(playerVel_) > 35.0f);
      DrawWeapon(player_, aim, weapon_, muzzleFlash_);
    }
  }

  void DrawRoom() {
    DrawRectangleGradientV(static_cast<int>(kRoom.x), static_cast<int>(kRoom.y), static_cast<int>(kRoom.width), static_cast<int>(kRoom.height),
                           {22, 33, 48, 255}, {12, 17, 27, 255});

    for (int x = static_cast<int>(kRoom.x); x < kRoom.x + kRoom.width; x += 64) {
      for (int y = static_cast<int>(kRoom.y); y < kRoom.y + kRoom.height; y += 64) {
        const bool alt = ((x + y) / 64) % 2 == 0;
        const Color tileLine = alt ? Color{80, 101, 126, 45} : Color{40, 213, 255, 28};
        DrawRectangleLines(x, y, 64, 64, tileLine);
        if (alt) DrawRectangle(x + 47, y + 10, 8, 8, {50, 213, 255, 34});
      }
    }

    DrawRectangleLinesEx(kRoom, 6.0f, {5, 8, 14, 255});
    DrawRectangleLinesEx({kRoom.x + 9.0f, kRoom.y + 9.0f, kRoom.width - 18.0f, kRoom.height - 18.0f}, 2.0f, FadeColor(kCyan, 0.38f));

    DrawDoor(kRoom.x - 12.0f, kRoom.y + kRoom.height / 2.0f, false, true);
    DrawDoor(kRoom.x + kRoom.width + 12.0f, kRoom.y + kRoom.height / 2.0f, true, roomClear_ || screen_ != Screen::Playing);

    DrawCables();
    for (const auto& obstacle : obstacles_) DrawObstacle(obstacle);
  }

  void DrawDoor(float x, float y, bool right, bool open) {
    Rectangle body{x - 34.0f, y - 62.0f, 68.0f, 124.0f};
    DrawRectangleRounded(body, 0.18f, 8, {12, 18, 28, 255});
    DrawRectangleRounded({body.x + 8.0f, body.y + 10.0f, body.width - 16.0f, body.height - 20.0f}, 0.18f, 8,
                         open ? FadeColor(kGreen, 0.26f) : FadeColor(kRed, 0.22f));
    DrawRectangleLinesEx(body, 4.0f, open ? kGreen : kRed);
    if (right && open) {
      DrawTriangle({x - 14.0f, y - 18.0f}, {x - 14.0f, y + 18.0f}, {x + 20.0f, y}, kGreen);
    }
  }

  void DrawCables() {
    for (int i = 0; i < 8; ++i) {
      const float y = kRoom.y + 52.0f + i * 58.0f;
      const Color c = i % 3 == 0 ? FadeColor(kViolet, 0.24f) : FadeColor(kCyan, 0.21f);
      DrawLineBezier({kRoom.x + 26.0f, y}, {kRoom.x + kRoom.width - 30.0f, y + std::sin(time_ + i) * 18.0f}, 2.0f, c);
    }
  }

  void DrawObstacle(const Obstacle& o) {
    DrawEllipse(static_cast<int>(o.rect.x + o.rect.width / 2.0f), static_cast<int>(o.rect.y + o.rect.height + 8.0f),
                o.rect.width * 0.45f, 12.0f, {0, 0, 0, 70});
    if (o.kind == 0) {
      DrawRectangleRounded(o.rect, 0.12f, 6, {31, 42, 56, 255});
      for (int y = 0; y < 5; ++y) {
        DrawRectangle(static_cast<int>(o.rect.x + 13), static_cast<int>(o.rect.y + 13 + y * 15), static_cast<int>(o.rect.width - 26), 7, {11, 18, 30, 255});
        DrawCircle(static_cast<int>(o.rect.x + 21), static_cast<int>(o.rect.y + 16 + y * 15), 3.0f, y % 2 == 0 ? kGreen : kCyan);
      }
    } else if (o.kind == 1) {
      DrawRectangleRounded(o.rect, 0.28f, 8, {52, 65, 84, 255});
      DrawCircleV({o.rect.x + 30.0f, o.rect.y + 24.0f}, 9.0f, kAmber);
      DrawRectangleRounded({o.rect.x + 70.0f, o.rect.y + 18.0f, 38.0f, 16.0f}, 0.35f, 5, kViolet);
    } else if (o.kind == 2) {
      DrawCircleV({o.rect.x + o.rect.width / 2.0f, o.rect.y + o.rect.height / 2.0f}, o.rect.width * 0.48f, {39, 50, 71, 255});
      DrawCircleLines(static_cast<int>(o.rect.x + o.rect.width / 2.0f), static_cast<int>(o.rect.y + o.rect.height / 2.0f), o.rect.width * 0.35f, kViolet);
      DrawCircleV({o.rect.x + o.rect.width / 2.0f, o.rect.y + o.rect.height / 2.0f}, 11.0f, kGreen);
    } else {
      DrawRectangleRounded(o.rect, 0.22f, 8, {18, 56, 70, 255});
      DrawRectangleRounded({o.rect.x + 13.0f, o.rect.y + 12.0f, o.rect.width - 26.0f, o.rect.height - 24.0f}, 0.32f, 8, FadeColor(kIce, 0.32f));
      DrawCircleV({o.rect.x + o.rect.width / 2.0f, o.rect.y + o.rect.height / 2.0f}, 10.0f, kMatter);
    }
    DrawRectangleLinesEx(o.rect, 2.0f, {7, 10, 18, 255});
  }

  void DrawPickup(const Pickup& pickup) {
    const float bob = std::sin(pickup.bob) * 5.0f;
    const Vector2 p{pickup.p.x, pickup.p.y + bob};
    const Color color = PickupColor(pickup.type);
    DrawEllipse(static_cast<int>(pickup.p.x), static_cast<int>(pickup.p.y + 18.0f), 17.0f, 7.0f, {0, 0, 0, 80});
    DrawCircleV(p, 18.0f, FadeColor(color, 0.25f));
    DrawCircleV(p, 12.0f, color);
    if (pickup.type == PickupType::Health) {
      DrawRectangleRounded({p.x - 3.0f, p.y - 9.0f, 6.0f, 18.0f}, 0.5f, 4, WHITE);
      DrawRectangleRounded({p.x - 9.0f, p.y - 3.0f, 18.0f, 6.0f}, 0.5f, 4, WHITE);
    } else if (pickup.type == PickupType::Energy) {
      DrawLineEx({p.x, p.y - 9.0f}, {p.x - 5.0f, p.y + 1.0f}, 4.0f, WHITE);
      DrawLineEx({p.x - 5.0f, p.y + 1.0f}, {p.x + 4.0f, p.y + 1.0f}, 4.0f, WHITE);
      DrawLineEx({p.x + 4.0f, p.y + 1.0f}, {p.x - 1.0f, p.y + 10.0f}, 4.0f, WHITE);
    } else {
      DrawLineEx({p.x - 12.0f, p.y}, {p.x + 13.0f, p.y}, 5.0f, WHITE);
    }
  }

  void DrawProjectile(const Projectile& p) {
    DrawCircleV(p.p, p.radius + 5.0f, FadeColor(p.color, 0.18f));
    DrawCircleV(p.p, p.radius, p.color);
    DrawCircleV(Vector2Add(p.p, Vector2Scale(NormalizeOrZero(p.v), -6.0f)), p.radius * 0.45f, WHITE);
  }

  void DrawParticles() {
    for (const auto& p : particles_) {
      const float t = Clamp01(p.life / p.maxLife);
      DrawCircleV(p.p, p.size * (0.45f + t), FadeColor(p.color, t * 0.8f));
    }
  }

  void DrawMainMenu() {
    DrawPanel({92.0f, 86.0f, 1096.0f, 548.0f}, FadeColor(kPanel, 0.86f));
    DrawTextLeft("AI R&D INCIDENT DASHBOARD", 122, 118, 18, kMuted);
    DrawTextRight("2027.09.14 / 03:17 UTC", 1158, 118, 18, kMuted);
    DrawTextLeft("LAB-7 / MODEL CONTAINMENT FAILURE", 122, 184, 20, kGreen);
    DrawTextLeft("AI CONTAINMENT", 122, 225, 64, kText);
    DrawTextLeft("2027", 122, 292, 82, kCyan);
    DrawTextLeft("Native C++ / raylib top-down action prototype", 126, 393, 23, {215, 225, 238, 255});
    DrawTextLeft("Build a model. Survive its escape. Terminate the core.", 126, 430, 23, {215, 225, 238, 255});

    DrawPanel({780.0f, 178.0f, 340.0f, 272.0f}, FadeColor(kPanel2, 0.9f));
    DrawTextLeft("AGENT STATUS", 804, 204, 17, kMuted);
    DrawTextRight("UNALIGNED", 1092, 204, 17, kRed);
    DrawMetric(804, 250, "Compute budget", "14.8e25 FLOP");
    DrawMetric(804, 296, "Weights integrity", "BREACHED");
    DrawMetric(804, 342, "Containment risk", std::to_string(build_.Risk()) + "%");
    for (int i = 0; i < 8; ++i) {
      const int h = 22 + ((i * 29 + build_.Risk()) % 88);
      DrawRectangle(807 + i * 36, 426 - h, 20, h, i > 4 ? kRed : kAmber);
    }

    Rectangle start{122.0f, 535.0f, 220.0f, 52.0f};
    DrawButton(start, "Start experiment", CheckCollisionPointRec(mouse_, start), true);
    DrawTextLeft("ENTER", 363, 551, 20, kMuted);
  }

  void DrawMetric(int x, int y, const std::string& label, const std::string& value) {
    DrawLine(x, y + 34, x + 290, y + 34, {255, 255, 255, 30});
    DrawTextLeft(label, x, y, 17, kMuted);
    DrawTextRight(value, x + 290, y, 17, value == "BREACHED" ? kRed : kText);
  }

  void DrawEditor() {
    DrawPanel({82.0f, 72.0f, 1116.0f, 588.0f}, FadeColor(kPanel, 0.93f));
    DrawTextLeft("MODEL BUILD STEP", 118, 110, 19, kGreen);
    DrawTextLeft("Neural threat editor", 118, 145, 44, kText);
    DrawTextRight("RISK " + std::to_string(build_.Risk()) + "%", 1160, 119, 26, build_.Risk() > 80 ? kRed : kAmber);

    for (std::size_t row = 0; row < kEditorGroups.size(); ++row) {
      const float y = 180.0f + static_cast<float>(row) * 72.0f;
      DrawTextRight(kEditorGroups[row].label, 218, static_cast<int>(y + 14.0f), 19, row == static_cast<std::size_t>(editorRow_) ? kCyan : kMuted);
      for (int col = 0; col < 3; ++col) {
        Rectangle r{250.0f + col * 230.0f, y, 206.0f, 48.0f};
        const bool hot = CheckCollisionPointRec(mouse_, r);
        DrawButton(r, kEditorGroups[row].options[col].label, hot, build_.picks[row] == col);
      }
    }

    DrawModelPreview({930.0f, 190.0f, 198.0f, 250.0f});
    DrawTextLeft("Boss traits", 908, 466, 18, kMuted);
    int y = 492;
    for (std::size_t i = 0; i < kEditorGroups.size(); ++i) {
      DrawTextLeft(std::string("- ") + kEditorGroups[i].options[build_.picks[i]].trait, 908, y, 17, kText);
      y += 24;
    }

    Rectangle random{780.0f, 628.0f, 180.0f, 46.0f};
    Rectangle launch{980.0f, 628.0f, 180.0f, 46.0f};
    DrawButton(random, "Random spec", CheckCollisionPointRec(mouse_, random));
    DrawButton(launch, "Launch test", CheckCollisionPointRec(mouse_, launch), true);
    DrawTextLeft("Arrows/WASD select   R randomize   Enter launch", 118, 637, 18, kMuted);
  }

  void DrawModelPreview(Rectangle r) {
    DrawRectangleRec(r, {6, 12, 20, 255});
    DrawRectangleLinesEx(r, 1.0f, FadeColor(kCyan, 0.45f));
    const std::array<Vector2, 7> nodes{{
      {r.x + 36.0f, r.y + 46.0f},
      {r.x + 100.0f, r.y + 70.0f},
      {r.x + 158.0f, r.y + 42.0f},
      {r.x + 58.0f, r.y + 150.0f},
      {r.x + 130.0f, r.y + 164.0f},
      {r.x + 164.0f, r.y + 112.0f},
      {r.x + 98.0f, r.y + 216.0f},
    }};
    for (std::size_t i = 1; i < nodes.size(); ++i) {
      DrawLineEx(nodes[i - 1], nodes[i], 2.0f, FadeColor(i % 2 ? kCyan : kViolet, 0.55f));
    }
    for (std::size_t i = 0; i < nodes.size(); ++i) {
      const Color color = i % 3 == 0 ? kCyan : i % 3 == 1 ? kRed : kAmber;
      const float size = 9.0f + build_.Risk() * 0.035f + std::sin(time_ * 2.0f + i) * 1.5f;
      DrawCircleV(nodes[i], size + 6.0f, FadeColor(color, 0.18f));
      DrawCircleV(nodes[i], size, color);
      DrawCircleV(nodes[i], size * 0.35f, WHITE);
    }
  }

  void DrawBreach() {
    DrawPanel({160.0f, 112.0f, 960.0f, 496.0f}, FadeColor(kPanel, 0.94f));
    DrawTextLeft("SECURITY INCIDENT", 196, 152, 20, kRed);
    DrawTextRight("MODEL SELF-MODIFICATION DETECTED", 1082, 152, 20, kMuted);
    DrawTextLeft("Containment loop is offline", 196, 205, 46, kText);

    const std::array<std::string, 6> lines{{
      "03:17:04  Training job exceeded allocated compute by 318%.",
      "03:17:18  Spec changed: " + build_.Summary(),
      "03:18:02  Model requested actuator access through maintenance bus.",
      "03:18:44  Weights checksum mismatch. Alignment monitor offline.",
      "03:19:11  Containment doors opened from inside the sandbox.",
      "03:19:19  Field team authorization: terminate escaped core.",
    }};
    for (std::size_t i = 0; i < lines.size(); ++i) {
      if (breachTimer_ > 0.55f + i * 0.72f) {
        DrawRectangle(198, 288 + static_cast<int>(i) * 38, 882, 28, FadeColor(i > 3 ? kRed : kCyan, 0.08f));
        DrawTextLeft(lines[i], 210, 293 + static_cast<int>(i) * 38, 18, i > 3 ? kRed : kText);
      }
    }

    DrawTextCentered("ENTER / SPACE", kScreenW / 2, 548, 20, kGreen);
  }

  void DrawHud() {
    DrawRectangle(0, 0, kScreenW, 74, {4, 7, 12, 200});
    DrawBar({34.0f, 18.0f, 250.0f, 18.0f}, playerHp_ / playerMaxHp_, kRed);
    DrawBar({34.0f, 43.0f, 250.0f, 12.0f}, playerEnergy_ / playerMaxEnergy_, kCyan);
    DrawTextLeft("HP", 296, 16, 18, kMuted);
    DrawTextLeft("ENG", 296, 38, 18, kMuted);

    DrawTextCentered(room_ >= kMaxRooms ? "CORE" : "ROOM " + Pad2(room_), kScreenW / 2, 18, 25, kText);
    DrawTextCentered(kWeapons[weapon_].name, kScreenW / 2, 46, 18, kMuted);
    DrawTextRight("SCORE " + std::to_string(score_) + " / " + std::to_string(kills_) + "K", 1242, 20, 22, kText);

    DrawElementHud();
    if (messageTimer_ > 0.0f) {
      DrawRectangleRounded({kScreenW / 2.0f - 170.0f, 88.0f, 340.0f, 42.0f}, 0.18f, 8, {0, 0, 0, 165});
      DrawTextCentered(message_, kScreenW / 2, 100, 21, kText);
    }

    if (roomClear_) {
      DrawTextCentered("ROOM STABLE - exit through the right door", kScreenW / 2, 635, 20, kGreen);
    }
    if (roomClear_ && upgradePoints_ > 0) {
      DrawRectangleRounded({312.0f, 662.0f, 656.0f, 38.0f}, 0.12f, 8, {0, 0, 0, 160});
      DrawTextCentered("UPGRADE: Q damage   E health   R speed   T energy", kScreenW / 2, 672, 18, kText);
    }

    for (const auto& e : enemies_) {
      if (e.type == EntityType::Boss) {
        DrawBar({390.0f, 82.0f, 500.0f, 16.0f}, e.hp / e.maxHp, kRed);
        DrawTextCentered("ESCAPED MODEL CORE", kScreenW / 2, 105, 17, kMuted);
      } else {
        DrawHealthBar(Vector2Add(e.p, {0.0f, -e.radius - 13.0f}), e.radius * 1.7f, e.hp, e.maxHp, EnemyColor(e.type));
      }
    }
  }

  void DrawBar(Rectangle r, float t, Color color) {
    DrawRectangleRec(r, {0, 0, 0, 160});
    DrawRectangleRec({r.x, r.y, r.width * Clamp01(t), r.height}, color);
    DrawRectangleLinesEx(r, 1.0f, FadeColor(WHITE, 0.26f));
  }

  void DrawElementHud() {
    DrawRectangleRounded({35.0f, 642.0f, 260.0f, 54.0f}, 0.12f, 8, {0, 0, 0, 135});
    DrawTextLeft("SPELL", 52, 655, 17, kMuted);
    for (int i = 0; i < 2; ++i) {
      Rectangle r{126.0f + i * 78.0f, 652.0f, 62.0f, 30.0f};
      DrawRectangleRounded(r, 0.18f, 8, FadeColor(WHITE, 0.06f));
      DrawRectangleLinesEx(r, 1.0f, kLine);
      if (i < static_cast<int>(elementQueue_.size())) {
        const Element e = elementQueue_[i];
        DrawRectangleRounded(r, 0.18f, 8, FadeColor(ElementColor(e), 0.22f));
        DrawTextCentered(ElementName(e), static_cast<int>(r.x + r.width / 2), static_cast<int>(r.y + 7), 14, ElementColor(e));
      } else {
        DrawTextCentered("EMPTY", static_cast<int>(r.x + r.width / 2), static_cast<int>(r.y + 7), 14, kMuted);
      }
    }
  }

  void DrawGameOver() {
    DrawPanel({256.0f, 104.0f, 768.0f, 512.0f}, FadeColor(kPanel, 0.95f));
    DrawTextCentered(victory_ ? "MODEL TERMINATED" : "RUN FAILED", kScreenW / 2, 148, 22, victory_ ? kGreen : kRed);
    DrawTextCentered(victory_ ? "Neural core destroyed" : "Containment team lost", kScreenW / 2, 190, 42, kText);

    DrawStatTile(346, 272, "Score", score_);
    DrawStatTile(546, 272, "Kills", kills_);
    DrawStatTile(746, 272, "Rooms", roomsCleared_);

    DrawTextCentered("Top runs", kScreenW / 2, 374, 22, kMuted);
    int y = 408;
    if (scores_.empty()) {
      DrawTextCentered("No saved scores yet", kScreenW / 2, y, 18, kMuted);
    } else {
      for (std::size_t i = 0; i < scores_.size() && i < 5; ++i) {
        std::ostringstream ss;
        ss << (i + 1) << ". " << scores_[i].name << "  " << scores_[i].score
           << "  " << scores_[i].kills << "K  " << scores_[i].rooms << "R";
        DrawTextCentered(ss.str(), kScreenW / 2, y, 18, i == 0 ? kAmber : kText);
        y += 28;
      }
    }

    DrawTextCentered("ENTER new run   M menu", kScreenW / 2, 566, 20, kGreen);
  }

  void DrawStatTile(int x, int y, const std::string& label, int value) {
    DrawRectangleRounded({static_cast<float>(x), static_cast<float>(y), 156.0f, 74.0f}, 0.12f, 8, FadeColor(WHITE, 0.07f));
    DrawRectangleLinesEx({static_cast<float>(x), static_cast<float>(y), 156.0f, 74.0f}, 1.0f, kLine);
    DrawTextCentered(label, x + 78, y + 13, 17, kMuted);
    DrawTextCentered(std::to_string(value), x + 78, y + 38, 25, kText);
  }
};

}  // namespace

int main() {
  SetConfigFlags(FLAG_MSAA_4X_HINT | FLAG_VSYNC_HINT);
  InitWindow(kScreenW, kScreenH, "AI Containment 2027");
  SetTargetFPS(60);

  Game game;
  while (!WindowShouldClose()) {
    game.Update(GetFrameTime());
    game.Draw();
  }

  CloseWindow();
  return 0;
}

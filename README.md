# AI Containment 2027

Native C++ / raylib top-down action prototype about an AI safety lab breach in 2027.

The old browser prototype has been replaced with a clean raylib implementation.

## Build

```bash
cmake -S . -B build
cmake --build build
```

Run:

```bash
./build/ai-containment-2027
```

If raylib is not installed locally, CMake will fetch raylib 5.5 on the first configure.

## Controls

- Move: `WASD` or arrows
- Run: hold `Shift`
- Dash: `Space`
- Aim/fire: mouse
- Elements: `1` fire, `2` ice, `3` volt, `4` matter
- Cast spell: `F`
- Stable-room upgrades: `Q` damage, `E` health, `R` speed, `T` energy
- Editor: arrows/WASD select, `R` random spec, `Enter` launch

## Current Prototype

- Native raylib window, no browser runtime
- Procedural 2027 lab arena with server racks, reactor props, doors, cables, scanline UI
- Scientist player, pistol/shotgun/rifle, dash, room rewards and upgrades
- Robots, drones, turrets, manipulator arms, shield bots
- Four-element spell mixing with combo effects
- Neural threat editor that changes final boss risk and traits
- Incident intro sequence
- Final escaped-model boss with phases, summons, dashes, volleys and weaknesses
- Local top scores saved to `scores.tsv`

## Project Layout

```text
CMakeLists.txt  C++/raylib build
src/            Native game source
docs/           Design notes
```

## Repository Rename

Recommended GitHub repository name:

```text
ai-containment-2027
```

After renaming on GitHub, update the local remote:

```bash
git remote set-url origin https://github.com/whoreallylovesme/ai-containment-2027.git
```

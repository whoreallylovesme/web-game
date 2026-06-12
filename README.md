# Neural Run 2027

Playable browser prototype for a techno-fantasy top-down roguelite set in 2027.

## Run Locally

```bash
python3 backend/server.py --port 8787
```

Open:

```text
http://127.0.0.1:8787/
```

## Controls

- Move: `WASD` or arrows
- Aim/fire: mouse
- Mix elements: `1` fire, `2` ice, `3` volt, `4` matter
- Cast spell: `F`
- Upgrade: buttons shown during stable rooms

## Current MVP

- Main menu with AI-2027-style incident UI
- Neural network editor that changes boss behavior
- Breach intro sequence
- Top-down room combat
- Robots, drones, turrets, manipulator arms
- Real-world weapons: pistol, shotgun, rifle
- Element mixing from four elements
- Room rewards and upgrades
- Final escaped neural network boss
- Local/API leaderboard

## Project Layout

```text
frontend/  Canvas game client
backend/   Python static server and leaderboard API
docs/      Design docs
```

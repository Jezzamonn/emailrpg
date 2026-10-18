# Command Specification

This document details the command syntax, parsing rules, and execution behavior for player inputs in the game (via email replies, web UI input, or prototype CLI).

---

## 1. Overview

Players interact with the game by sending short text commands. Commands are case-insensitive and whitespace-delimited.

A standard command consists of:
1. **Target**: Which player piece to move.
2. **Direction**: Which direction to move.
3. **Distance** *(optional)*: How many tiles to move (defaults to `1`).

### Example Commands
- `k u` — Move King up 1 tile
- `k down 2` — Move King down 2 tiles
- `k right` — Move King right 1 tile
- `k north` — Move King north (up) 1 tile
- `q left 1` — Move Queen left 1 tile

---

## 2. Command Grammar & Tokens

```
<command>   ::= <target> <ws> <direction> [<ws> <distance>]
<target>    ::= "k" | "q"
<direction> ::= <up> | <down> | <left> | <right>
<distance>  ::= "1" | "2"
```

All tokens are matched case-insensitively (e.g. `K U`, `k u`, `k Up` are all valid).

### 2.1 Target Tokens
The target specifies the player entity on the board:
- **`k`**: The King (`KingPlayer`, letter `"K"`)
- **`q`**: The Queen (`QueenPlayer`, letter `"Q"`)

> **Note**: A matching entity with that letter must be active on the current level for the action to execute. In Level 1, only the King (`k`) is spawned.

### 2.2 Direction Tokens
Directions support cardinal names, abbreviations, and compass equivalents:

| Direction | Recognized Values | Offset `(dx, dy)` |
|-----------|-------------------|-------------------|
| **Up**    | `u`, `up`, `n`, `north` | `(0, -1)` |
| **Down**  | `d`, `down`, `s`, `south` | `(0, 1)` |
| **Left**  | `l`, `left`, `w`, `west` | `(-1, 0)` |
| **Right** | `r`, `right`, `e`, `east` | `(1, 0)` |

### 2.3 Distance Tokens
- **Optional**: If omitted, distance defaults to `1`.
- **Allowed values**: Integers from `1` to `2` (`Action.isValid()` checks `1 <= dist <= 2`).

---

## 3. Parsing State Machine

Commands are parsed by `parseActions()` in `game/action.ts`. The parser processes tokens sequentially using a state machine:

```
[Start]
   │
   ▼
[Target Token]  ("k" | "q")
   │
   ▼
[Direction Token]  ("u", "up", "north", etc.)
   │
   ├───> [Distance Token] ("1" | "2") ───> [Target Token] (for chained actions)
   │
   └───> [Direction Token] (overrides direction)
```

### Parsing States:
1. **Target**: Expects `k` or `q`. Creates a new `Action`.
2. **Action (Direction)**: Expects a recognized direction from `Dirs.fromString()`. Sets `action.dir`. Transitions to `["dist", "action"]`.
3. **Distance**: If an integer token follows a direction, sets `action.dist`. Transitions back to expecting a `target`.

### Syntax Errors:
If an unexpected token is encountered, `parseActions()` throws a syntax error pointing to the exact token:
```
Something's wrong with that command: k PROBLEM HERE >>forward<<
```

---

## 4. Execution & Movement Rules

When `game.processCommand(command)` executes:

1. **Token Parsing**: Command string is parsed into `Action[]`.
2. **Entity Lookup**: The game searches `currentLevel.entities` for a `Player` matching `action.target`. If not found, command is rejected (`Couldn't find anything called <target>`).
3. **Boundary Check**: Target position `(x + dx * dist, y + dy * dist)` must be within level bounds (`0 <= x < width`, `0 <= y < height`). If out of bounds, movement is aborted.
4. **Collision & Combat**:
   - **Empty tile**: The player moves to the tile.
   - **Enemy on tile**: The enemy is killed and removed from the level (`die()`), and the player occupies the tile.
   - **Non-killable entity (e.g. obstacle or friendly)**: Movement is blocked.
5. **Turn Progression**: `currentLevel.next()` advances the world state and triggers enemy movements.

---

## 5. Current Implementation Notes & Limitations

- **Single Action Execution**: While `parseActions()` can parse multiple actions if distances are explicitly delimited (e.g. `k u 1 q d 2`), `Game.processCommand()` currently only applies the first action (`actions[0]`).
- **Implicit Distances in Sequences**: Because the parser only transitions back to `target` after a distance token, sequences without explicit distances (e.g. `k u q d`) will currently fail syntax parsing at `q`.
- **Default Player**: The King (`k`) is the primary controllable piece currently placed on the standard 9x9 board.


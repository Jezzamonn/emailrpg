import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  createGame,
  createPlayerForUser,
  processCommand,
  serializeGame,
  deserializeGame,
  createLevel,
  renderLevelText,
  levelEntitiesAt,
  levelHasEnemies,
} from "../index.ts";

describe("Data-driven game architecture & spec/levels.md", () => {
  it("game state has the exact required data structure: hubLevel and players array", () => {
    let game = createGame();
    assert.equal(game.hubLevel.width, 11);
    assert.equal(game.hubLevel.height, 11);
    assert.equal(game.hubLevel.entities.length, 0);
    assert.equal(Array.isArray(game.players), true);
    assert.equal(game.players.length, 0);

    const res = createPlayerForUser(game, "alice@example.com");
    game = res.game;

    assert.equal(game.players.length, 1);
    assert.ok(game.players[0].playerState);
    assert.equal(game.players[0].playerState.email, "alice@example.com");
    assert.equal(game.players[0].playerState.location, "hub");
  });

  it("game state is 100% strictly JSON serializable and deserializable", () => {
    let game = createGame();
    game = createPlayerForUser(game, "alice@example.com").game;
    game = createPlayerForUser(game, "bob@example.com").game;
    game = processCommand(game, "dungeon", "alice@example.com").game;
    game = processCommand(game, "down 1", "alice@example.com").game;

    // Serialize to JSON string
    const json = serializeGame(game);
    assert.equal(typeof json, "string");

    // Deserialize back into GameState
    const restored = deserializeGame(json);
    assert.equal(restored.hubLevel.width, 11);
    assert.equal(restored.players.length, 2);

    const alice = restored.players.find((p) => p.playerState.email === "alice@example.com")!;
    assert.equal(alice.playerState.location, "dungeon");
    assert.ok(alice.playerLevel);
    assert.equal(levelHasEnemies(alice.playerLevel), true);

    const bob = restored.players.find((p) => p.playerState.email === "bob@example.com")!;
    assert.equal(bob.playerState.location, "hub");
  });

  it("shared hub world is an 11x11 scene with no enemies", () => {
    const game = createGame();
    assert.equal(game.hubLevel.width, 11);
    assert.equal(game.hubLevel.height, 11);
    assert.equal(levelHasEnemies(game.hubLevel), false);
    assert.equal(game.hubLevel.entities.length, 0);
  });

  it("players join the hub world together and share state", () => {
    let game = createGame();
    game = createPlayerForUser(game, "alice@example.com").game;
    game = createPlayerForUser(game, "bob@example.com").game;

    assert.equal(game.players.length, 2);
    assert.equal(game.hubLevel.entities.some((e) => e.id === "alice@example.com"), true);
    assert.equal(game.hubLevel.entities.some((e) => e.id === "bob@example.com"), true);
  });

  it("players can move freely and overlap on the same tile", () => {
    let game = createGame();
    game = createPlayerForUser(game, "alice@example.com").game;
    game = createPlayerForUser(game, "bob@example.com").game;

    // Set positions explicitly
    const alice = game.players.find((p) => p.playerState.email === "alice@example.com")!;
    const bob = game.players.find((p) => p.playerState.email === "bob@example.com")!;
    alice.playerState.p = { x: 2, y: 2 };
    bob.playerState.p = { x: 2, y: 5 };
    game.hubLevel.entities.find((e) => e.id === "alice@example.com")!.p = { x: 2, y: 2 };
    game.hubLevel.entities.find((e) => e.id === "bob@example.com")!.p = { x: 2, y: 5 };

    // Move freely: distance 3 is allowed in hub
    const res = processCommand(game, "down 3", "alice@example.com");
    assert.equal(res.success, true);
    game = res.game;

    const updatedAlice = game.players.find((p) => p.playerState.email === "alice@example.com")!;
    const updatedBob = game.players.find((p) => p.playerState.email === "bob@example.com")!;
    assert.equal(updatedAlice.playerState.p.x, 2);
    assert.equal(updatedAlice.playerState.p.y, 5);
    assert.equal(updatedBob.playerState.p.x, 2);
    assert.equal(updatedBob.playerState.p.y, 5);

    const entitiesAtTile = levelEntitiesAt(game.hubLevel, { x: 2, y: 5 });
    assert.equal(entitiesAtTile.length, 2);
  });

  it("when rendering, picks one player on a tile, preferring the player being rendered for", () => {
    const level = createLevel(3, 3);
    level.entities.push(
      { id: "alice@example.com", type: "player", char: "🤴", p: { x: 1, y: 1 } },
      { id: "bob@example.com", type: "player", char: "👸", p: { x: 1, y: 1 } }
    );

    // Render for Alice
    const textForAlice = renderLevelText(level, "alice@example.com");
    assert.equal(textForAlice.includes("🤴"), true);

    // Render for Bob
    const textForBob = renderLevelText(level, "bob@example.com");
    assert.equal(textForBob.includes("👸"), true);
  });

  it("typing dungeon commands enters the pregenerated dungeon where each player gets their own level", () => {
    let game = createGame();
    game = createPlayerForUser(game, "alice@example.com").game;
    game = createPlayerForUser(game, "bob@example.com").game;

    // Alice enters dungeon
    const resAlice = processCommand(game, "dungeon", "alice@example.com");
    assert.equal(resAlice.success, true);
    game = resAlice.game;

    const alice = game.players.find((p) => p.playerState.email === "alice@example.com")!;
    const bob = game.players.find((p) => p.playerState.email === "bob@example.com")!;

    assert.equal(alice.playerState.location, "dungeon");
    assert.ok(alice.playerLevel);
    assert.equal(bob.playerState.location, "hub");

    // Bob enters dungeon
    const resBob = processCommand(game, "render dungeon", "bob@example.com");
    assert.equal(resBob.success, true);
    game = resBob.game;

    const updatedBob = game.players.find((p) => p.playerState.email === "bob@example.com")!;
    assert.equal(updatedBob.playerState.location, "dungeon");

    // Separate level instances
    assert.notEqual(alice.playerLevel, updatedBob.playerLevel);
    assert.equal(alice.playerLevel!.width < 11, true);
    assert.equal(levelHasEnemies(alice.playerLevel!), true);
  });

  it("movement is limited to 2 squares when enemies are present in the level", () => {
    let game = createGame();
    game = createPlayerForUser(game, "alice@example.com").game;
    game = processCommand(game, "dungeon", "alice@example.com").game;

    // Attempting to move 3 squares while enemies are present should fail
    const illegal = processCommand(game, "up 3", "alice@example.com");
    assert.equal(illegal.success, false);

    // Moving 1 or 2 squares is valid
    const valid = processCommand(game, "up 1", "alice@example.com");
    assert.equal(valid.success, true);
  });

  it("players may move freely once all enemies in the level are defeated", () => {
    let game = createGame();
    game = createPlayerForUser(game, "alice@example.com").game;
    game = processCommand(game, "dungeon", "alice@example.com").game;

    const alice = game.players.find((p) => p.playerState.email === "alice@example.com")!;
    alice.playerLevel!.entities = alice.playerLevel!.entities.filter((e) => e.type !== "enemy");
    alice.playerState.p = { x: 3, y: 5 };

    const freeMove = processCommand(game, "up 3", "alice@example.com");
    assert.equal(freeMove.success, true);
  });

  it("Game class wrapper works compatibly with existing code", () => {
    const game = new Game();
    const p1 = game.createPlayerForUser("alice@example.com");
    assert.equal(p1.email, "alice@example.com");
    assert.equal(game.hubLevel.width, 11);

    const moved = game.processCommand("down 1", "alice@example.com");
    assert.equal(moved, true);

    const entered = game.processCommand("dungeon", "alice@example.com");
    assert.equal(entered, true);

    const json = JSON.stringify(game);
    assert.equal(typeof json, "string");
  });
});

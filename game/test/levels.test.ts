import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../game.ts";
import { Level } from "../level.ts";
import { KingPlayer, QueenPlayer } from "../entity/player.ts";

describe("spec/levels.md implementation", () => {
  it("shared hub world is an 11x11 scene with no enemies", () => {
    const game = new Game();
    assert.equal(game.hubLevel.width, 11);
    assert.equal(game.hubLevel.height, 11);
    assert.equal(game.hubLevel.hasEnemies(), false);
    assert.equal(game.hubLevel.entities.length, 0);
  });

  it("players join the hub world together and share state", () => {
    const game = new Game();
    const p1 = game.createPlayerForUser("alice@example.com");
    const p2 = game.createPlayerForUser("bob@example.com");

    assert.equal(p1.level, game.hubLevel);
    assert.equal(p2.level, game.hubLevel);
    assert.equal(game.hubLevel.entities.includes(p1), true);
    assert.equal(game.hubLevel.entities.includes(p2), true);
  });

  it("players can move freely and overlap on the same tile", () => {
    const game = new Game();
    const p1 = game.createPlayerForUser("alice@example.com");
    const p2 = game.createPlayerForUser("bob@example.com");

    // Position p1 at (2, 2) and p2 at (2, 5)
    p1.p = { x: 2, y: 2 };
    p2.p = { x: 2, y: 5 };

    // Move freely: distance 3 is allowed because there are no enemies in the hub
    const moved = game.processCommand("down 3", "alice@example.com");
    assert.equal(moved, true);
    assert.equal(p1.p.x, 2);
    assert.equal(p1.p.y, 5);

    // Both players now occupy the exact same tile (2, 5)
    assert.equal(p2.p.x, 2);
    assert.equal(p2.p.y, 5);
    const entitiesAtTile = game.hubLevel.entitiesAt({ x: 2, y: 5 });
    assert.equal(entitiesAtTile.length, 2);
    assert.equal(entitiesAtTile.includes(p1), true);
    assert.equal(entitiesAtTile.includes(p2), true);
  });

  it("when rendering, picks one player on a tile, preferring the player being rendered for", () => {
    const level = new Level(3, 3);
    const p1 = new KingPlayer(level);
    p1.char = "🤴";
    p1.p = { x: 1, y: 1 };

    const p2 = new QueenPlayer(level);
    p2.char = "👸";
    p2.p = { x: 1, y: 1 };

    level.entities.push(p1, p2);

    // Render for p1: tile (1, 1) should show p1's char
    const textForP1 = level.renderText(p1);
    assert.equal(textForP1.includes("🤴"), true);

    // Render for p2: tile (1, 1) should show p2's char
    const textForP2 = level.renderText(p2);
    assert.equal(textForP2.includes("👸"), true);
  });

  it("typing dungeon commands enters the pregenerated dungeon where each player gets their own level", () => {
    const game = new Game();
    const p1 = game.createPlayerForUser("alice@example.com");
    const p2 = game.createPlayerForUser("bob@example.com");

    const u1 = game.getUser("alice@example.com")!;
    const u2 = game.getUser("bob@example.com")!;

    // Alice enters dungeon
    const entered = game.processCommand("dungeon", "alice@example.com");
    assert.equal(entered, true);
    assert.equal(u1.location, "dungeon");
    assert.notEqual(p1.level, game.hubLevel);

    // Bob is still in the hub
    assert.equal(u2.location, "hub");
    assert.equal(p2.level, game.hubLevel);

    // Now Bob enters dungeon via 'render dungeon'
    game.processCommand("render dungeon", "bob@example.com");
    assert.equal(u2.location, "dungeon");

    // Each player has their own separate level instance
    assert.notEqual(u1.dungeonLevel, u2.dungeonLevel);
    assert.notEqual(p1.level, p2.level);

    // Levels are smaller than the 11x11 hub
    assert.equal(p1.level.width < 11, true);
    assert.equal(p1.level.height < 11, true);
    assert.equal(p1.level.hasEnemies(), true);
  });

  it("movement is limited to 2 squares when enemies are present in the level", () => {
    const game = new Game();
    game.createPlayerForUser("alice@example.com");
    game.processCommand("dungeon", "alice@example.com");

    const user = game.getUser("alice@example.com")!;
    const level = user.dungeonLevel!;
    assert.equal(level.hasEnemies(), true);

    // Attempting to move 3 squares while enemies are present should fail
    const illegalMove = game.processCommand("up 3", "alice@example.com");
    assert.equal(illegalMove, false);

    // Attempting to move 2 squares or 1 square is allowed (within bounds)
    const validMove = game.processCommand("up 1", "alice@example.com");
    assert.equal(validMove, true);
  });

  it("players may move freely once all enemies in the level are defeated", () => {
    const game = new Game();
    const p1 = game.createPlayerForUser("alice@example.com");
    game.processCommand("dungeon", "alice@example.com");

    const user = game.getUser("alice@example.com")!;
    const level = user.dungeonLevel!;
    assert.equal(level.hasEnemies(), true);

    // Remove all enemies to simulate clearing the level
    level.entities = level.entities.filter((e) => e.type !== "enemy");
    assert.equal(level.hasEnemies(), false);

    // Position player safely to test moving 3 squares
    p1.p = { x: 3, y: 5 };
    const freeMove = game.processCommand("up 3", "alice@example.com");
    assert.equal(freeMove, true);
    assert.equal(p1.p.y, 2);
  });

  it("players can return to the shared hub world via hub command", () => {
    const game = new Game();
    const p1 = game.createPlayerForUser("alice@example.com");
    game.processCommand("dungeon", "alice@example.com");

    const user = game.getUser("alice@example.com")!;
    assert.equal(user.location, "dungeon");

    const left = game.processCommand("hub", "alice@example.com");
    assert.equal(left, true);
    assert.equal(user.location, "hub");
    assert.equal(p1.level, game.hubLevel);
    assert.equal(game.hubLevel.entities.includes(p1), true);
  });
});

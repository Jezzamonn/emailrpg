import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  type GameState,
  createGame,
  doPlayerAction,
  getPlayerLevel,
  createPregeneratedDungeon,
  parseAction,
  levelEntitiesAt,
  levelHasEnemies,
} from "../index.ts";

function joinGame(game: GameState, email: string): GameState {
  game = doPlayerAction(game, email, "").game;
  return doPlayerAction(game, email, "short brown hair, blue clothes").game;
}

function setPlayerPos(game: GameState, email: string, x: number, y: number) {
  const player = game.players[email];
  player.p = { x, y };
  getPlayerLevel(game, player).entities.find((e) => e.playerId === email)!.p = { x, y };
}

describe("Data-driven game architecture & spec/levels.md", () => {
  it("new players are asked what they look like before joining the hub", () => {
    let game = createGame();
    assert.equal(game.hubLevel.width, 15);
    assert.equal(game.hubLevel.height, 11);
    assert.deepEqual(game.players, {});

    const res1 = doPlayerAction(game, "alice@example.com", "hi");
    assert.equal(res1.template, "newplayer");
    game = res1.game;
    assert.equal(game.players["alice@example.com"].state, "awaiting_customization");
    assert.equal(game.hubLevel.entities.length, 0);

    const res2 = doPlayerAction(game, "alice@example.com", "Ponytail, blonde, dark skin, green");
    assert.equal(res2.template, "intro");
    game = res2.game;
    const alice = game.players["alice@example.com"];
    assert.equal(alice.state, "active");
    assert.deepEqual(alice.appearance, {
      hairType: "ponytail",
      hairColor: "blonde",
      skinColor: "dark",
      clothesColor: "green",
    });
    assert.equal(game.hubLevel.entities.some((e) => e.playerId === "alice@example.com"), true);
  });

  it("doPlayerAction does not modify the game state passed in", () => {
    const game = joinGame(createGame(), "alice@example.com");
    const before = JSON.stringify(game);
    doPlayerAction(game, "alice@example.com", "up 2");
    assert.equal(JSON.stringify(game), before);
  });

  it("game state is JSON serializable", () => {
    let game = createGame();
    game = joinGame(game, "alice@example.com");
    game = joinGame(game, "bob@example.com");
    game = doPlayerAction(game, "alice@example.com", "down 1").game;

    const restored: GameState = JSON.parse(JSON.stringify(game));
    assert.deepEqual(restored, game);
  });

  it("shared hub world has beach background tiles and no enemies", () => {
    const game = createGame();
    assert.equal(levelHasEnemies(game.hubLevel), false);
    assert.equal(game.hubLevel.entities.length, 0);
    assert.ok(game.hubLevel.backgroundTiles);
    assert.equal(game.hubLevel.backgroundTiles.length, 11);
    assert.equal(game.hubLevel.backgroundTiles[0].length, 15);
  });

  it("players can move freely and overlap on the same tile in the hub", () => {
    let game = createGame();
    game = joinGame(game, "alice@example.com");
    game = joinGame(game, "bob@example.com");
    setPlayerPos(game, "alice@example.com", 2, 2);
    setPlayerPos(game, "bob@example.com", 2, 5);

    // Move freely: distance 3 is allowed in hub
    const res = doPlayerAction(game, "alice@example.com", "down 3");
    assert.equal(res.template, "turn");
    assert.deepEqual(res.messages, []);
    game = res.game;

    assert.deepEqual(game.players["alice@example.com"].p, { x: 2, y: 5 });
    assert.equal(levelEntitiesAt(game.hubLevel, { x: 2, y: 5 }).length, 2);
  });

  it("moving off the edge of the level is rejected", () => {
    let game = joinGame(createGame(), "alice@example.com");
    setPlayerPos(game, "alice@example.com", 0, 0);

    const res = doPlayerAction(game, "alice@example.com", "left");
    assert.equal(res.messages.length, 1);
    assert.deepEqual(res.game.players["alice@example.com"].p, { x: 0, y: 0 });
  });

  it("bad commands produce a message instead of a move", () => {
    const game = joinGame(createGame(), "alice@example.com");
    const res = doPlayerAction(game, "alice@example.com", "dance wildly");
    assert.equal(res.template, "turn");
    assert.match(res.messages[0], /Something's wrong with that command/);
  });

  it("movement is limited to 2 squares when enemies are present in the level", () => {
    let game = joinGame(createGame(), "alice@example.com");
    const alice = game.players["alice@example.com"];
    alice.currentLevel = createPregeneratedDungeon(0);
    alice.currentLevel.entities.push({ type: "player", p: { x: 3, y: 5 }, playerId: alice.email });
    alice.p = { x: 3, y: 5 };

    const illegal = doPlayerAction(game, "alice@example.com", "up 3");
    assert.deepEqual(illegal.game.players["alice@example.com"].p, { x: 3, y: 5 });
    assert.equal(illegal.messages.length, 1);

    const valid = doPlayerAction(game, "alice@example.com", "up 1");
    assert.deepEqual(valid.game.players["alice@example.com"].p, { x: 3, y: 4 });
  });

  it("parses commands from spec/commands.md", () => {
    assert.equal(parseAction("wait").type, "wait");
    const a = parseAction("south 2");
    assert.equal(a.type, "move");
    assert.equal(a.dist, 2);
    assert.equal(parseAction("left").dist, 1);
    assert.throws(() => parseAction("k up 2"));
    assert.throws(() => parseAction(""));

    // Coordinate commands
    const c1 = parseAction("a1");
    assert.equal(c1.type, "coord");
    assert.deepEqual(c1.coord, { col: "a", row: 1 });

    const c2 = parseAction("l19");
    assert.equal(c2.type, "coord");
    assert.deepEqual(c2.coord, { col: "l", row: 19 });

    const c3 = parseAction("m10");
    assert.equal(c3.type, "coord");
    assert.deepEqual(c3.coord, { col: "m", row: 10 });

    const c4 = parseAction("M10");
    assert.equal(c4.type, "coord");
    assert.deepEqual(c4.coord, { col: "a".replace("a", "m"), row: 10 });

    const c5 = parseAction("m 10");
    assert.equal(c5.type, "coord");
    assert.deepEqual(c5.coord, { col: "m", row: 10 });
  });

  it("allows moving to specific coordinates in the hub world", () => {
    let game = joinGame(createGame(), "alice@example.com");
    setPlayerPos(game, "alice@example.com", 2, 2);

    // Hub is 15x11. Bottom-left is a1 (x=0, y=10).
    const resA1 = doPlayerAction(game, "alice@example.com", "a1");
    assert.equal(resA1.template, "turn");
    assert.deepEqual(resA1.messages, []);
    assert.deepEqual(resA1.game.players["alice@example.com"].p, { x: 0, y: 10 });

    // Move to m10: col m=12, row 10 -> y = 11 - 10 = 1
    const resM10 = doPlayerAction(resA1.game, "alice@example.com", "m10");
    assert.deepEqual(resM10.messages, []);
    assert.deepEqual(resM10.game.players["alice@example.com"].p, { x: 12, y: 1 });

    // Out of bounds coordinate command is rejected
    const resOob = doPlayerAction(resM10.game, "alice@example.com", "z99");
    assert.equal(resOob.messages.length, 1);
    assert.equal(resOob.messages[0], "You can't go that way, that's the edge of the world!");
    assert.deepEqual(resOob.game.players["alice@example.com"].p, { x: 12, y: 1 });
  });

  it("restricts coordinate commands when enemies are present in the level", () => {
    let game = joinGame(createGame(), "alice@example.com");
    const alice = game.players["alice@example.com"];
    alice.currentLevel = createPregeneratedDungeon(0);
    // Dungeon 0 is 7x7 (height = 7).
    // Player at (3, 5). In 7-high board: col 3 is 'd', row is 7 - 5 = 2 (d2).
    alice.currentLevel.entities.push({ type: "player", p: { x: 3, y: 5 }, playerId: alice.email });
    alice.p = { x: 3, y: 5 };

    // Moving more than 2 spaces away (e.g. d5, which is y=2, 3 spaces north) should not work
    const illegalDist = doPlayerAction(game, "alice@example.com", "d5");
    assert.deepEqual(illegalDist.game.players["alice@example.com"].p, { x: 3, y: 5 });
    assert.equal(illegalDist.messages[0], "Whoa there! With enemies around you can only move 2 spaces at a time.");

    // Moving diagonally (e.g. e3, which is dx=1, dy=-1) should not work
    const illegalDiag = doPlayerAction(game, "alice@example.com", "e3");
    assert.deepEqual(illegalDiag.game.players["alice@example.com"].p, { x: 3, y: 5 });
    assert.equal(illegalDiag.messages[0], "Whoa there! With enemies around you can only move 2 spaces at a time.");

    // Moving to the same tile (distance 0) should not work
    const illegalSame = doPlayerAction(game, "alice@example.com", "d2");
    assert.deepEqual(illegalSame.game.players["alice@example.com"].p, { x: 3, y: 5 });
    assert.equal(illegalSame.messages[0], "Whoa there! With enemies around you can only move 2 spaces at a time.");

    // Moving 1 space in cardinal direction (d3 is y=4, 1 space north) works!
    const valid1 = doPlayerAction(game, "alice@example.com", "d3");
    assert.deepEqual(valid1.game.players["alice@example.com"].p, { x: 3, y: 4 });

    // Moving 2 spaces in cardinal direction (b3 is x=1, y=4, 2 spaces west) works!
    const valid2 = doPlayerAction(valid1.game, "alice@example.com", "b3");
    assert.deepEqual(valid2.game.players["alice@example.com"].p, { x: 1, y: 4 });
  });

  it("squashes enemies when moving to their coordinate", () => {
    let game = joinGame(createGame(), "alice@example.com");
    const alice = game.players["alice@example.com"];
    alice.currentLevel = createPregeneratedDungeon(0);
    // Dungeon 0 is 7x7. Place player at (3, 5) (d2).
    alice.p = { x: 3, y: 5 };
    alice.currentLevel.entities.push({ type: "player", p: { x: 3, y: 5 }, playerId: alice.email });
    // Place enemy at (3, 4) (d3, 1 square north).
    alice.currentLevel.entities.push({ type: "basic", p: { x: 3, y: 4 } });

    const res = doPlayerAction(game, "alice@example.com", "d3");
    assert.deepEqual(res.game.players["alice@example.com"].p, { x: 3, y: 4 });
    assert.ok(res.messages.includes("You squash an enemy!"));
  });
});

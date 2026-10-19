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
  });
});

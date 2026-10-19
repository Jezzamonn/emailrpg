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
  stepLevelEnemies,
} from "../index.ts";

function joinGame(game: GameState, email: string): GameState {
  game = doPlayerAction(game, email, "").game;
  return doPlayerAction(game, email, "short brown hair, medium skin, blue clothes").game;
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

  it("returns customization_error when character styling traits are missing, and allows bald without hair color", () => {
    let game = createGame();
    game = doPlayerAction(game, "alice@example.com", "hi").game;

    const badRes = doPlayerAction(game, "alice@example.com", "Ponytail, blonde");
    assert.equal(badRes.template, "customization_error");
    assert.match(badRes.additionalData.error, /skin color/);
    assert.match(badRes.additionalData.error, /clothes color/);
    assert.equal(badRes.game.players["alice@example.com"].state, "awaiting_customization");
    assert.equal(badRes.game.hubLevel.entities.length, 0);

    const baldRes = doPlayerAction(badRes.game, "alice@example.com", "bald, light skin, red clothes");
    assert.equal(baldRes.template, "intro");
    assert.equal(baldRes.game.players["alice@example.com"].state, "active");
    assert.equal(baldRes.game.players["alice@example.com"].appearance?.hairType, "bald");
    assert.equal(baldRes.game.players["alice@example.com"].appearance?.skinColor, "light");
    assert.equal(baldRes.game.players["alice@example.com"].appearance?.clothesColor, "red");
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

  it("moving off the edge of the level is rejected with error template", () => {
    let game = joinGame(createGame(), "alice@example.com");
    setPlayerPos(game, "alice@example.com", 0, 0);

    const res = doPlayerAction(game, "alice@example.com", "left");
    assert.equal(res.template, "error");
    assert.match(res.additionalData.error, /edge of the world/);
    assert.deepEqual(res.game.players["alice@example.com"].p, { x: 0, y: 0 });
  });

  it("bad commands produce an error response instead of a move", () => {
    const game = joinGame(createGame(), "alice@example.com");
    const res = doPlayerAction(game, "alice@example.com", "dance wildly");
    assert.equal(res.template, "error");
    assert.match(res.additionalData.error, /Something's wrong with that command/);
  });

  it("movement is limited to 2 squares when enemies are present in the level", () => {
    let game = joinGame(createGame(), "alice@example.com");
    const alice = game.players["alice@example.com"];
    alice.currentLevel = createPregeneratedDungeon(0);
    alice.currentLevel.entities.push({ type: "player", p: { x: 3, y: 5 }, playerId: alice.email });
    alice.p = { x: 3, y: 5 };

    const illegal = doPlayerAction(game, "alice@example.com", "up 3");
    assert.equal(illegal.template, "error");
    assert.match(illegal.additionalData.error, /only move 2 spaces/);
    assert.deepEqual(illegal.game.players["alice@example.com"].p, { x: 3, y: 5 });

    const valid = doPlayerAction(game, "alice@example.com", "up 1");
    assert.equal(valid.template, "turn");
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

  it("enemies cannot move into portals, but players can", () => {
    // Test that enemies avoid moving into portals
    const testLevel = {
      width: 5,
      height: 5,
      entities: [
        { type: "player" as const, p: { x: 2, y: 4 }, playerId: "p1" },
        { type: "ortho" as const, p: { x: 2, y: 1 } },
        { type: "portal" as const, p: { x: 2, y: 2 }, targetLevel: "Rat Cellar" },
      ],
    };

    // If there were no portal at (2, 2), ortho enemy would step south to (2, 2)
    const stepped = stepLevelEnemies(testLevel);
    const enemy = stepped.entities.find((e) => e.type === "ortho")!;
    assert.notDeepEqual(enemy.p, { x: 2, y: 2 });

    // Test that players can move into portals
    let game = joinGame(createGame(), "alice@example.com");
    game.hubLevel.entities.push({
      type: "portal",
      p: { x: 1, y: 1 },
      targetLevel: "Rat Cellar",
    });
    setPlayerPos(game, "alice@example.com", 1, 0);

    const res = doPlayerAction(game, "alice@example.com", "down 1");
    // Player moved into portal and into dungeon
    assert.ok(res.game.players["alice@example.com"].currentLevel);
  });

  it("moving into a portal moves player into their own dungeon and removes them from hub world", () => {
    let game = createGame();
    game = joinGame(game, "alice@example.com");
    game = joinGame(game, "bob@example.com");

    // Add portal to Bat Belfry (id 2) at (4, 4) in hub world
    game.hubLevel.entities.push({
      type: "portal",
      p: { x: 4, y: 4 },
      targetLevel: "Bat Belfry",
    });

    setPlayerPos(game, "alice@example.com", 4, 3);
    setPlayerPos(game, "bob@example.com", 1, 1);

    // Both players currently in hub
    assert.equal(game.hubLevel.entities.some((e) => e.playerId === "alice@example.com"), true);
    assert.equal(game.hubLevel.entities.some((e) => e.playerId === "bob@example.com"), true);

    // Alice steps south onto portal
    const res = doPlayerAction(game, "alice@example.com", "down 1");
    const newGame = res.game;
    const alice = newGame.players["alice@example.com"];

    // Alice is now in her own level/dungeon
    assert.ok(alice.currentLevel);
    assert.equal(alice.currentLevel.width, 7);
    assert.equal(alice.currentLevel.height, 7);
    // Bat Belfry starting pos is (3, 5)
    assert.deepEqual(alice.p, { x: 3, y: 5 });
    assert.equal(
      alice.currentLevel.entities.some(
        (e) => e.type === "player" && e.playerId === "alice@example.com" && e.p.x === 3 && e.p.y === 5,
      ),
      true,
    );

    // Alice should NO LONGER show up in the hub world
    assert.equal(
      newGame.hubLevel.entities.some((e) => e.playerId === "alice@example.com"),
      false,
    );
    // Bob should still be in the hub world
    assert.equal(
      newGame.hubLevel.entities.some((e) => e.playerId === "bob@example.com"),
      true,
    );
  });

  it("when a player dies, they spawn back in the hub world", () => {
    let game = joinGame(createGame(), "alice@example.com");
    const alice = game.players["alice@example.com"];

    // Place Alice in a dungeon
    alice.currentLevel = {
      width: 5,
      height: 5,
      entities: [
        { type: "player", p: { x: 2, y: 2 }, playerId: alice.email },
        { type: "ortho", p: { x: 2, y: 1 } },
      ],
    };
    alice.p = { x: 2, y: 2 };
    // Ensure Alice is not in hub while in dungeon
    game.hubLevel.entities = game.hubLevel.entities.filter((e) => e.playerId !== alice.email);

    // Alice waits; ortho enemy moves south to (2, 2) and kills her
    const res = doPlayerAction(game, "alice@example.com", "wait");
    const updatedAlice = res.game.players["alice@example.com"];

    // Alice should be spawned back in the hub world
    assert.equal(updatedAlice.currentLevel, undefined);
    assert.equal(
      res.game.hubLevel.entities.some((e) => e.playerId === alice.email),
      true,
    );
    // The player entity in hub is at updatedAlice.p
    const hubPlayerEntity = res.game.hubLevel.entities.find((e) => e.playerId === alice.email)!;
    assert.deepEqual(hubPlayerEntity.p, updatedAlice.p);
    assert.ok(res.messages.some((m) => m.includes("wake up back on the beach")));
  });
});

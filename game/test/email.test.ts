import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeAction, parseAction } from "../action.ts";
import { createGame } from "../game.ts";
import { extractReplyText, handleIncomingEmail } from "../email/email.ts";
import {
  renderWelcomeEmail,
  renderCustomizationEmail,
  renderIntroEmail,
  renderTurnEmail,
  renderLevelEnterEmail,
  renderLevelCompleteEmail,
  renderErrorEmail,
  renderCustomizationErrorEmail,
  htmlToPlainText,
} from "../email/template.ts";

describe("Handlebars Email Templating", () => {
  it("renders welcome email asking for name and customization email with example images", () => {
    const welcomeHtml = renderWelcomeEmail();
    assert.match(welcomeHtml, /WELCOME to/);
    assert.match(welcomeHtml, /What's your name/);

    const custHtml = renderCustomizationEmail({ name: "Alice" });
    assert.match(custHtml, /What do you look like/);
    assert.match(custHtml, /cid:short_brown_hair_light_skin_green_clothes/);
    assert.match(custHtml, /cid:blonde_ponytail_medium_skin_blue_clothes/);
    assert.match(custHtml, /cid:bald_dark_skin_red_clothes/);
    assert.match(custHtml, /cid:black_hair_medium_skin_green_clothes/);
    assert.match(custHtml, /short, ponytail or bald/);
    assert.match(custHtml, /blonde, brown or black/);
    assert.match(custHtml, /light medium dark/);
    assert.match(custHtml, /red green or blue/);
  });

  it("renders intro email template with player info and game board image", () => {
    const html = renderIntroEmail({ images: {} });

    assert.match(html, /OK,, here's the story so far/);
    assert.match(html, /peaceful beach/);
  });

  it("renders turn update email template with game board image", () => {
    const html = renderTurnEmail({
      images: {},
      messages: ["You squash an enemy!"],
    });

    assert.match(html, /You go ahead and do that thing/);
    assert.match(html, /You squash an enemy!/);

    const withAction = renderTurnEmail({
      images: {},
      messages: [],
      action: "You move left 2 squares.",
    });
    assert.match(withAction, /You move left 2 squares\. Here's what happens next/);
    assert.equal(withAction.includes("You go ahead and do that thing"), false);
    assert.match(html, /<img src="cid:game_view"/);
    assert.match(html, /Pretty cool right/);
  });

  it("renders a different enter and complete email template for each level", () => {
    const levels = ["rat-and-bat", "snail", "horsies", "everyone"];
    const enters = levels.map((level) => renderLevelEnterEmail(level, { images: {}, messages: [] }));
    const completes = levels.map((level) =>
      renderLevelCompleteEmail(level, {
        images: { hub_view: new Uint8Array() },
        messages: ["You beat it!"],
      }),
    );
    assert.equal(new Set(enters).size, levels.length);
    assert.equal(new Set(completes).size, levels.length);
    for (const html of [...enters, ...completes]) {
      assert.match(html, /<img src="cid:game_view"/);
    }
    for (const html of completes) {
      assert.match(html, /You beat it!/);
      assert.match(html, /<img src="cid:hub_view"/);
    }

    // Unknown levels fall back to the turn template
    assert.match(
      renderLevelEnterEmail("unknown", { images: {}, messages: [] }),
      /You go ahead and do that thing/,
    );
  });

  it("renders error and customization error email templates", () => {
    const errorHtml = renderErrorEmail({
      images: {},
      error: "You can't go that way!",
    });
    assert.match(errorHtml, /color:\s*#e03e2d/);
    assert.match(errorHtml, /You can&#x27;t go that way!/);
    assert.match(errorHtml, /<img src="cid:game_view"/);

    const custErrorHtml = renderCustomizationErrorEmail({
      error: "Could not understand what you look like!",
    });
    assert.match(custErrorHtml, /Sorry, gotta ask you to spell things out for me/);
    assert.match(custErrorHtml, /Could not understand what you look like!/);
    assert.equal(custErrorHtml.includes("cid:game_view"), false);
  });

  it("htmlToPlainText strips HTML tags, formats lists and images, and decodes entities", () => {
    const sampleHtml = `
      <h2>Title &amp; Subtitle</h2>
      <p>A paragraph with <strong>bold</strong> and <a href="#">links</a>.</p>
      <img src="cid:game" alt="Game Board (2-Frame GIF)" />
      <ul>
        <li><code>u</code>, <code>d</code></li>
        <li><code>wait</code></li>
      </ul>
    `;
    const text = htmlToPlainText(sampleHtml);

    assert.match(text, /Title & Subtitle/);
    assert.match(text, /A paragraph with bold and links\./);
    assert.match(text, /\[Game Board \(2-Frame GIF\)\]/);
    assert.match(text, /- u, d\s*\n\s*- wait/);
    // Ensure no raw HTML tags remain
    assert.equal(/<[^>]+>/.test(text), false);
  });

  it("extractReplyText strips quoted email content and reply headers", () => {
    assert.equal(
      extractReplyText(
        "up 2\n\nOn Sun, Oct 18, 2026 at 7:00 PM <game@emailrpg.com> wrote:\n> You go ahead and do that thing.\n> [Game Board]",
      ),
      "up 2",
    );

    assert.equal(
      extractReplyText(
        "ponytail, brown hair, light skin, blue clothes\n\nOn Sun, Oct 18, 2026 at 7:00 PM Game <game@emailrpg.com>\nwrote:\n> WELCOME to Email RPG",
      ),
      "ponytail, brown hair, light skin, blue clothes",
    );

    assert.equal(
      extractReplyText(
        "wait\n\n-----Original Message-----\nFrom: game@emailrpg.com\nSent: Sunday\n\nOld text",
      ),
      "wait",
    );

    assert.equal(
      extractReplyText("left 3\n> quoted line without header"),
      "left 3",
    );
  });

  it("handleIncomingEmail integrates with Handlebars templates across phases and generates plaintext", () => {
    let game = createGame();
    const userEmail = "test@example.com";

    // Phase 1: Welcome (asks for name)
    const res1 = handleIncomingEmail(game, {
      from: userEmail,
      body: "Hello",
    });
    game = res1.game;
    assert.equal(game.players[userEmail].state, "awaiting_name");
    assert.match(res1.response.html, /WELCOME to/);
    assert.match(res1.response.text, /WELCOME to/);
    assert.match(res1.response.text, /What's your name\?\?/);
    assert.deepEqual(res1.response.images, {});
    assert.equal(/<[^>]+>/.test(res1.response.text), false);

    // Phase 1b: Send name -> receives customization options
    const resName = handleIncomingEmail(game, {
      from: userEmail,
      body: "Alice",
    });
    game = resName.game;
    assert.equal(game.players[userEmail].state, "awaiting_customization");
    assert.equal(game.players[userEmail].name, "Alice");
    assert.match(resName.response.text, /Short brown hair, light skin, green clothes\?/);
    assert.match(resName.response.text, /Blonde ponytail, medium skin, blue clothes\?/);
    assert.ok(resName.response.images["short_brown_hair_light_skin_green_clothes"]);
    assert.ok(resName.response.images["blonde_ponytail_medium_skin_blue_clothes"]);
    assert.ok(resName.response.images["bald_dark_skin_red_clothes"]);
    assert.ok(resName.response.images["black_hair_medium_skin_green_clothes"]);
    assert.equal(/<[^>]+>/.test(resName.response.text), false);

    // Phase 2a: Incomplete customization -> customization_error without level image
    const res2Err = handleIncomingEmail(game, {
      from: userEmail,
      body: "Ponytail with brown hair\n\nOn Sun, Oct 18, 2026 wrote:\n> light skin red clothes",
    });
    game = res2Err.game;
    assert.equal(game.players[userEmail].state, "awaiting_customization");
    assert.match(res2Err.response.html, /Sorry, gotta ask you to spell things out for me/);
    assert.deepEqual(res2Err.response.images, {});

    // Phase 2b: Complete character creation
    const res2 = handleIncomingEmail(game, {
      from: userEmail,
      body: "Ponytail with brown hair, light skin, blue clothes",
    });
    game = res2.game;
    assert.equal(game.players[userEmail].state, "active");
    assert.match(res2.response.html, /peaceful beach/);
    assert.match(res2.response.text, /peaceful beach/);
    assert.ok(res2.response.images["game_view"]);
    assert.equal(/<[^>]+>/.test(res2.response.text), false);

    // Phase 3a: Invalid command -> error template with level image
    const res3Err = handleIncomingEmail(game, {
      from: userEmail,
      body: "dance\n\n> up 2",
    });
    game = res3Err.game;
    assert.match(res3Err.response.html, /Something&#x27;s wrong with that command/);
    assert.equal(res3Err.response.html.includes("You go ahead and do that thing"), false);
    assert.ok(res3Err.response.images["game_view"]);

    // Phase 3b: Valid turn move with quoted reply text
    const res3 = handleIncomingEmail(game, {
      from: userEmail,
      body: "up 2\n\nOn Sun, Oct 18, 2026 at 7:00 PM <game@emailrpg.com> wrote:\n> Pretty cool right???",
    });
    assert.match(res3.response.html, /You move up 2 squares\. Here's what happens next/);
    assert.match(res3.response.text, /You move up 2 squares\. Here's what happens next/);
    assert.match(res3.response.text, /\[Game Board\]/);
    assert.ok(res3.response.images["game_view"]);
    assert.equal(res3.response.images["hub_view"], undefined);
    assert.equal(/<[^>]+>/.test(res3.response.text), false);

    // Phase 4: Winning a level renders both the beaten level and the hub island underneath it
    game = res3.game;
    const player = game.players[userEmail];
    player.currentLevel = {
      name: "Rat Cellar",
      width: 5,
      height: 5,
      entities: [
        { type: "player", p: { x: 2, y: 2 }, playerId: userEmail, appearance: player.appearance },
        { type: "ortho", p: { x: 2, y: 1 } },
      ],
    };
    player.currentLevelName = "Rat Cellar";
    player.p = { x: 2, y: 2 };
    game.hubLevel.entities = game.hubLevel.entities.filter((e) => e.playerId !== userEmail);

    const resWin = handleIncomingEmail(game, {
      from: userEmail,
      body: "up 1",
    });
    assert.ok(resWin.response.images["game_view"]);
    assert.ok(resWin.response.images["hub_view"]);
    assert.notDeepEqual(resWin.response.images["game_view"], resWin.response.images["hub_view"]);
    const gameViewIdx = resWin.response.html.indexOf('cid:game_view');
    const hubViewIdx = resWin.response.html.indexOf('cid:hub_view');
    assert.ok(gameViewIdx !== -1 && hubViewIdx !== -1 && gameViewIdx < hubViewIdx);
    assert.equal(resWin.game.players[userEmail].currentLevel, undefined);
    assert.equal(resWin.game.players[userEmail].state, "active");
  });

  it("includes recent chat messages in overworld emails, respecting 6h cutoff, 10 message limit, and lastChatTimestamp", () => {
    let game = createGame();
    const alice = "alice@example.com";
    const bob = "bob@example.com";
    const t0 = 1_000_000_000;
    const oneHour = 60 * 60 * 1000;

    // Alice joins at t0
    game = handleIncomingEmail(game, { from: alice, body: "hi" }, t0).game;
    game = handleIncomingEmail(game, { from: alice, body: "Alice" }, t0 + 1000).game;
    game = handleIncomingEmail(
      game,
      { from: alice, body: "short brown hair, light skin, green clothes" },
      t0 + 2000,
    ).game;

    // Alice sends a message at t0 + 3000 (too old for 6h window later) and another at t0 + 4 * oneHour
    const sayOld = handleIncomingEmail(
      game,
      { from: alice, body: "say ancient message" },
      t0 + 3000,
    );
    game = sayOld.game;
    assert.match(sayOld.response.text, /Alice: ancient message/);

    // On Alice's next turn, she shouldn't receive "ancient message" again
    const aliceNext = handleIncomingEmail(
      game,
      { from: alice, body: "wait" },
      t0 + 4000,
    );
    game = aliceNext.game;
    assert.doesNotMatch(aliceNext.response.text, /ancient message/);

    // Alice sends 12 messages around t0 + 5 * oneHour
    for (let i = 1; i <= 12; i++) {
      game = handleIncomingEmail(
        game,
        { from: alice, body: `say message number ${i}` },
        t0 + 5 * oneHour + i * 1000,
      ).game;
    }

    // Bob joins at t0 + 7 * oneHour (more than 6 hours after "ancient message", but within 6 hours of the 12 messages)
    game = handleIncomingEmail(game, { from: bob, body: "hi" }, t0 + 7 * oneHour).game;
    game = handleIncomingEmail(game, { from: bob, body: "Bob" }, t0 + 7 * oneHour + 1000).game;
    const bobIntro = handleIncomingEmail(
      game,
      { from: bob, body: "bald, dark skin, red clothes" },
      t0 + 7 * oneHour + 2000,
    );
    game = bobIntro.game;

    // Bob should NOT see "ancient message" (>6h old) or messages 1 and 2 (cap of 10 most recent),
    // but SHOULD see messages 3 through 12!
    assert.doesNotMatch(bobIntro.response.text, /ancient message/);
    assert.doesNotMatch(bobIntro.response.text, /message number 1\b/);
    assert.doesNotMatch(bobIntro.response.text, /message number 2\b/);
    for (let i = 3; i <= 12; i++) {
      assert.match(bobIntro.response.text, new RegExp(`Alice: message number ${i}`));
    }

    // When Bob takes his next turn without new messages, none of the previous messages are resent
    const bobTurn = handleIncomingEmail(
      game,
      { from: bob, body: "wait" },
      t0 + 7 * oneHour + 3000,
    );
    assert.doesNotMatch(bobTurn.response.text, /message number/);
  });
});

describe("describeAction", () => {
  it("says what the player just did", () => {
    assert.equal(describeAction(parseAction("left 2")), "You move left 2 squares.");
    assert.equal(describeAction(parseAction("u")), "You move up 1 square.");
    assert.equal(describeAction(parseAction("c4")), "You move to C4.");
    assert.equal(describeAction(parseAction("wait")), "You wait.");
    assert.equal(describeAction(parseAction("restart")), "You restart the level.");
    assert.equal(describeAction(parseAction("exit")), "You head back to the island.");
  });
});

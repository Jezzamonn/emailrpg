import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../game.ts";
import { extractReplyText, handleIncomingEmail } from "../email/email.ts";
import {
  renderWelcomeEmail,
  renderIntroEmail,
  renderTurnEmail,
  renderErrorEmail,
  renderCustomizationErrorEmail,
  htmlToPlainText,
} from "../email/template.ts";

describe("Handlebars Email Templating", () => {
  it("renders welcome email template with options and example images", () => {
    const html = renderWelcomeEmail();
    assert.match(html, /WELCOME to/);
    assert.match(html, /What do you look like/);
    assert.match(html, /cid:short_brown_hair_light_skin_green_clothes/);
    assert.match(html, /cid:blonde_ponytail_medium_skin_blue_clothes/);
    assert.match(html, /cid:bald_dark_skin_red_clothes/);
    assert.match(html, /cid:black_hair_medium_skin_green_clothes/);
    assert.match(html, /short, ponytail or bald/);
    assert.match(html, /blonde, brown or black/);
    assert.match(html, /light medium dark/);
    assert.match(html, /red green or blue/);
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
    assert.match(html, /<img src="cid:game_view"/);
    assert.match(html, /Pretty cool right/);
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

    // Phase 1: Welcome
    const res1 = handleIncomingEmail(game, {
      from: userEmail,
      body: "Hello",
    });
    game = res1.game;
    assert.equal(game.players[userEmail].state, "awaiting_customization");
    assert.match(res1.response.html, /WELCOME to/);
    assert.match(res1.response.text, /WELCOME to/);
    assert.match(res1.response.text, /Short brown hair, light skin, green clothes\?/);
    assert.match(res1.response.text, /Blonde ponytail, medium skin, blue clothes\?/);
    assert.ok(res1.response.images["short_brown_hair_light_skin_green_clothes"]);
    assert.ok(res1.response.images["blonde_ponytail_medium_skin_blue_clothes"]);
    assert.ok(res1.response.images["bald_dark_skin_red_clothes"]);
    assert.ok(res1.response.images["black_hair_medium_skin_green_clothes"]);
    assert.equal(/<[^>]+>/.test(res1.response.text), false);

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
    assert.match(res3.response.html, /You go ahead and do that thing/);
    assert.match(res3.response.text, /You go ahead and do that thing/);
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
});

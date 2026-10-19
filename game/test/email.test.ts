import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../game.ts";
import { handleIncomingEmail } from "../email/email.ts";
import {
  renderWelcomeEmail,
  renderIntroEmail,
  renderTurnEmail,
  htmlToPlainText,
} from "../email/template.ts";

describe("Handlebars Email Templating", () => {
  it("renders welcome email template", () => {
    const html = renderWelcomeEmail();
    assert.match(html, /WELCOME to/);
    assert.match(html, /What do you look like/);
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
    assert.deepEqual(res1.response.images, {});
    assert.equal(/<[^>]+>/.test(res1.response.text), false);

    // Phase 2: Intro / Character creation
    const res2 = handleIncomingEmail(game, {
      from: userEmail,
      body: "Ponytail with brown hair",
    });
    game = res2.game;
    assert.equal(game.players[userEmail].state, "active");
    assert.match(res2.response.html, /peaceful beach/);
    assert.match(res2.response.text, /peaceful beach/);
    assert.ok(res2.response.images["game_view"]);
    assert.equal(/<[^>]+>/.test(res2.response.text), false);

    // Phase 3: Turn move
    const res3 = handleIncomingEmail(game, {
      from: userEmail,
      body: "u 2",
    });
    assert.match(res3.response.html, /You go ahead and do that thing/);
    assert.match(res3.response.text, /You go ahead and do that thing/);
    assert.match(res3.response.text, /\[Game Board\]/);
    assert.ok(res3.response.images["game_view"]);
    assert.equal(/<[^>]+>/.test(res3.response.text), false);
  });
});

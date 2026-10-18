import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../game.ts";
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
    const html = renderIntroEmail({
      player: {
        char: "@",
        displayX: 5,
        displayY: 6,
      },
      imageSrc: "cid:game_view",
    });

    assert.match(html, /OK,, here's the story so far/);
    assert.match(html, /peaceful beach/);
  });

  it("renders turn update email template with game board image", () => {
    const html = renderTurnEmail({
      locationInfo: "Shared Hub World",
      command: "u 2",
      commandExecuted: true,
      rulesNote: "No enemies present: you may move freely.",
      imageSrc: "cid:game_view",
      inDungeon: false,
      enemiesPresent: false,
    });

    assert.match(html, /You go ahead and do that thing/);
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
    const game = new Game();
    const userEmail = "test@example.com";

    // Phase 1: Welcome
    const res1 = handleIncomingEmail(game, {
      from: userEmail,
      body: "Hello",
    });
    assert.equal(res1.phase, "welcome");
    assert.match(res1.html, /WELCOME to/);
    assert.match(res1.text, /WELCOME to/);
    assert.equal(/<[^>]+>/.test(res1.text), false);

    // Phase 2: Intro / Character creation
    const res2 = handleIncomingEmail(game, {
      from: userEmail,
      body: "King",
    });
    assert.equal(res2.phase, "intro");
    assert.match(res2.html, /peaceful beach/);
    assert.match(res2.text, /peaceful beach/);
    assert.equal(/<[^>]+>/.test(res2.text), false);

    // Phase 3: Turn move
    const res3 = handleIncomingEmail(game, {
      from: userEmail,
      body: "u 2",
    });
    assert.equal(res3.phase, "turn");
    assert.match(res3.html, /You go ahead and do that thing/);
    assert.match(res3.text, /You go ahead and do that thing/);
    assert.match(res3.text, /\[Game Board\]/);
    assert.equal(/<[^>]+>/.test(res3.text), false);
  });
});

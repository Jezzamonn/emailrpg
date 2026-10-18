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
    assert.match(html, /Welcome to the game!/);
    assert.match(html, /Choose what your player looks like/);
    assert.match(html, /Reply to this email with what you'd like your character to look like/);
  });

  it("renders intro email template with player info and game board image", () => {
    const html = renderIntroEmail({
      player: {
        char: "@",
        letter: "A",
        displayX: 5,
        displayY: 6,
      },
      imageSrc: "cid:game_view",
    });

    assert.match(html, /Welcome to the world!/);
    assert.match(html, /Character Created!/);
    assert.match(html, /You have joined the hub world as <strong>@ \[A\]<\/strong> at position \(5, 6\)\./);
    assert.match(html, /<img src="cid:game_view"/);
    assert.match(html, /How to play:/);
  });

  it("renders turn update email template with command executed status and escapes HTML", () => {
    const html = renderTurnEmail({
      locationInfo: "Shared Hub World",
      command: "u 2",
      commandExecuted: true,
      rulesNote: "No enemies present: you may move freely.",
      imageSrc: "cid:game_view",
      inDungeon: false,
      enemiesPresent: false,
    });

    assert.match(html, /LD60 Turn Update — Shared Hub World/);
    assert.match(html, /Command executed: <code>u 2<\/code>/);
    assert.match(html, /No enemies present: you may move freely\./);
    assert.match(html, /Move freely \(e\.g\. <code>u<\/code>, <code>left 3<\/code>\), or enter the dungeon with <code>dungeon<\/code>\./);
  });

  it("renders turn update email with failure and escapes malicious input", () => {
    const html = renderTurnEmail({
      locationInfo: "Dungeon (Level 1)",
      command: "<script>alert('hack')</script>",
      commandExecuted: false,
      rulesNote: "Enemies are present: movement is limited to 2 squares per direction.",
      imageSrc: "cid:game_view",
      inDungeon: true,
      enemiesPresent: true,
    });

    assert.match(html, /Could not execute: <code>&lt;script&gt;alert\(&#x27;hack&#x27;\)&lt;\/script&gt;<\/code>/);
    assert.match(html, /Reply with movement \(e\.g\. <code>u 2<\/code>, <code>left<\/code>\), <code>wait<\/code>, or <code>hub<\/code> to exit\./);
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
    assert.match(res1.html, /Welcome to the game!/);
    assert.match(res1.text, /Welcome to the game!/);
    assert.match(res1.text, /Choose what your player looks like\./);
    assert.equal(/<[^>]+>/.test(res1.text), false);

    // Phase 2: Intro / Character creation
    const res2 = handleIncomingEmail(game, {
      from: userEmail,
      body: "King",
    });
    assert.equal(res2.phase, "intro");
    assert.equal(res2.playerLetter, "K");
    assert.match(res2.html, /Character Created!/);
    assert.match(res2.html, /\[K\]/);
    assert.match(res2.text, /Character Created!/);
    assert.match(res2.text, /\[Game Board \(2-Frame GIF\)\]/);
    assert.match(res2.text, /- u, d, l, r/);
    assert.equal(/<[^>]+>/.test(res2.text), false);

    // Phase 3: Turn move
    const res3 = handleIncomingEmail(game, {
      from: userEmail,
      body: "u 2",
    });
    assert.equal(res3.phase, "turn");
    assert.match(res3.html, /Command executed: <code>u 2<\/code>/);
    assert.match(res3.text, /Command executed: u 2/);
    assert.match(res3.text, /\[Game Board \(2-Frame GIF\)\]/);
    assert.equal(/<[^>]+>/.test(res3.text), false);
  });
});

import "./style.css";
import { Game } from "@game/game.ts";
import { Surface } from "@game/lib/surface.ts";
import { renderLevelToGif } from "@game/lib/gif.ts";

const game = new Game();
const tileSize = 24; // 24px per tile for crisp display
const boardWidth = game.currentLevel.width * tileSize;
const boardHeight = game.currentLevel.height * tileSize;
const surface = new Surface(boardWidth, boardHeight);

const app = document.querySelector<HTMLDivElement>("#app")!;

let currentFrame = 0;
let lastGifUrl = "";

function updateGif() {
  const gifBytes = renderLevelToGif(game.currentLevel, 16);
  if (lastGifUrl) {
    URL.revokeObjectURL(lastGifUrl);
  }
  const blob = new Blob([gifBytes.buffer as ArrayBuffer], { type: "image/gif" });
  lastGifUrl = URL.createObjectURL(blob);
  const gifImg = document.querySelector<HTMLImageElement>("#email-gif");
  if (gifImg) {
    gifImg.src = lastGifUrl;
  }
}

function drawCanvas(frame: number) {
  const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  surface.clear();
  game.currentLevel.render(surface, tileSize, frame);

  const imageData = new ImageData(
    new Uint8ClampedArray(surface.buffer),
    surface.width,
    surface.height
  );
  ctx.putImageData(imageData, 0, 0);
}

function setupApp() {
  app.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #eee;">
      <h1>LD60 Game & Email Preview Prototype</h1>

      <div style="display: flex; gap: 2rem; flex-wrap: wrap; margin-top: 1.5rem;">
        <!-- Live Browser Canvas -->
        <div style="background: #1e1e1e; padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 320px;">
          <h2>1. Live Browser Canvas</h2>
          <p style="color: #aaa; font-size: 0.9rem;">Drawn via <code>Surface</code> with 2-frame idle toggle</p>
          <div style="margin: 1rem 0;">
            <canvas id="game-canvas" width="${boardWidth}" height="${boardHeight}" style="border: 2px solid #444; border-radius: 4px; display: block;"></canvas>
          </div>
          <form id="command-form" style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <input id="command-input" type="text" placeholder="e.g. k u (King Up)" autofocus style="flex: 1; padding: 0.6rem; font-size: 1rem; border-radius: 4px; border: 1px solid #555; background: #2a2a2a; color: #fff;" />
            <button type="submit" style="padding: 0.6rem 1.2rem; font-size: 1rem; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Send Turn</button>
          </form>
        </div>

        <!-- Simulated Email Client -->
        <div style="background: #1e1e1e; padding: 1.5rem; border-radius: 8px; flex: 1; min-width: 320px;">
          <h2>2. Email Preview (Worker Output)</h2>
          <p style="color: #aaa; font-size: 0.9rem;">Generated 2-Frame GIF attachment & email HTML</p>
          
          <div style="background: #ffffff; color: #222; padding: 1.2rem; border-radius: 6px; margin-top: 1rem; font-family: sans-serif;">
            <div style="border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; margin-bottom: 0.8rem; font-size: 0.85rem; color: #666;">
              <strong>From:</strong> game@ld60.workers.dev<br />
              <strong>Subject:</strong> Re: LD60 Turn Update
            </div>
            <h3 style="margin-top: 0;">LD60 Game Turn</h3>
            <p><img id="email-gif" alt="Game Board GIF" style="image-rendering: pixelated; width: 216px; height: 216px; border: 1px solid #ccc;" /></p>
            <p style="font-size: 0.9rem; color: #555;">Reply with your move (e.g. <code>k u</code> or <code>k right</code>).</p>
          </div>
        </div>
      </div>

      <!-- Emoji/ASCII Log -->
      <div style="background: #1e1e1e; padding: 1rem 1.5rem; border-radius: 8px; margin-top: 2rem;">
        <h3>ASCII / Emoji Terminal View</h3>
        <pre id="text-view" style="font-size: 1.2rem; line-height: 1.5; color: #a3e635; margin: 0;">${game.currentLevel.renderText()}</pre>
      </div>
    </div>
  `;

  const form = document.querySelector<HTMLFormElement>("#command-form")!;
  const input = document.querySelector<HTMLInputElement>("#command-input")!;
  const textView = document.querySelector<HTMLPreElement>("#text-view")!;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const command = input.value.trim();
    if (command) {
      game.processCommand(command);
      input.value = "";
      textView.textContent = game.currentLevel.renderText();
      updateGif();
      drawCanvas(currentFrame);
    }
  });

  updateGif();
  drawCanvas(0);

  // 2-frame animation loop (500ms toggle)
  setInterval(() => {
    currentFrame = 1 - currentFrame;
    drawCanvas(currentFrame);
  }, 500);
}

setupApp();

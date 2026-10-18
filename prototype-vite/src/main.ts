import "./style.css";
import { Game } from "@game/game.ts";

const game = new Game();

const app = document.querySelector<HTMLDivElement>("#app")!;

function render() {
  app.innerHTML = `
    <div style="font-family: monospace; padding: 2rem;">
      <h1>LD60 Game Prototype</h1>
      <pre id="board" style="font-size: 1.5rem; line-height: 1.6; background: #1a1a1a; color: #fff; padding: 1rem; border-radius: 8px; display: inline-block;">${game.currentLevel.renderText()}</pre>
      <form id="command-form" style="margin-top: 1rem;">
        <label for="command-input">Command: </label>
        <input id="command-input" type="text" placeholder="e.g. 🤴 u" autofocus style="padding: 0.5rem; font-size: 1rem;" />
        <button type="submit" style="padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer;">Send</button>
      </form>
    </div>
  `;

  const form = document.querySelector<HTMLFormElement>("#command-form")!;
  const input = document.querySelector<HTMLInputElement>("#command-input")!;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const command = input.value.trim();
    if (command) {
      game.processCommand(command);
      render();
    }
  });
}

render();

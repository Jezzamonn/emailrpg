import "./style.css";
import { Game } from "@game/game.ts";
import { renderLevelToGif } from "@game/lib/gif.ts";

const game = new Game();
const gifImg = document.querySelector<HTMLImageElement>("#email-gif")!;
const replyForm = document.querySelector<HTMLFormElement>("#reply-form")!;
const replyInput = document.querySelector<HTMLInputElement>("#reply-input")!;

let lastGifUrl = "";

function updateGif() {
  const gifBytes = renderLevelToGif(game.currentLevel, 16);
  if (lastGifUrl) {
    URL.revokeObjectURL(lastGifUrl);
  }
  const blob = new Blob([gifBytes.buffer as ArrayBuffer], {
    type: "image/gif",
  });
  lastGifUrl = URL.createObjectURL(blob);
  gifImg.src = lastGifUrl;
}

replyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const command = replyInput.value.trim();
  if (command) {
    game.processCommand(command);
    replyInput.value = "";
    updateGif();
  }
});

updateGif();

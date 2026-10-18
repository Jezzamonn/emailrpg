import readline from "node:readline";
import { wait } from "../game/lib/util.ts";
import { Game } from "../game/game.ts";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const game = new Game();

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (result: string) => {
      resolve(result);
    });
  });
}

async function main() {
  while (true) {
    console.clear();
    console.log(game.currentLevel.renderText());

    const command = await question("Enter command:\n");

    game.processCommand(command);

    // console.log("simulating email send delay...");
    // await wait(1);
  }
}

main().then(() => rl.close());

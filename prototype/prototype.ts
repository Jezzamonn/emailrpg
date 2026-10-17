import readline from "node:readline";
import { Level } from "./level.ts";
import { Entity } from "./entity/entity.ts";
import { makeLevel } from "./level.ts";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const level = makeLevel();

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
    console.log(level.renderText());

    await question("Enter command: ");

    level.next();
  }
}

main().then(() => rl.close());

import readline from 'node:readline';
import { Level } from './level.ts';
import { Entity } from './entity.ts';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function makeLevel(): Level {
    const level = new Level(10, 10);
    for (let i = 0; i < 3; i++) {
        const entity = new Entity(level);
        entity.x = Math.floor(Math.random() * level.width);
        entity.y = Math.floor(Math.random() * level.height);
        level.entities.push(entity);
    }
    return level;
}

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

        const input = await question('Enter command: ');
    }
}

main().then(() => rl.close());

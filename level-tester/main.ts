import { register } from "node:module";

// Register loader for .png / .hbs / .html assets imported by ../game
register("../game/test/hbs-loader.mjs", import.meta.url);

const { PREGENERATED_DUNGEONS } = await import("../game/dungeon.ts");
const { findMatchingDungeons, solveLevel } = await import("./solver.ts");

function printResult(result: Awaited<ReturnType<typeof solveLevel>>): void {
  const deathRate =
    result.pathsExplored > 0
      ? ((result.playerDeathPaths / result.pathsExplored) * 100).toFixed(1)
      : "0.0";

  console.log(`=== Level ${result.levelId}: ${result.levelName} (${result.width}x${result.height}, ${result.initialEnemies} enemies) ===`);
  console.log(`Beatable:                ${result.beatable ? "Yes" : "No"}`);
  if (result.beatable && result.solution) {
    console.log(`Steps to beat:           ${result.steps}`);
    console.log(`Solution:                ${result.solution.join(" -> ")}`);
  }
  console.log(`Paths where player died: ${result.playerDeathPaths} / ${result.pathsExplored} (${deathRate}% of explored paths)`);
  console.log(`States expanded:         ${result.statesExpanded}`);
  console.log(`Unique states visited:   ${result.uniqueStatesVisited}`);
  console.log(`Branches pruned:         ${result.prunedBranches}`);
  console.log(`Search time:             ${result.elapsedMs.toFixed(2)} ms`);
}

function main(): void {
  const arg = process.argv.slice(2).join(" ").trim();

  if (!arg) {
    console.error("Usage: npm start -- <level-name-or-id | all>");
    console.error("\nAvailable levels:");
    for (const d of PREGENERATED_DUNGEONS) {
      console.error(`  ${d.id}: "${d.name}"`);
    }
    process.exit(1);
  }

  const matched = findMatchingDungeons(arg);
  if (matched.length === 0) {
    console.error(`Unknown level: "${arg}"`);
    console.error("\nAvailable levels:");
    for (const d of PREGENERATED_DUNGEONS) {
      console.error(`  ${d.id}: "${d.name}"`);
    }
    process.exit(1);
  }

  for (let i = 0; i < matched.length; i++) {
    if (i > 0) console.log("");
    const res = solveLevel(matched[i]!.name);
    printResult(res);
  }
}

main();

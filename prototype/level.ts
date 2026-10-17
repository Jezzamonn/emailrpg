import { Entity } from "./entity";

export class Level {

    public width: number;
    public height: number;

    public entities: Entity[] = [];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    renderText(): string {
        let output = "";
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const entity = this.entities.find(e => e.x === x && e.y === y);
                output += entity ? entity.getText() : "  ";
            }
            output += "\n";
        }
        return output;
    }
}
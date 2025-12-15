import { Note } from '../entities/Note.js';
import { CONFIG } from '../core/CONFIG.js';

export class NoteManager {
    constructor() {
        this.notes = []; // Active notes
        this.chartData = []; // Full chart
        this.nextNoteIndex = 0;

        // Lane drawing info
        this.laneWidth = 100;
        this.startX = 0;
    }

    loadChart(chart) {
        this.chartData = chart.notes.sort((a, b) => a.time - b.time);
        this.nextNoteIndex = 0;
        this.notes = [];
        console.log(`Loaded chart with ${this.chartData.length} notes`);
    }

    update(currentTime) {
        // Spawn notes
        // Spawn ahead: look ahead by e.g. 2000ms
        const SPAWN_WINDOW = 2000;

        while (this.nextNoteIndex < this.chartData.length) {
            const noteData = this.chartData[this.nextNoteIndex];
            if (noteData.time <= currentTime + SPAWN_WINDOW) {
                this.notes.push(new Note(noteData));
                this.nextNoteIndex++;
            } else {
                break;
            }
        }

        // Update active notes & check misses
        for (let i = this.notes.length - 1; i >= 0; i--) {
            const note = this.notes[i];

            if (note.shouldMiss(currentTime)) {
                console.log(`Missed note at ${note.time}`);
                note.missed = true;
                this.notes.splice(i, 1);
                // Trigger global miss event?
            }
        }
    }

    draw(ctx, currentTime) {
        // Calculate lane positions (Same as Game.js - should centralize this logic)
        const centerX = ctx.canvas.width / 2;
        const totalLaneWidth = 400;
        this.startX = centerX - (totalLaneWidth / 2);
        this.laneWidth = 100;

        const judgeY = ctx.canvas.height * CONFIG.JUDGE_LINE_Y;

        this.notes.forEach(note => {
            if (!note.hit && !note.missed) {
                const laneX = this.startX + (note.lane * this.laneWidth);
                note.draw(ctx, currentTime, laneX, judgeY);
            }
        });
    }

    getNotesInLane(lane) {
        return this.notes.filter(n => n.lane === lane && !n.hit && !n.missed);
    }
}

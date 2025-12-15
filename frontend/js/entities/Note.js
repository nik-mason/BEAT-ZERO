import { CONFIG } from '../core/CONFIG.js';

export class Note {
    constructor(data) {
        this.time = data.time; // Timing in ms
        this.lane = data.lane; // 0-3
        this.type = data.type || 'tap';

        this.hit = false;
        this.missed = false;

        // Rendering cache
        this.width = 100; // Placeholder, set by lane width
        this.height = 20;
    }

    update(currentTime) {
        // Logic if needed (e.g. hold notes)
    }

    draw(ctx, currentTime, laneX, judgeY) {
        if (this.hit) return; // Don't draw if hit

        // Calculate Y position
        // When currentTime == this.time, Y should be judgeY
        // Distance = TimeDiff * Speed
        // We want note to approach from TOP.
        // Y = JudgeY - (TimeDiff * PixelsPerMS)

        // Speed = 1000ms to travel from spawn to judge? 
        // Let's deduce PixelsPerMS: (SpawnDistance / NoteSpeedMS)
        // If spawn is at Y=0 and Judge is at Y=600. Distance = 600.
        // If NoteSpeed is 1000ms. PixelsPerMS = 0.6.

        const timeDiff = this.time - currentTime;

        // Simple linear interpolation
        // Let's use a fixed pixel speed for now derived from CONFIG
        // Or assume 0 is top and Judge is target.

        // Let's try: JudgeY - (timeDiff * speedMultiplier)
        // If timeDiff is 1000 (1 sec away), Y should be JudgeY - 1000*Speed

        const y = judgeY - (timeDiff * CONFIG.SCROLL_SPEED);

        // Draw
        ctx.fillStyle = "#fff";

        // Add glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#fff";

        ctx.fillRect(laneX, y - (this.height / 2), this.width - 4, this.height);

        // Reset
        ctx.shadowBlur = 0;
    }

    // Check collision/position for miss
    shouldMiss(currentTime) {
        // If passed miss window
        return (currentTime - this.time) > CONFIG.JUDGMENT.MISS;
    }
}

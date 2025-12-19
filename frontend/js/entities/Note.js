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
        const timeDiff = this.time - currentTime;
        const y = judgeY - (timeDiff * CONFIG.SCROLL_SPEED);

        // Don't draw if off screen (too high)
        if (y + this.height < -100) return;

        // Ice Note Dimensions
        const w = this.width - 10;
        const h = this.height + 14;
        const x = laneX + 5;
        const drawY = y - (h / 2);

        // 1. Motion Trail (Speed Effect)
        // Draw a fading tail behind the note
        const trailHeight = h * 2.0;
        const trailGrad = ctx.createLinearGradient(x, drawY, x, drawY - trailHeight);
        trailGrad.addColorStop(0, "rgba(0, 255, 255, 0.3)");
        trailGrad.addColorStop(1, "rgba(0, 255, 255, 0)");

        ctx.fillStyle = trailGrad;
        ctx.fillRect(x + 5, drawY - trailHeight, w - 10, trailHeight);

        // 2. Outer Glow (Intense Aura)
        ctx.shadowBlur = 25;
        ctx.shadowColor = "#00ffff";

        // 3. Base Crystal Body
        const grad = ctx.createLinearGradient(x, drawY, x, drawY + h);
        grad.addColorStop(0, "rgba(220, 255, 255, 0.95)");
        grad.addColorStop(0.4, "rgba(0, 255, 255, 0.8)");
        grad.addColorStop(1, "rgba(0, 100, 220, 0.9)");

        ctx.fillStyle = grad;

        ctx.beginPath();
        // Beveled crystal shape
        ctx.moveTo(x, drawY + 8);
        ctx.lineTo(x + 8, drawY);
        ctx.lineTo(x + w - 8, drawY);
        ctx.lineTo(x + w, drawY + 8);
        ctx.lineTo(x + w, drawY + h - 8);
        ctx.lineTo(x + w - 8, drawY + h);
        ctx.lineTo(x + 8, drawY + h);
        ctx.lineTo(x, drawY + h - 8);
        ctx.closePath();
        ctx.fill();

        // 4. Internal Facets (Cracks/Reflections)
        ctx.shadowBlur = 0; // Reset for details

        ctx.save();
        ctx.clip(); // Clip drawing to the crystal body

        // Diagonal light refraction
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.beginPath();
        ctx.moveTo(x, drawY + h);
        ctx.lineTo(x + w, drawY);
        ctx.lineTo(x + w, drawY + h * 0.4);
        ctx.lineTo(x + w * 0.4, drawY + h);
        ctx.fill();

        // Top Highlight (Sharp)
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fillRect(x, drawY, w, h * 0.15);

        ctx.restore();

        // 5. Border (Sharp Edges)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // 6. Core Spark (Center Brightness)
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x + w / 2, drawY + h / 2, w * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Reset
        ctx.shadowBlur = 0;
    }

    // Check collision/position for miss
    shouldMiss(currentTime) {
        // If passed miss window
        return (currentTime - this.time) > CONFIG.JUDGMENT.MISS;
    }
}

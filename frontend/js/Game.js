import { CONFIG } from './core/CONFIG.js';
import { Input } from './core/Input.js';
import { Timer } from './core/Timer.js';
import { NoteManager } from './systems/NoteManager.js';
import { Judge } from './systems/Judge.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Initialize Systems
        this.timer = new Timer();
        this.input = new Input();
        this.noteManager = new NoteManager();
        this.judge = new Judge();

        // Bind Input to Judge
        this.input.addClass((lane, action, time) => {
            if (action === 'down') {
                // Visual Effect for Key Press (Beam)
                this.spawnLaneEffect(lane);

                // Use Game Time
                const gameTime = this.timer.getTime();
                // If timer hasn't started, maybe start it on first key press? 
                // Or just ignore.

                if (this.timer.isRunning) {
                    const result = this.judge.judgeInput(lane, gameTime, this.noteManager.getNotesInLane(lane));
                    if (result) {
                        console.log(`Hit: ${result.result}`);
                        this.spawnHitEffect(lane, result.result);
                    }
                } else {
                    // Start game on first key for testing
                    // this.start();
                }
            }
        });

        // Debug: Start automatically for now
        this.start();

        this.lastTime = 0;
        this.fpsDisplay = document.getElementById('fps-display');

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);

        console.log("Game Initialized");
    }

    async start() {
        try {
            // Load Chart
            const response = await fetch('assets/chart.json');
            const data = await response.json();

            // Load Audio
            const audioResponse = await fetch('assets/bgm1.mp3');
            const audioArrayBuffer = await audioResponse.arrayBuffer();
            const audioBuffer = await this.timer.ctx.decodeAudioData(audioArrayBuffer);

            console.log("Audio Loaded:", audioBuffer.duration + "s");

            const chart = { notes: [] };
            let lastLane = -1;

            // Generate notes
            data.timestamps.forEach(time => {
                let lane;
                do {
                    lane = Math.floor(Math.random() * 4);
                } while (lane === lastLane);

                lastLane = lane;

                chart.notes.push({
                    time: time * 1000,
                    lane: lane,
                    type: 'tap'
                });
            });

            this.noteManager.loadChart(chart);
            // Play Audio & Start Timer
            this.timer.play(audioBuffer);

            console.log(`Loaded ${chart.notes.length} notes from JSON.`);
        } catch (e) {
            console.error("Failed to load assets:", e);
            // Fallback to dummy data if fetch fails
            this.startDummy();
        }
    }

    startDummy() {
        const dummyChart = { notes: [] };
        let lastLane = -1;
        for (let i = 0; i < 200; i++) {
            let lane;
            do {
                lane = Math.floor(Math.random() * 4);
            } while (lane === lastLane);
            lastLane = lane;

            dummyChart.notes.push({
                time: 1000 + (i * 180),
                lane: lane,
                type: 'tap'
            });
        }
        this.noteManager.loadChart(dummyChart);
        this.timer.start();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    update(dt) {
        const currentTime = this.timer.getTime();
        this.noteManager.update(currentTime);
    }

    draw() {
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Current Time for rendering
        const currentTime = this.timer.getTime();

        // 1. Draw Lanes
        const laneWidth = 100;
        const totalLaneWidth = laneWidth * 4;
        const centerX = this.canvas.width / 2;
        const startX = centerX - (totalLaneWidth / 2);

        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        this.ctx.lineWidth = 2;

        for (let i = 0; i <= 4; i++) {
            const x = startX + (i * laneWidth);
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        // 2. Draw Judge Line
        const judgeY = this.canvas.height * CONFIG.JUDGE_LINE_Y;

        // Glow
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = "#0ff";

        // Thicker Line
        this.ctx.lineWidth = 5;
        this.ctx.strokeStyle = "#0ff";

        this.ctx.beginPath();
        this.ctx.moveTo(startX, judgeY);
        this.ctx.lineTo(startX + totalLaneWidth, judgeY);
        this.ctx.stroke();

        this.ctx.shadowBlur = 0;
        this.ctx.lineWidth = 2; // Reset

        // 3. Draw Notes
        this.noteManager.draw(this.ctx, currentTime);
    }

    spawnLaneEffect(laneIndex) {
        // Create Beam
        const laneWidth = 100;
        const totalLaneWidth = 400;
        const centerX = this.canvas.width / 2;
        const startX = centerX - (totalLaneWidth / 2);

        const x = startX + (laneIndex * laneWidth);

        const effectLayer = document.getElementById('effect-layer');
        if (effectLayer) {
            const beam = document.createElement('div');
            beam.className = 'lane-beam';
            beam.style.left = `${x}px`;
            // Height/Top needs to be relative to bottom or covered by CSS
            // CSS has height: 100%, bottom: 0. 
            // We just need correct X position.

            effectLayer.appendChild(beam);
            setTimeout(() => beam.remove(), 150);

            // Optional: Press Bar Indicator
            const press = document.createElement('div');
            press.className = 'lane-press-highlight';
            press.style.left = `${x}px`;
            press.style.top = `${this.canvas.height * CONFIG.JUDGE_LINE_Y}px`; // Match judge line
            effectLayer.appendChild(press);
            setTimeout(() => press.remove(), 100);

            // Particles
            for (let i = 0; i < 8; i++) {
                const p = document.createElement('div');
                p.className = 'lane-particle';
                p.style.left = `${x + 50}px`; // Center of lane
                p.style.top = `${this.canvas.height * CONFIG.JUDGE_LINE_Y}px`;

                // Random velocity via CSS variables or just styles
                const angle = Math.random() * Math.PI * 2;
                const speed = 50 + Math.random() * 100;
                const tx = Math.cos(angle) * speed;
                const ty = Math.sin(angle) * speed;

                p.style.setProperty('--tx', `${tx}px`);
                p.style.setProperty('--ty', `${ty}px`);

                effectLayer.appendChild(p);
                setTimeout(() => p.remove(), 500); // Match animation
            }
        }
    }

    spawnHitEffect(laneIndex, judgment) {
        // Visual Ripple on Lane
        const laneWidth = 100;
        const totalLaneWidth = 400;
        const centerX = this.canvas.width / 2;
        const startX = centerX - (totalLaneWidth / 2);

        const x = startX + (laneIndex * laneWidth) + (laneWidth / 2); // Center of lane
        const y = this.canvas.height * CONFIG.JUDGE_LINE_Y;

        // Create DOM element for ripple (easier to animate via CSS than Canvas for now)
        const effectLayer = document.getElementById('effect-layer');
        if (effectLayer) {
            const ripple = document.createElement('div');
            ripple.className = 'note-hit-effect';
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;

            // Color based on judgment?
            if (judgment === 'PERFECT') ripple.style.borderColor = '#00ffff';
            else if (judgment === 'GREAT') ripple.style.borderColor = '#00ff00';
            else ripple.style.borderColor = '#ffff00';

            effectLayer.appendChild(ripple);

            // Clean up
            setTimeout(() => ripple.remove(), 500);
        }
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        if (this.fpsDisplay) {
            this.fpsDisplay.innerText = `FPS: ${Math.round(1000 / dt)}`;
        }

        requestAnimationFrame(this.loop);
    }
}

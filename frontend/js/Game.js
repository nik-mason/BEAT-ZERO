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

        // Initialize Lane States (Visuals)
        this.laneStates = [
            { pressed: false, value: 0 },
            { pressed: false, value: 0 },
            { pressed: false, value: 0 },
            { pressed: false, value: 0 }
        ];

        // Bind Input to Judge & Visuals
        this.input.addClass((lane, action, time) => {
            if (action === 'down') {
                this.laneStates[lane].pressed = true;
                this.spawnLaneEffect(lane);

                const gameTime = this.timer.getTime();
                if (this.timer.isRunning) {
                    const result = this.judge.judgeInput(lane, gameTime, this.noteManager.getNotesInLane(lane));
                    if (result) {
                        this.spawnHitEffect(lane, result.result);
                    }
                }
            } else if (action === 'up') {
                this.laneStates[lane].pressed = false;
            }
        });

        // Touch / Mouse Support
        this.bindInput();

        this.loop = this.loop.bind(this);

        this.lastTime = 0;
        this.fpsDisplay = document.getElementById('fps-display');
        console.log("Game Initialized");
    }

    bindInput() {
        const handleInput = (clientX, isDown) => {
            // Calculate Lane
            const rect = this.canvas.getBoundingClientRect();
            const x = clientX - rect.left;

            const laneWidth = 100;
            const totalLaneWidth = 400;
            const centerX = this.canvas.width / 2;
            const startX = centerX - (totalLaneWidth / 2);

            if (x >= startX && x <= startX + totalLaneWidth) {
                const laneIndex = Math.floor((x - startX) / laneWidth);
                if (laneIndex >= 0 && laneIndex < 4) {
                    if (isDown && !this.laneStates[laneIndex].pressed) {
                        this.input.trigger(laneIndex, 'down', performance.now());
                    } else if (!isDown && this.laneStates[laneIndex].pressed) {
                        this.input.trigger(laneIndex, 'up', performance.now());
                    }
                }
            }
        };

        // Mouse (PC Testing)
        this.canvas.addEventListener('mousedown', (e) => handleInput(e.clientX, true));
        this.canvas.addEventListener('mouseup', (e) => handleInput(e.clientX, false));

        // Touch (Mobile)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                handleInput(e.changedTouches[i].clientX, true);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                handleInput(e.changedTouches[i].clientX, false);
            }
        }, { passive: false });
    }

    async start(chartData) {
        // Reset Visuals
        this.laneStates.forEach(state => {
            state.pressed = false;
            state.value = 0;
        });

        try {
            let data = chartData;
            if (!data) {
                // Load Chart fallback
                const response = await fetch('assets/chart.json');
                data = await response.json();
            }

            console.log("Starting Song:", data.name || "Unknown");

            // Load Audio
            const audioFilename = data.filename || 'bgm1.mp3';
            const audioResponse = await fetch(`assets/${audioFilename}`);
            const audioArrayBuffer = await audioResponse.arrayBuffer();
            const audioBuffer = await this.timer.ctx.decodeAudioData(audioArrayBuffer);

            console.log("Audio Loaded:", audioBuffer.duration + "s");

            const chart = { notes: [] };
            // ... (rest of logic) ...

            // Generate notes
            const timestamps = data.timestamps || [];
            let lastLane = -1;

            timestamps.forEach(time => {
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

            // Start Loop
            this.animationFrameId = requestAnimationFrame(this.loop);
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

        // Animate Lane Keys
        // Value 0 = Up, 1 = Down (Pressed)
        // Use dt for smooth lerp
        const speed = 0.02 * dt;
        for (let i = 0; i < 4; i++) {
            const target = this.laneStates[i].pressed ? 1 : 0;
            // Simple approach
            const diff = target - this.laneStates[i].value;
            this.laneStates[i].value += diff * 0.3; // Responsive lerp
        }
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.timer.stop();
        // Clear notes?
        // this.noteManager.clear(); // If needed
    }

    draw() {
        // Clear Canvas (Transparent to show CSS background)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Current Time for rendering
        const currentTime = this.timer.getTime();

        // Optional: Darken the lane area slightly for visibility
        const laneWidth = 100; // Hardcoded matches CONFIG
        const totalLaneWidth = 400;
        const centerX = this.canvas.width / 2;
        const startX = centerX - (totalLaneWidth / 2);

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; // Semi-transparent backing for lanes
        this.ctx.fillRect(startX, 0, totalLaneWidth, this.canvas.height);

        // 1. Draw Lane Lines
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        this.ctx.lineWidth = 2;

        for (let i = 0; i <= 4; i++) {
            const x = startX + (i * laneWidth);
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        // 2. Draw Judge Line (Enhanced)
        const judgeY = this.canvas.height * CONFIG.JUDGE_LINE_Y;

        // Dynamic Pulse
        const time = Date.now() / 1000;
        const pulse = 0.5 + Math.abs(Math.sin(time * 3)) * 0.5;

        // A. Hit Area Background (Faint Glow)
        const areaGrad = this.ctx.createLinearGradient(0, judgeY - 40, 0, judgeY + 40);
        areaGrad.addColorStop(0, "rgba(0, 255, 255, 0)");
        areaGrad.addColorStop(0.5, `rgba(0, 255, 255, ${0.15 * pulse})`);
        areaGrad.addColorStop(1, "rgba(0, 255, 255, 0)");

        this.ctx.fillStyle = areaGrad;
        this.ctx.fillRect(startX - 50, judgeY - 40, totalLaneWidth + 100, 80);

        // B. Main Line with Gradient
        const lineGrad = this.ctx.createLinearGradient(startX, 0, startX + totalLaneWidth, 0);
        lineGrad.addColorStop(0, "rgba(0, 255, 255, 0)");
        lineGrad.addColorStop(0.2, "#0ff");
        lineGrad.addColorStop(0.5, "#fff"); // Center hot white
        lineGrad.addColorStop(0.8, "#0ff");
        lineGrad.addColorStop(1, "rgba(0, 255, 255, 0)");

        this.ctx.shadowBlur = 10 + (20 * pulse);
        this.ctx.shadowColor = "#00ffff";
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = lineGrad;

        this.ctx.beginPath();
        this.ctx.moveTo(startX - 20, judgeY); // Extend slightly
        this.ctx.lineTo(startX + totalLaneWidth + 20, judgeY);
        this.ctx.stroke();

        this.ctx.shadowBlur = 0; // Reset for details

        // C. Lane Markers (Tech Details)
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        for (let i = 0; i <= 4; i++) {
            const lx = startX + (i * laneWidth);

            // Tech Brackets
            this.ctx.fillRect(lx - 2, judgeY - 15, 4, 30);

            // Glowing dots
            this.ctx.beginPath();
            this.ctx.arc(lx, judgeY, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = "#fff";
            this.ctx.fill();
        }

        // D. Key Input Visuals (Below Judge Line)
        for (let i = 0; i < 4; i++) {
            const laneX = startX + (i * laneWidth);
            const val = this.laneStates[i].value; // 0 to 1

            const keyHeight = 150;
            const baseY = judgeY + 10;

            // "Press" offset - moves down by 20px when pressed
            const pressOffset = val * 20;

            // Color Interpolation (Cyan to White)
            // Pressed = Hot White, Idle = Dark Transparent Cyan
            const r = 0 + (val * 255);
            const g = 255;
            const b = 255;
            const alpha = 0.2 + (val * 0.6); // 0.2 -> 0.8

            const cx = laneX + 5;
            const cy = baseY + pressOffset;
            const cw = laneWidth - 10;
            const ch = keyHeight;

            // 1. Key Body Gradient
            const grad = this.ctx.createLinearGradient(cx, cy, cx, cy + ch);
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
            grad.addColorStop(1, "rgba(0, 0, 0, 0)"); // Fade out at bottom

            this.ctx.fillStyle = grad;
            this.ctx.fillRect(cx, cy, cw, ch);

            // 2. Top Edge (The "Physical" Key Top)
            this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.8 + (val * 0.2)})`;
            this.ctx.fillRect(cx, cy, cw, 5); // Thin bright line at top

            // 3. Side Bevels (3D feel)
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.lineTo(cx, cy + ch); // Left side
            this.ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 * (1 - val)})`;
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(cx + cw, cy);
            this.ctx.lineTo(cx + cw, cy + ch); // Right side
            this.ctx.stroke();
        }

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
        // Play Sound on PERFECT
        if (judgment === 'PERFECT' && this.beatBuffer) {
            const source = this.timer.ctx.createBufferSource();
            source.buffer = this.beatBuffer;
            source.connect(this.timer.ctx.destination);
            source.start(0);
        }

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

        this.animationFrameId = requestAnimationFrame(this.loop);
    }
}

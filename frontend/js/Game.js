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
        this.isPaused = false;
        this.songFinished = false;
        this.songEndTime = 0;
        this.resultShown = false;

        // Easter egg: Score click counter
        this.scoreClickCount = 0;
        this.glitchMode = false;
        this.easterEggSetup = false;
        this.invisibleMode = false; // Easter Egg: Invisible Notes
        this.feverMode = false; // Easter Egg: Fever Time

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

    setupScoreClickEasterEgg() {
        // Wait a bit for DOM to be fully ready
        setTimeout(() => {
            const scoreDisplay = document.getElementById('score-display');
            console.log("🔍 Setting up Easter egg, scoreDisplay:", scoreDisplay);

            if (scoreDisplay) {
                // Make sure it's clickable
                scoreDisplay.style.pointerEvents = 'auto';
                scoreDisplay.style.cursor = 'pointer';
                scoreDisplay.style.userSelect = 'none';

                scoreDisplay.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    this.scoreClickCount++;
                    console.log(`🎮 Score clicked: ${this.scoreClickCount}/7`);

                    // Visual feedback
                    scoreDisplay.style.transform = 'translateX(100px) scale(0.95)';
                    setTimeout(() => {
                        scoreDisplay.style.transform = 'translateX(100px) scale(1)';
                    }, 100);

                    if (this.scoreClickCount >= 7) {
                        console.log("🎯 ACTIVATING GLITCH MODE!");
                        this.activateGlitchMode();
                        this.scoreClickCount = 0;
                    }
                }, true); // Use capture phase

                console.log("✅ Easter egg setup complete!");
            } else {
                console.error("❌ Score display element not found!");
            }
        }, 1000); // Wait 1 second for animations to complete
    }

    activateGlitchMode() {
        if (this.glitchMode) return;

        this.glitchMode = true;
        console.log("💥 GLITCH MODE ACTIVATED!");

        const gameContainer = document.getElementById('game-container');

        // Add glitch class for CSS animations
        gameContainer.classList.add('glitch-active');

        // Create noise overlay
        const noiseOverlay = document.createElement('div');
        noiseOverlay.id = 'noise-overlay';
        noiseOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: repeating-linear-gradient(
                0deg,
                rgba(0, 0, 0, 0.1) 0px,
                rgba(255, 255, 255, 0.05) 1px,
                rgba(0, 0, 0, 0.1) 2px
            );
            pointer-events: none;
            z-index: 999;
            animation: glitch-noise 0.1s infinite;
            mix-blend-mode: overlay;
        `;
        gameContainer.appendChild(noiseOverlay);

        // Deactivate after 3 seconds
        setTimeout(() => {
            this.glitchMode = false;
            gameContainer.classList.remove('glitch-active');
            if (noiseOverlay.parentNode) {
                noiseOverlay.remove();
            }
            console.log("✨ Glitch mode deactivated");
        }, 3000);
    }

    playGlitchSound() {
        if (!this.timer || !this.timer.ctx) return;

        // Play multiple distorted tick sounds rapidly
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                fetch('assets/tick.mp3')
                    .then(response => response.arrayBuffer())
                    .then(arrayBuffer => this.timer.ctx.decodeAudioData(arrayBuffer))
                    .then(audioBuffer => {
                        const source = this.timer.ctx.createBufferSource();
                        source.buffer = audioBuffer;

                        // Create gain node for volume
                        const gainNode = this.timer.ctx.createGain();
                        gainNode.gain.value = 0.3;

                        // Distort the pitch randomly
                        source.playbackRate.value = 0.5 + Math.random() * 1.5;

                        source.connect(gainNode);
                        gainNode.connect(this.timer.ctx.destination);
                        source.start(0);
                    })
                    .catch(err => console.warn("Glitch sound failed:", err));
            }, i * 100);
        }
    }

    async start(chartData) {
        // Reset Visuals and State
        this.laneStates.forEach(state => {
            state.pressed = false;
            state.value = 0;
        });

        // Reset result screen state
        this.songFinished = false;
        this.songEndTime = 0;
        this.resultShown = false;
        this.judge.reset();

        // Setup Easter egg (only once)
        if (!this.easterEggSetup) {
            this.setupScoreClickEasterEgg();
            this.easterEggSetup = true;
        }

        // Fever Mode Visual Toggle
        const gameContainer = document.getElementById('game-container');
        const scoreDisplay = document.getElementById('score-display');

        if (this.feverMode) {
            gameContainer.classList.add('fever-active');
            if (scoreDisplay) scoreDisplay.classList.add('fever-pop');
            console.log("🌈 FEVER ACTIVE: Rainbow background & Bouncing UI enabled!");
        } else {
            gameContainer.classList.remove('fever-active');
            if (scoreDisplay) scoreDisplay.classList.remove('fever-pop');
        }

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

            // Load Hit Sound (notetick.wav)
            try {
                const hitSoundResponse = await fetch('assets/notetick.wav');
                const hitSoundArrayBuffer = await hitSoundResponse.arrayBuffer();
                this.hitSoundBuffer = await this.timer.ctx.decodeAudioData(hitSoundArrayBuffer);
                console.log("Hit Sound Loaded");
            } catch (hitSoundError) {
                console.warn("Failed to load hit sound:", hitSoundError);
                this.hitSoundBuffer = null;
            }

            const chart = { notes: [] };

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

        // Ensure loop starts even in dummy mode
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    update(dt) {
        const currentTime = this.timer.getTime();
        this.noteManager.update(currentTime);

        // Check if song finished
        if (!this.songFinished && this.noteManager.isFinished()) {
            this.songFinished = true;
            this.songEndTime = currentTime;
            console.log("Song finished!");
        }

        // Show result screen 2 seconds after song end
        if (this.songFinished && !this.resultShown && (currentTime - this.songEndTime) >= 2000) {
            this.resultShown = true;
            this.showResultScreen();
        }

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

    showResultScreen() {
        const totalNotes = this.noteManager.getTotalNotes();
        const grade = this.judge.calculateGrade(totalNotes);
        const accuracy = this.judge.getAccuracy(totalNotes);

        console.log(`Result: Grade ${grade}, Accuracy ${accuracy}%`);

        // Update result screen UI
        const resultScreen = document.getElementById('result-screen');
        const gradeEl = document.getElementById('result-grade');
        const accuracyEl = document.getElementById('result-accuracy');
        const scoreEl = document.getElementById('result-score');
        const maxComboEl = document.getElementById('result-max-combo');
        const perfectEl = document.getElementById('result-perfect');
        const greatEl = document.getElementById('result-great');
        const goodEl = document.getElementById('result-good');
        const missEl = document.getElementById('result-miss');

        // Set grade with appropriate class
        gradeEl.textContent = grade;
        gradeEl.className = `result-grade grade-${grade.toLowerCase()}`;

        // Set stats
        accuracyEl.textContent = `${accuracy}%`;
        scoreEl.textContent = this.judge.stats.score.toString().padStart(7, '0');
        maxComboEl.textContent = this.judge.stats.maxCombo;
        perfectEl.textContent = this.judge.stats.perfect;
        greatEl.textContent = this.judge.stats.great;
        goodEl.textContent = this.judge.stats.good;
        missEl.textContent = this.judge.stats.miss;

        // Show result screen
        resultScreen.style.display = 'flex';
    }

    pause() {
        if (this.isPaused) return;
        this.isPaused = true;

        // Suspend audio
        if (this.timer.ctx.state === 'running') {
            this.timer.ctx.suspend();
        }

        // Show pause menu
        document.getElementById('pause-menu').style.display = 'flex';
    }

    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;

        // Resume audio
        if (this.timer.ctx.state === 'suspended') {
            this.timer.ctx.resume();
        }

        // Hide pause menu
        document.getElementById('pause-menu').style.display = 'none';

        // Reset lastTime to prevent huge dt jump
        this.lastTime = performance.now();
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
        this.noteManager.draw(this.ctx, currentTime, this.invisibleMode);
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
        // Hit sound disabled
        /*
        if (this.hitSoundBuffer) {
            const source = this.timer.ctx.createBufferSource();
            source.buffer = this.hitSoundBuffer;

            // Create gain node for volume control
            const gainNode = this.timer.ctx.createGain();

            // Set volume based on judgment quality
            let volume = 0.5; // Default
            switch (judgment) {
                case 'PERFECT':
                    volume = 1.0;
                    break;
                case 'GREAT':
                    volume = 0.8;
                    break;
                case 'GOOD':
                    volume = 0.6;
                    break;
                case 'NORMAL':
                    volume = 0.4;
                    break;
                case 'BAD':
                    volume = 0.3;
                    break;
                default:
                    volume = 0.2;
            }

            gainNode.gain.value = volume;
            source.connect(gainNode);
            gainNode.connect(this.timer.ctx.destination);
            source.start(0);
        }
        */

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

        // Fever Mode Impact: Shake screen on hit
        if (this.feverMode && (judgment === 'PERFECT' || judgment === 'GREAT' || judgment === 'GOOD')) {
            const container = document.getElementById('game-container');
            if (container) {
                container.classList.remove('fever-impact');
                void container.offsetWidth; // Trigger reflow for re-animation
                container.classList.add('fever-impact');
            }

            // MASSIVE PARTICLE EXPLOSION for Fever Mode (Optimized)
            if (effectLayer) {
                const particleCount = 20; // Reduced from 50 for performance
                const colors = ['#00ffff', '#ff00ff', '#ffff00', '#ff0055', '#fff', '#00ff00'];

                for (let i = 0; i < particleCount; i++) {
                    const p = document.createElement('div');
                    p.className = 'lane-particle fever-particle';
                    p.style.left = `${x}px`;
                    p.style.top = `${y}px`;

                    const angle = Math.random() * Math.PI * 2;
                    const speed = 150 + Math.random() * 400;
                    const tx = Math.cos(angle) * speed;
                    const ty = Math.sin(angle) * speed;

                    const size = 12 + Math.random() * 18; // Still large, but fewer
                    p.style.width = `${size}px`;
                    p.style.height = `${size}px`;
                    p.style.background = colors[Math.floor(Math.random() * colors.length)];
                    p.style.boxShadow = `0 0 15px ${p.style.background}`; // Simpler shadow for performance

                    p.style.setProperty('--tx', `${tx}px`);
                    p.style.setProperty('--ty', `${ty}px`);

                    effectLayer.appendChild(p);
                    setTimeout(() => p.remove(), 1200);
                }
            }
        }
    }

    loop(timestamp) {
        if (this.isPaused) {
            this.animationFrameId = requestAnimationFrame(this.loop);
            return;
        }

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

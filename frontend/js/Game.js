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
            // Guard: Only process if game is active and not paused
            if (!this.timer.isRunning || this.isPaused || this.songFinished) return;

            if (action === 'down') {
                this.laneStates[lane].pressed = true;
                this.spawnLaneEffect(lane);

                const gameTime = this.timer.getTime();
                const result = this.judge.judgeInput(lane, gameTime, this.noteManager.getNotesInLane(lane));
                if (result) {
                    this.spawnHitEffect(lane, result.result);
                }
            } else if (action === 'up') {
                this.laneStates[lane].pressed = false;
            }
        }, 'game_main_logic'); // Named handler to prevent accidental wipe

        // Touch / Mouse Support
        this.bindInput();

        this.loop = this.loop.bind(this);

        this.lastTime = 0;
        this.fpsDisplay = document.getElementById('fps-display');
        this.isPaused = false;
        this.songFinished = false;
        this.songEndTime = 0;
        this.resultShown = false;
        this.currentSongName = '';
        this.onSongFinish = null; // Callback for parent (script.js)

        // Easter egg: Score click counter
        this.scoreClickCount = 0;
        this.glitchMode = false;
        this.easterEggSetup = false;
        this.invisibleMode = false; // Easter Egg: Invisible Notes
        this.feverMode = false; // Easter Egg: Fever Time

        console.log("Game Initialized");

        this.glitchSoundBuffer = null;
        this.preloadResources();
        this.setupGlobalListeners();
    }

    preloadResources() {
        // Cache glitch sound to avoid repetitive fetches
        fetch('assets/tick.mp3')
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => this.timer.ctx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                this.glitchSoundBuffer = audioBuffer;
                console.log("📦 Glitch sound cached");
            })
            .catch(err => console.warn("Resource preload failed:", err));
    }

    setupGlobalListeners() {
        // 창 크기 대응
        // window.removeEventListener('resize', this.resize); // Prevents duplicates if re-initialized
        // window.addEventListener('resize', () => this.resize()); // Already in constructor but better here

        // 7. 탭 전환 대응 (Visibility API)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.timer.isRunning && !this.isPaused) {
                    this.pause(true); // Silent pause
                }
            }
        });
    }
    bindInput() {
        // Track which lane each touch is currently in for slide support
        const touchLanes = new Map();

        const getLaneFromX = (clientX) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const laneWidth = 100;
            const totalLaneWidth = 400;
            const centerX = this.canvas.width / 2;
            const startX = centerX - (totalLaneWidth / 2);

            if (x >= startX && x <= startX + totalLaneWidth) {
                const lane = Math.floor((x - startX) / laneWidth);
                return (lane >= 0 && lane < 4) ? lane : null;
            }
            return null;
        };

        const isLaneInAnyOtherTouch = (laneIndex, currentTouchId) => {
            for (const [id, lane] of touchLanes.entries()) {
                if (id !== currentTouchId && lane === laneIndex) return true;
            }
            return false;
        };

        // Mouse (PC Testing) - Single pointer simple logic
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.timer.isRunning || this.isPaused || this.songFinished) return;
            const lane = getLaneFromX(e.clientX);
            if (lane !== null && !this.laneStates[lane].pressed) {
                this.input.trigger(lane, 'down', performance.now());
            }
        });
        this.canvas.addEventListener('mouseup', (e) => {
            const lane = getLaneFromX(e.clientX);
            if (lane !== null) {
                this.input.trigger(lane, 'up', performance.now());
            } else {
                // If moved out, release all just in case
                for (let i = 0; i < 4; i++) {
                    if (this.laneStates[i].pressed) this.input.trigger(i, 'up', performance.now());
                }
            }
        });

        // Touch (Mobile) - Multi-touch + Drag/Slide support
        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.timer.isRunning || this.isPaused || this.songFinished) return;
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const lane = getLaneFromX(touch.clientX);
                if (lane !== null) {
                    touchLanes.set(touch.identifier, lane);
                    if (!this.laneStates[lane].pressed) {
                        this.input.trigger(lane, 'down', performance.now());
                    }
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.timer.isRunning || this.isPaused || this.songFinished) return;
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const currentId = touch.identifier;
                const newLane = getLaneFromX(touch.clientX);
                const oldLane = touchLanes.get(currentId);

                if (newLane !== oldLane) {
                    // 1. Handle Release of old lane
                    if (oldLane !== undefined && oldLane !== null) {
                        if (!isLaneInAnyOtherTouch(oldLane, currentId)) {
                            this.input.trigger(oldLane, 'up', performance.now());
                        }
                    }

                    // 2. Handle Press of new lane
                    if (newLane !== null) {
                        touchLanes.set(currentId, newLane);
                        if (!this.laneStates[newLane].pressed) {
                            this.input.trigger(newLane, 'down', performance.now());
                        }
                    } else {
                        touchLanes.delete(currentId);
                    }
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const id = touch.identifier;
                const lane = touchLanes.get(id);

                if (lane !== undefined && lane !== null) {
                    touchLanes.delete(id);
                    if (!isLaneInAnyOtherTouch(lane, id)) {
                        this.input.trigger(lane, 'up', performance.now());
                    }
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            // Full reset for safety on cancel
            touchLanes.clear();
            for (let i = 0; i < 4; i++) {
                if (this.laneStates[i].pressed) this.input.trigger(i, 'up', performance.now());
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
        this.glitchMode = true;
        this.playGlitchSound();
        const crt = document.querySelector('.crt-static');
        if (crt) crt.style.display = 'block';

        // Auto-disable after some time or on stop
        setTimeout(() => {
            if (this.glitchMode) this.glitchMode = false;
            if (crt) crt.style.display = 'none';
        }, 5000);
    }

    playGlitchSound() {
        if (!this.timer || !this.timer.ctx || !this.glitchSoundBuffer) return;

        // Play multiple distorted sounds rapidly using cached buffer
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const source = this.timer.ctx.createBufferSource();
                source.buffer = this.glitchSoundBuffer;

                const gainNode = this.timer.ctx.createGain();
                gainNode.gain.value = 0.3;
                source.playbackRate.value = 0.5 + Math.random() * 1.5;

                source.connect(gainNode);
                gainNode.connect(this.timer.ctx.destination);
                source.start(0);
            }, i * 100);
        }
    }

    async start(chartData) {
        // 1. 상태 초기화 완벽 리셋 (20+ 버그 해결의 핵심)
        this.songFinished = false;
        this.resultShown = false;
        this.isPaused = false;
        this.scoreClickCount = 0;
        this.glitchMode = false;
        this.currentSongName = chartData ? (chartData.name || 'Unknown') : 'Unknown';

        // Reset Judge stats
        this.judge.reset();

        // Reset Lane States
        this.laneStates.forEach(state => {
            state.pressed = false;
            state.value = 0;
        });

        // Setup Easter egg (only once)
        if (!this.easterEggSetup) {
            this.setupScoreClickEasterEgg();
            this.easterEggSetup = true;
        }

        // Fever Mode Visual Toggle
        const gameContainer = document.getElementById('game-container');
        const scoreDisplay = document.getElementById('score-display');

        if (this.feverMode) {
            if (gameContainer) gameContainer.classList.add('fever-active');
            if (scoreDisplay) scoreDisplay.classList.add('fever-pop');
            console.log("🌈 FEVER ACTIVE!");
        } else {
            if (gameContainer) gameContainer.classList.remove('fever-active');
            if (scoreDisplay) scoreDisplay.classList.remove('fever-pop');
        }

        // Ensure canvas size is correct before starting
        this.resize();

        // Stop any existing loop to prevent doubling
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.lastTime = performance.now();

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

            // Double check if we should still start (user might have quit during fetch)
            if (this.songFinished || document.getElementById('main-menu').style.display !== 'none') {
                console.log("🛑 Song start cancelled (Quit during load)");
                this.stop(); // Clean up context if needed
                return;
            }

            // Play Audio & Start Timer
            this.timer.play(audioBuffer);

            console.log(`Loaded ${chart.notes.length} notes from JSON.`);

            // Final check and start loop (Prevent double loop)
            if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = requestAnimationFrame(this.loop);
        } catch (err) {
            console.error("Critical Game Start Error:", err);
            // Rescue to Main Menu
            this.stop();
            const mm = document.getElementById('main-menu');
            const gc = document.getElementById('game-container');
            if (mm) mm.style.display = 'flex';
            if (gc) gc.style.display = 'none';
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
        this.cleanUpVisuals(); // Full Audit Fix: Reset all effects
    }

    cleanUpVisuals() {
        // 1. Reset Fever Mode
        const gameContainer = document.getElementById('game-container');
        const scoreDisplay = document.getElementById('score-display');
        if (gameContainer) gameContainer.classList.remove('fever-active', 'fever-impact');
        if (scoreDisplay) scoreDisplay.classList.remove('fever-pop');

        // 2. Clear Effect Layer
        const effectLayer = document.getElementById('effect-layer');
        if (effectLayer) effectLayer.innerHTML = '';

        // 3. Reset Body Classes (Mirror, Chaos, etc.)
        document.body.classList.remove('mirror-mode', 'chaos-active');
        const crt = document.querySelector('.crt-static');
        if (crt) crt.style.display = 'none';

        // 4. Reset Score Display Transform
        if (scoreDisplay) scoreDisplay.style.transform = '';

        console.log("🧹 Visual effects cleaned up.");
    }

    showResultScreen() {
        const grade = totalNotes > 0 ? this.judge.calculateGrade(totalNotes) : 'F';
        const accuracyString = totalNotes > 0 ? this.judge.getAccuracy(totalNotes) : '0.0';
        const accuracy = parseFloat(accuracyString);

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

        // Set stats with null safety
        const stats = this.judge.stats || {};
        accuracyEl.textContent = `${accuracy}%`;
        scoreEl.textContent = (stats.score || 0).toString().padStart(7, '0');
        maxComboEl.textContent = stats.maxCombo || 0;
        perfectEl.textContent = stats.perfect || 0;
        greatEl.textContent = stats.great || 0;
        goodEl.textContent = stats.good || 0;
        missEl.textContent = stats.miss || 0;

        // Show result screen
        resultScreen.style.display = 'flex';

        // Trigger finish callback for ranking
        if (this.onSongFinish) {
            this.onSongFinish({
                songName: this.currentSongName,
                score: this.judge.stats.score,
                accuracy: accuracy,
                grade: grade
            });
        }
    }

    pause(isSilent = false) {
        if (this.isPaused) return;
        this.isPaused = true;

        // Suspend audio
        if (this.timer.ctx.state === 'running') {
            this.timer.ctx.suspend();
        }

        // Show pause menu ONLY if not silent
        if (!isSilent) {
            document.getElementById('pause-menu').style.display = 'flex';
        }
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

        this.ctx.shadowColor = "#00ffff";
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = lineGrad;

        // Optimization: Only apply heavy shadow blur when pulse is high
        if (pulse > 0.8) {
            this.ctx.shadowBlur = 10 + (20 * pulse);
        } else {
            this.ctx.shadowBlur = 5;
        }

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

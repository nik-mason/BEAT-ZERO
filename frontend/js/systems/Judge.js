import { CONFIG } from '../core/CONFIG.js';

export class Judge {
    constructor() {
        this.stats = {
            perfect: 0,
            great: 0,
            good: 0,
            miss: 0,
            combo: 0,
            maxCombo: 0,
            score: 0
        };
    }

    // Returns judgment result object or null
    judgeInput(lane, inputTime, notesInLane) {
        // Find nearest note
        // notesInLane should be sorted by time usually, or just iterate
        // Since we only care about the *first* hittable note usually

        // Simple search: find closest unhit note
        let closestNote = null;
        let minDiff = Infinity;

        for (const note of notesInLane) {
            const diff = Math.abs(inputTime - note.time);
            if (diff < minDiff) {
                minDiff = diff;
                closestNote = note;
            }
        }

        if (!closestNote) return null;

        // Check windows
        const J = CONFIG.JUDGMENT;
        let result = null;

        if (minDiff <= J.PERFECT) {
            result = 'PERFECT';
        } else if (minDiff <= J.GREAT) {
            result = 'GREAT';
        } else if (minDiff <= J.GOOD) {
            result = 'GOOD';
        } else if (minDiff <= J.NORMAL) {
            result = 'NORMAL';
        } else if (minDiff <= J.BAD) {
            result = 'BAD';
        } else if (minDiff <= J.WORST) {
            result = 'WORST';
        } else if (minDiff <= J.MISS) {
            result = 'MISS';
        } else {
            return null; // Too far
        }

        // If we got a judgment (Perfect/Great/Good)
        if (result) {
            closestNote.hit = true;
            this.applyResult(result);
            return { result, diff: minDiff, note: closestNote };
        }
        return null;
    }

    applyResult(result) {
        if (result === 'MISS') {
            this.stats.miss++;
            this.stats.combo = 0;
            // Screen Desaturate or Red Flash?
        } else {
            this.stats[result.toLowerCase()]++;
            this.stats.combo++;
            if (this.stats.combo > this.stats.maxCombo) {
                this.stats.maxCombo = this.stats.combo;
            }

            // Score handling (simplified)
            const scoreMap = { 'PERFECT': 1000, 'GREAT': 700, 'GOOD': 400 };
            this.stats.score += scoreMap[result] || 0;

            // Trigger Visual Effects
            this.triggerHitEffect(result);
        }

        this.updateUI();
    }

    triggerHitEffect(judgment) {
        // 1. Screen Shake on high impact
        if (judgment === 'PERFECT' || judgment === 'GREAT') {
            const container = document.getElementById('game-container');
            container.classList.remove('shake');
            void container.offsetWidth; // Force reflow
            container.classList.add('shake');
        }

        // 2. Show Text
        this.showJudgmentText(judgment);
    }

    showJudgmentText(judgment) {
        const container = document.getElementById('judgment-display');
        if (!container) return;

        // Create text element
        const el = document.createElement('div');
        el.className = `judge-text judge-${judgment.toLowerCase()}`;
        el.innerText = judgment;

        // Clear previous
        container.innerHTML = '';
        container.appendChild(el);

        // Cleanup not really needed as we clear innerHTML, 
        // but for memory safety if we change logic:
        // setTimeout(() => el.remove(), 1000);
    }

    updateUI() {
        const scoreEl = document.getElementById('score-display');
        const comboEl = document.getElementById('combo-display');

        if (scoreEl) scoreEl.innerText = `SCORE: ${this.stats.score.toString().padStart(7, '0')}`;
        if (comboEl) {
            comboEl.innerText = `${this.stats.combo} COMBO`;
            comboEl.style.opacity = this.stats.combo > 2 ? 1 : 0;

            // Pop effect - Using setProperty to override CSS !important
            comboEl.style.setProperty('transform', 'translate(-50%, -50%) scale(0.6)', 'important');
            setTimeout(() => {
                comboEl.style.setProperty('transform', 'translate(-50%, -50%) scale(0.5)', 'important');
            }, 50);
        }
    }

    calculateGrade(totalNotes) {
        if (totalNotes === 0) return 'F';

        // Calculate accuracy based on hits vs total
        const totalHits = this.stats.perfect + this.stats.great + this.stats.good;
        const accuracy = (totalHits / totalNotes) * 100;

        // Determine grade
        if (accuracy >= 95) return 'S';
        if (accuracy >= 85) return 'A';
        if (accuracy >= 75) return 'B';
        if (accuracy >= 65) return 'C';
        if (accuracy >= 50) return 'D';
        return 'F';
    }

    getAccuracy(totalNotes) {
        if (totalNotes === 0) return 0;
        const totalHits = this.stats.perfect + this.stats.great + this.stats.good;
        return ((totalHits / totalNotes) * 100).toFixed(1);
    }

    reset() {
        this.stats = {
            perfect: 0,
            great: 0,
            good: 0,
            miss: 0,
            combo: 0,
            maxCombo: 0,
            score: 0
        };
    }
}

import { CONFIG } from './CONFIG.js';

export class Input {
    constructor() {
        this.keys = new Map(); // Store key states (code -> boolean)
        this.handlers = [];    // List of functions to call on key press

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onKeyDown(e) {
        if (e.repeat) return; // Ignore hold-down repeats

        // Check if it's a valid game key
        const laneIndex = CONFIG.KEYS.indexOf(e.code);
        if (laneIndex !== -1) {
            this.keys.set(e.code, true);
            this.trigger(laneIndex, 'down', performance.now()); // Fallback time w/o AudioContext
        }
    }

    onKeyUp(e) {
        const laneIndex = CONFIG.KEYS.indexOf(e.code);
        if (laneIndex !== -1) {
            this.keys.set(e.code, false);
            this.trigger(laneIndex, 'up', performance.now());
        }
    }

    // Register a callback: (laneIndex, action, time) => {}
    addClass(callback) {
        this.handlers.push(callback);
    }

    trigger(laneIndex, action, time) {
        this.handlers.forEach(h => h(laneIndex, action, time));
    }
}

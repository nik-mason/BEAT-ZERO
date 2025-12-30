import { CONFIG } from './CONFIG.js';

export class Input {
    constructor() {
        this.keys = new Map(); // Store key states (code -> boolean)
        this.handlers = new Map(); // Use Map for named handlers (20+ bug fix: prevent wiping)

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onKeyDown(e) {
        if (e.repeat) return; // Ignore hold-down repeats

        // Check if it's a valid game key
        const laneIndex = CONFIG.KEYS.indexOf(e.code);
        if (laneIndex !== -1) {
            e.preventDefault(); // Prevent scrolling/default actions
            this.keys.set(e.code, true);
            this.trigger(laneIndex, 'down', performance.now()); // Fallback time w/o AudioContext
        }
    }

    onKeyUp(e) {
        const laneIndex = CONFIG.KEYS.indexOf(e.code);
        if (laneIndex !== -1) {
            e.preventDefault();
            this.keys.set(e.code, false);
            this.trigger(laneIndex, 'up', performance.now());
        }
    }

    // Register a callback: (laneIndex, action, time) => {}
    addClass(callback, name = `handler_${Date.now()}_${Math.random()}`) {
        this.handlers.set(name, callback);
        return name;
    }

    // Remove specific handler (audit-fix)
    removeHandler(name) {
        this.handlers.delete(name);
    }

    // Clear only anonymous or specific handlers if needed (safety guard)
    clearHandlers() {
        this.handlers.clear();
    }

    trigger(laneIndex, action, time) {
        this.handlers.forEach(h => h(laneIndex, action, time));
    }
}

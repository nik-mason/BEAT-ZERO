export class Timer {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.startTime = 0;
        this.isRunning = false;
        this.source = null;

        // Handle auto-suspend policy (Chrome)
        if (this.ctx.state === 'suspended') {
            window.addEventListener('click', () => {
                this.ctx.resume();
            }, { once: true });
            window.addEventListener('keydown', () => {
                this.ctx.resume();
            }, { once: true });
        }
    }

    play(buffer) {
        if (this.ctx.state === 'suspended') this.ctx.resume();

        if (this.source) {
            this.source.stop();
            this.source.disconnect();
            this.source = null;
        }

        if (buffer) {
            this.source = this.ctx.createBufferSource();
            this.source.buffer = buffer;
            this.source.connect(this.ctx.destination);
            this.source.start(0);
        }

        this.startTime = this.ctx.currentTime;
        this.isRunning = true;
    }

    start() {
        // Fallback if no audio buffer provided (manual start)
        // This method now effectively just starts the timer without playing audio.
        // The play(null) call ensures the context is resumed and timer variables are set.
        this.play(null);
    }

    // Returns current time in milliseconds
    getTime() {
        if (!this.isRunning) return 0;
        return (this.ctx.currentTime - this.startTime) * 1000;
    }

    // For sync adjustments later
    setTime(ms) {
        this.startTime = this.ctx.currentTime - (ms / 1000);
    }
}

export class Timer {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.startTime = 0;
        this.isRunning = false;
        this.source = null;

        // Auto-unlock via global events (Idempotent)
        if (!Timer._listenersAttached) {
            const unlock = () => {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
            };
            window.addEventListener('click', unlock, { once: true });
            window.addEventListener('touchstart', unlock, { once: true });
            window.addEventListener('keydown', unlock, { once: true });
            Timer._listenersAttached = true;
        }
    }
    static _listenersAttached = false;

    /**
     * 명시적인 사용자 제스처 컨텍스트에서 오디오를 잠금 해제합니다.
     * iOS Safari 대응을 위해 비동기 작업(fetch/decode) 전에 호출되어야 합니다.
     */
    async unlock() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // 아주 짧은 무음 재생으로 엔진 웜업 (iOS 대응)
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
        console.log("🔊 AudioContext Unlocked & Warmed up");
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
        this.play(null);
    }

    stop() {
        if (this.source) {
            this.source.stop();
            this.source.disconnect();
            this.source = null;
        }
        this.isRunning = false;
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

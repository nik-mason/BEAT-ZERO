export class LayoutEditor {
    static initialized = false;

    constructor() {
        if (LayoutEditor.initialized) {
            console.warn("LayoutEditor already initialized. Skipping global events.");
            return;
        }
        LayoutEditor.initialized = true;

        console.log("LayoutEditor Initialized - F2 to edit (SHIFT+E during game)");
        this.isEditing = false;
        this.username = null;
        this.settings = {};

        // History for Undo/Redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 10; // Tighten memory even more

        // Configurable Elements
        // Configurable Elements - Removed combo and judgment to lock them to center
        this.targetIds = ['score-display', 'fps-display', 'lane-effect-0', 'lane-effect-1', 'lane-effect-2', 'lane-effect-3'];

        // State for dragging/rotating/resizing
        this.activeAction = null;
        this.draggedEl = null;
        this.startX = 0;
        this.startY = 0;
        this.initialPos = { x: 0, y: 0, scale: 1, rotate: 0 };

        // Snapping config
        this.snapThreshold = 15;

        // Bind events
        document.addEventListener('keydown', (e) => this.onKeyDown(e), true);
        document.addEventListener('mousedown', (e) => this.onMouseDown(e), true);
        document.addEventListener('mousemove', (e) => this.onMouseMove(e), true);
        document.addEventListener('mouseup', (e) => this.onMouseUp(e), true);
        document.addEventListener('wheel', (e) => this.onWheel(e), { passive: false, capture: true });

        this.initStyles();
    }

    initStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            .ui-edit-mode body {
                overflow: hidden !important;
            }
            .ui-edit-mode .ui-draggable {
                outline: 2px dashed rgba(0, 255, 255, 0.5) !important;
                background: var(--liquid-bg) !important;
                backdrop-filter: var(--liquid-blur) !important;
                -webkit-backdrop-filter: var(--liquid-blur) !important;
                cursor: move !important;
                position: absolute !important;
                z-index: 20000 !important;
                pointer-events: auto !important;
                user-select: none !important;
                border: 1px solid var(--liquid-border) !important;
            }
            .ui-edit-mode .ui-draggable.active-drag {
                outline: 3px solid #ff00ff !important;
                background: rgba(255, 0, 255, 0.1) !important;
                box-shadow: 0 0 30px rgba(255, 0, 255, 0.3) !important;
            }
            
            /* Rotation Handle */
            .ui-edit-mode .ui-draggable .rotate-handle {
                position: absolute;
                top: -45px;
                left: 50%;
                width: 20px;
                height: 20px;
                background: #ff00ff;
                border: 2px solid #fff;
                border-radius: 50%;
                transform: translateX(-50%);
                cursor: crosshair !important;
                z-index: 20001;
                box-shadow: 0 0 10px rgba(255, 0, 255, 0.8);
            }
            .ui-edit-mode .ui-draggable .rotate-handle::after {
                content: '';
                position: absolute;
                top: 20px;
                left: 50%;
                width: 2px;
                height: 25px;
                background: #ff00ff;
                transform: translateX(-50%);
            }

            /* Resize Handles */
            .ui-edit-mode .ui-draggable .resize-handle {
                position: absolute;
                width: 14px;
                height: 14px;
                background: #fff;
                border: 2px solid #ff00ff;
                z-index: 20001;
                border-radius: 2px;
                box-shadow: 0 0 5px rgba(0,0,0,0.5);
            }
            .resize-nw { top: -7px; left: -7px; cursor: nw-resize !important; }
            .resize-ne { top: -7px; right: -7px; cursor: ne-resize !important; }
            .resize-sw { bottom: -7px; left: -7px; cursor: sw-resize !important; }
            .resize-se { bottom: -7px; right: -7px; cursor: se-resize !important; }

            .ui-edit-overlay {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                border: 6px solid #ff00ff;
                pointer-events: none; 
                z-index: 10000;
                display: none;
                box-sizing: border-box;
                background: rgba(0, 0, 0, 0.3);
            }
            .ui-edit-overlay::after {
                content: 'UI EDIT MODE (SHIFT/F2 to Exit | Drag Corners to Resize | Ctrl+Z Undo)';
                position: absolute;
                top: 30px; left: 50%;
                transform: translateX(-50%);
                background: var(--liquid-bg);
                backdrop-filter: var(--liquid-blur);
                -webkit-backdrop-filter: var(--liquid-blur);
                border: 1px solid var(--liquid-border);
                color: #fff;
                padding: 12px 30px;
                font-family: var(--font-heading);
                font-weight: bold;
                font-size: 18px;
                border-radius: 50px;
                box-shadow: 0 0 30px rgba(255, 0, 255, 0.4);
                pointer-events: auto;
            }
            
            .snap-line {
                position: fixed;
                background: #ff00ff;
                z-index: 15000;
                display: none;
                pointer-events: none;
            }
            .snap-v { width: 1px; height: 100%; top: 0; }
            .snap-h { height: 1px; width: 100%; left: 0; }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.className = 'ui-edit-overlay';
        overlay.id = 'ui-edit-overlay';
        document.body.appendChild(overlay);

        const vSnap = document.createElement('div');
        vSnap.className = 'snap-line snap-v';
        vSnap.id = 'snap-v';
        document.body.appendChild(vSnap);

        const hSnap = document.createElement('div');
        hSnap.className = 'snap-line snap-h';
        hSnap.id = 'snap-h';
        document.body.appendChild(hSnap);
    }

    setUsername(user) {
        this.username = user;
        if (user) this.loadSettings();
    }

    async loadSettings() {
        if (!this.username) return;
        try {
            const res = await fetch(`/api/get_settings?username=${this.username}`);
            const data = await res.json();
            if (data && data.layout) {
                this.settings = data.layout;
                this.applySettings();
            }
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    }

    applySettings(source = this.settings) {
        Object.keys(source).forEach(id => {
            const el = document.getElementById(id) || document.querySelector(`.${id}`);
            const conf = source[id];
            if (el && conf) {
                el.style.position = 'absolute';
                if (conf.left) el.style.left = conf.left;
                if (conf.top) el.style.top = conf.top;

                const scale = conf.scale || 1;
                const rotate = conf.rotate || 0;
                this.updateTransform(el, scale, rotate);
                el.dataset.scale = scale;
                el.dataset.rotate = rotate;
            }
        });
    }

    toggleEditMode() {
        this.isEditing = !this.isEditing;
        const overlay = document.getElementById('ui-edit-overlay');

        if (this.isEditing) {
            document.body.classList.add('ui-edit-mode');
            overlay.style.display = 'block';
            this.enableDraggables();
            if (window.game) window.game.pause(true);
        } else {
            document.body.classList.remove('ui-edit-mode');
            overlay.style.display = 'none';
            this.removeHandles();
            this.hideSnapLines();
            this.saveSettings();
            if (window.game) window.game.resume();
        }
    }

    enableDraggables() {
        [...this.targetIds, 'key-hint-container'].forEach(id => {
            const el = document.getElementById(id) || document.querySelector(`.${id}`);
            if (el) {
                el.classList.add('ui-draggable');
                this.addHandles(el);
            }
        });
    }

    addHandles(el) {
        if (el.querySelector('.rotate-handle')) return;

        const rh = document.createElement('div');
        rh.className = 'rotate-handle';
        el.appendChild(rh);

        ['nw', 'ne', 'sw', 'se'].forEach(pos => {
            const h = document.createElement('div');
            h.className = `resize-handle resize-${pos}`;
            h.dataset.handle = pos;
            el.appendChild(h);
        });
    }

    removeHandles() {
        document.querySelectorAll('.rotate-handle, .resize-handle').forEach(h => h.remove());
        document.querySelectorAll('.active-drag').forEach(el => el.classList.remove('active-drag'));
    }

    saveToHistory() {
        const state = {};
        [...this.targetIds, 'key-hint-container'].forEach(id => {
            const el = document.getElementById(id) || document.querySelector(`.${id}`);
            if (el) {
                state[id] = {
                    left: el.style.left,
                    top: el.style.top,
                    scale: el.dataset.scale || 1,
                    rotate: el.dataset.rotate || 0
                };
            }
        });
        this.undoStack.push(JSON.stringify(state));
        if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length < 2) return;
        const currentState = this.undoStack.pop();
        this.redoStack.push(currentState);
        const prevState = JSON.parse(this.undoStack[this.undoStack.length - 1]);
        this.applySettings(prevState);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const stateStr = this.redoStack.pop();
        this.undoStack.push(stateStr);
        this.applySettings(JSON.parse(stateStr));
    }

    onKeyDown(e) {
        // Toggle keys: F2 (always) or SHIFT+E (during gameplay)
        const isToggleKey = (e.code === 'F2' || (e.shiftKey && e.code === 'KeyE') || (e.code === 'Escape' && this.isEditing));

        if (isToggleKey) {
            // Only stop propagation if we're actually going to handle it
            // Guests can edit layout too now for better UX (persistence still requires login)
            e.stopPropagation();
            if (!this.isEditing) this.saveToHistory();
            this.toggleEditMode();
            return;
        }

        if (!this.isEditing) return;
        e.stopPropagation();

        if (e.ctrlKey && e.code === 'KeyZ') { e.preventDefault(); this.undo(); }
        if (e.ctrlKey && e.code === 'KeyY') { e.preventDefault(); this.redo(); }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            const selected = document.querySelector('.active-drag') || document.querySelector('.ui-draggable:hover');
            if (selected) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                let left = parseFloat(selected.style.left) || 0;
                let top = parseFloat(selected.style.top) || 0;
                if (e.code === 'ArrowUp') top -= step;
                if (e.code === 'ArrowDown') top += step;
                if (e.code === 'ArrowLeft') left -= step;
                if (e.code === 'ArrowRight') left += step;
                selected.style.left = `${left}px`;
                selected.style.top = `${top}px`;
                this.saveToHistory();
            }
        }
    }

    onMouseDown(e) {
        if (!this.isEditing) return;

        const handle = e.target.closest('.resize-handle');
        const rotate = e.target.closest('.rotate-handle');
        const draggable = e.target.closest('.ui-draggable');

        if (handle || rotate || draggable) {
            e.stopPropagation();
            const el = handle ? handle.parentElement : (rotate ? rotate.parentElement : draggable);

            // Interaction visual feedback
            document.querySelectorAll('.active-drag').forEach(item => item.classList.remove('active-drag'));
            el.classList.add('active-drag');

            this.draggedEl = el;
            this.startX = e.clientX;
            this.startY = e.clientY;

            this.initialPos = {
                x: parseFloat(el.style.left) || el.offsetLeft || 0,
                y: parseFloat(el.style.top) || el.offsetTop || 0,
                scale: parseFloat(el.dataset.scale) || 1,
                rotate: parseFloat(el.dataset.rotate) || 0
            };

            if (handle) {
                this.activeAction = 'resize';
            } else if (rotate) {
                this.activeAction = 'rotate';
            } else {
                this.activeAction = 'drag';
            }
            e.preventDefault();
        } else {
            // Clicking background: Deselect
            document.querySelectorAll('.active-drag').forEach(item => item.classList.remove('active-drag'));

            // CRITICAL: Block all clicks that are on top of menus or UI elements to prevent "click-through" to the game canvas
            const isMenuOrUI = e.target.closest('button') ||
                e.target.closest('input') ||
                e.target.closest('select') ||
                e.target.closest('textarea') ||
                e.target.closest('#pause-menu') ||
                e.target.closest('#result-screen') ||
                e.target.closest('#settings-tab') ||
                e.target.closest('#settings-modal') ||
                e.target.closest('#main-menu') ||
                e.target.closest('#login-modal') ||
                e.target.closest('#rankings-modal') ||
                e.target.closest('#song-editor-modal') ||
                e.target.closest('.liquid-glass');

            if (isMenuOrUI) {
                // If it's UI, let it pass through the capture phase so the element receives the event
                return;
            } else {
                // Background click in edit mode: block propagation to prevent game canvas interaction
                e.stopPropagation();
            }
        }
    }

    onMouseMove(e) {
        if (!this.isEditing || !this.draggedEl) return;
        e.stopPropagation();

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        if (this.activeAction === 'drag') {
            let tx = this.initialPos.x + dx;
            let ty = this.initialPos.y + dy;

            const snap = this.calculateSnap(tx, ty, this.draggedEl);
            this.draggedEl.style.left = `${snap.x}px`;
            this.draggedEl.style.top = `${snap.y}px`;
        }
        else if (this.activeAction === 'rotate') {
            const rect = this.draggedEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI) + 90;
            const snappedAngle = Math.round(angle / 5) * 5;
            this.draggedEl.dataset.rotate = snappedAngle;
            this.updateTransform(this.draggedEl, this.draggedEl.dataset.scale, snappedAngle);
        }
        else if (this.activeAction === 'resize') {
            const rect = this.draggedEl.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            const iDist = Math.hypot(this.startX - cx, this.startY - cy);
            const cDist = Math.hypot(e.clientX - cx, e.clientY - cy);

            let scale = this.initialPos.scale * (cDist / iDist);
            scale = Math.max(0.1, Math.min(5.0, scale));

            this.draggedEl.dataset.scale = Math.round(scale * 100) / 100;
            this.updateTransform(this.draggedEl, scale, this.draggedEl.dataset.rotate);
        }
    }

    onMouseUp(e) {
        if (!this.isEditing) return;
        if (this.draggedEl) {
            e.stopPropagation();
            this.saveToHistory();
            this.hideSnapLines();
            this.draggedEl = null;
            this.activeAction = null;
        }
    }

    onWheel(e) {
        if (!this.isEditing) return;
        e.stopPropagation();
        const el = e.target.closest('.ui-draggable');
        if (el) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            let scale = parseFloat(el.dataset.scale) || 1;
            scale = Math.max(0.1, Math.min(5.0, scale + delta));
            el.dataset.scale = scale;
            this.updateTransform(el, scale, el.dataset.rotate);
            this.saveToHistory();
        }
    }

    updateTransform(el, scale = 1, rotate = 0) {
        el.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
    }

    calculateSnap(x, y, el) {
        const rect = el.getBoundingClientRect();
        const parent = el.offsetParent || document.body;
        const pw = parent.clientWidth;
        const ph = parent.clientHeight;

        let sx = x, sy = y;
        let showV = false, showH = false;

        // Snap horizontally (center)
        const elCX = x + rect.width / 2;
        if (Math.abs(elCX - pw / 2) < this.snapThreshold) {
            sx = pw / 2 - rect.width / 2;
            showV = true;
            document.getElementById('snap-v').style.left = `${parent.getBoundingClientRect().left + pw / 2}px`;
        }

        // Snap vertically (center)
        const elCY = y + rect.height / 2;
        if (Math.abs(elCY - ph / 2) < this.snapThreshold) {
            sy = ph / 2 - rect.height / 2;
            showH = true;
            document.getElementById('snap-h').style.top = `${parent.getBoundingClientRect().top + ph / 2}px`;
        }

        document.getElementById('snap-v').style.display = showV ? 'block' : 'none';
        document.getElementById('snap-h').style.display = showH ? 'block' : 'none';
        return { x: sx, y: sy };
    }

    hideSnapLines() {
        if (document.getElementById('snap-v')) document.getElementById('snap-v').style.display = 'none';
        if (document.getElementById('snap-h')) document.getElementById('snap-h').style.display = 'none';
    }

    async saveSettings() {
        if (!this.username) return;
        const settings = {};
        [...this.targetIds, 'key-hint-container'].forEach(id => {
            const el = document.getElementById(id) || document.querySelector(`.${id}`);
            if (el) {
                settings[id] = {
                    left: el.style.left,
                    top: el.style.top,
                    scale: parseFloat(el.dataset.scale) || 1,
                    rotate: parseFloat(el.dataset.rotate) || 0
                };
            }
        });

        try {
            await fetch('/api/save_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.username, settings: { layout: settings } })
            });
            console.log("Layout saved!");
        } catch (e) {
            console.error("Failed to save layout", e);
        }
    }
}

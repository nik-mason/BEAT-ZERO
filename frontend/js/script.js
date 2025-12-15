import { Game } from './Game.js';

window.addEventListener('DOMContentLoaded', () => {
    // Prevent default browser shortcuts that might interfere (like Ctrl+F)
    // window.addEventListener('keydown', (e) => {
    //     if(['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
    //         e.preventDefault();
    //     }
    // });

    // Start Game
    const game = new Game();
    window.game = game; // Expose for debugging
});

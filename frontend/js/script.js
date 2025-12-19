import { Game } from './Game.js';

window.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Game Engine (Canvas, Input, etc)
    const game = new Game();
    window.game = game;

    // 2. Load Song Data
    try {
        const response = await fetch(`assets/chart.json?t=${Date.now()}`);
        const songData = await response.json();

        // 3. UI Elements
        const songList = document.getElementById('song-list');
        const mainMenu = document.getElementById('main-menu');
        const gameContainer = document.getElementById('game-container');

        // 4. Create UI Items
        // Ensure data is array
        const songs = Array.isArray(songData) ? songData : [songData];

        songs.forEach(song => {
            const item = document.createElement('div');
            item.className = 'song-item';

            item.innerHTML = `
                <div class="song-info">
                    <h2>${song.name || 'Unknown Song'}</h2>
                    <p>FILE: ${song.filename || 'Unknown'}</p>
                </div>
                <div class="song-difficulty">
                    ${song.difficulty || 'NORMAL'}
                </div>
            `;

            // 5. Click Handler
            item.addEventListener('click', () => {
                console.log(`Starting song: ${song.name}`);

                mainMenu.style.display = 'none';
                gameContainer.style.display = 'flex';

                game.resize(); // Ensure size is correct after becoming visible
                game.start(song);
            });

            songList.appendChild(item);
        });

    } catch (e) {
        console.error("Failed to load song list:", e);
        if (document.getElementById('song-list')) {
            document.getElementById('song-list').innerHTML = `<p style="color:red">Error loading songs</p>`;
        }
    }

    // 6. Back Button Logic
    const backBtn = document.getElementById('back-btn');
    backBtn.addEventListener('click', () => {
        game.stop();
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('main-menu').style.display = 'flex';
    });
});

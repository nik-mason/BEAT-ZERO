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

        // 4.1 Tracking for Fever Mode
        const songStartCounts = {};
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
                const songId = song.name || song.filename;
                songStartCounts[songId] = (songStartCounts[songId] || 0) + 1;
                console.log(`🎵 Starting song: ${song.name} (${songStartCounts[songId]}/3)`);

                if (songStartCounts[songId] >= 3) {
                    game.feverMode = true;
                    console.log("🔥 FEVER MODE READY!");
                } else {
                    game.feverMode = false;
                }

                mainMenu.style.display = 'none';
                gameContainer.style.display = 'flex';

                game.resize(); // Ensure size is correct after becoming visible
                game.start(song);
            });

            // 5.1 Invisible Mode Trigger (Difficulty Click)
            let diffClicks = 0;
            const diffEl = item.querySelector('.song-difficulty');
            if (diffEl) {
                diffEl.addEventListener('click', (e) => {
                    e.stopPropagation(); // Don't start the song
                    diffClicks++;
                    console.log(`🕵️ Difficulty clicked: ${diffClicks}/5`);

                    if (diffClicks >= 5) {
                        game.invisibleMode = !game.invisibleMode;
                        console.log(game.invisibleMode ? "👁️ INVISIBLE MODE ACTIVATED" : "👀 INVISIBLE MODE DEACTIVATED");
                        diffClicks = 0;

                        // Small visual feedback
                        diffEl.style.color = game.invisibleMode ? '#ff00ff' : '#00ffff';
                        diffEl.style.textShadow = game.invisibleMode ? '0 0 10px #ff00ff' : '0 0 10px #00ffff';
                    }
                });
            }

            songList.appendChild(item);
        });

        // 5.1 Mirror Mode Easter Egg
        const title = document.querySelector('#main-menu h1');
        if (title) {
            title.addEventListener('click', () => {
                document.body.classList.toggle('mirror-mode');
                const isMirror = document.body.classList.contains('mirror-mode');
                console.log(isMirror ? "🪞 MIRROR MODE ACTIVATED" : "🔄 NORMAL MODE RESTORED");
            });
        }

    } catch (e) {
        console.error("Failed to load song list:", e);
        if (document.getElementById('song-list')) {
            document.getElementById('song-list').innerHTML = `<p style="color:red">Error loading songs</p>`;
        }
    }

    // 6. Mobile Pause Button
    const pauseBtnMobile = document.getElementById('pause-btn-mobile');
    pauseBtnMobile.addEventListener('click', () => {
        if (game.isPaused) {
            game.resume();
        } else if (game.timer.isRunning) {
            game.pause();
        }
    });

    // 7. ESC Key Handler (Pause)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
            e.preventDefault();
            if (game.isPaused) {
                game.resume();
            } else if (game.timer.isRunning) {
                game.pause();
            }
        }
    });

    // 8. Pause Menu Buttons
    const resumeBtn = document.getElementById('resume-btn');
    const quitBtn = document.getElementById('quit-btn');

    resumeBtn.addEventListener('click', () => {
        game.resume();
    });

    quitBtn.addEventListener('click', () => {
        game.stop();
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('main-menu').style.display = 'flex';
    });

    // 9. Result Screen Return Button
    const resultReturnBtn = document.getElementById('result-return-btn');
    resultReturnBtn.addEventListener('click', () => {
        game.stop();
        document.getElementById('result-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('main-menu').style.display = 'flex';
    });
});

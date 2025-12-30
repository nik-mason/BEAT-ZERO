import { Game } from './Game.js';
import { CONFIG } from './core/CONFIG.js';
import { LayoutEditor } from './systems/LayoutEditor.js';

window.addEventListener('DOMContentLoaded', async () => {
    // 1. New Helper Constants/Functions for Difficulty (Accessible to all logic)
    const DIFF_LEVELS = ['EASY', 'NORMAL', 'NORMAL+', 'HARD', 'HARD+', 'HARD++', 'HELL', 'MASTER', 'IMPOSSIBLE'];
    const getDiffClass = (diff) => {
        if (!diff) return 'normal';
        const d = diff.toUpperCase().trim();
        if (d.includes('EASY')) return 'easy';
        if (d.includes('NORMAL')) return 'normal';
        if (d.includes('HARD')) return 'hard';
        if (d.includes('HELL')) return 'hell';
        if (d.includes('MASTER')) return 'master';
        if (d.includes('IMPOSSIBLE')) return 'impossible';
        return 'normal';
    };

    // 2. Initialize Game Engine (Canvas, Input, etc)
    const game = new Game();
    window.game = game;

    // Initialize Layout Editor
    const layoutEditor = new LayoutEditor();
    window.layoutEditor = layoutEditor;

    // --- In-Game Key Hints ---
    const updateKeyHints = () => {
        const keyHintContainer = document.querySelector('.key-hint-container');
        if (!keyHintContainer) return;

        keyHintContainer.innerHTML = '';
        const keyElements = [];
        CONFIG.KEYS.forEach((code, i) => {
            const keyBox = document.createElement('div');
            keyBox.className = 'key-hint-box';
            keyBox.innerText = code.replace('Key', '').replace('Digit', '');
            keyHintContainer.appendChild(keyBox);
            keyElements.push(keyBox);
        });

        // Audit Fix: Only remove the previous hint handler to avoid breaking game logic
        if (window.keyHintHandlerName) {
            game.input.removeHandler(window.keyHintHandlerName);
        }
        window.keyHintHandlerName = game.input.addClass((lane, action) => {
            if (keyElements[lane]) {
                if (action === 'down') keyElements[lane].classList.add('active');
                if (action === 'up') keyElements[lane].classList.remove('active');
            }
        }, 'ui_key_hints');
    };

    // Initial setup
    updateKeyHints();
    window.updateKeyHints = updateKeyHints; // Expose for settings change

    // 2. Load Song Data
    let songData = null;
    try {
        const response = await fetch(`assets/chart.json?t=${Date.now()}`);
        songData = await response.json();

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

            const tierClass = getDiffClass(song.difficulty || 'NORMAL');

            item.innerHTML = `
                <div class="song-info">
                    <h2>${song.name || 'Unknown Song'}</h2>
                    <p>FILE: ${song.filename || 'Unknown'}</p>
                </div>
                <div class="song-difficulty ${tierClass}">
                    ${song.difficulty || 'NORMAL'}
                </div>
            `;

            // 5. Click Handler (RESTRICTED)
            item.addEventListener('click', () => {
                // Ensure audio context is unlocked early (iOS)
                if (game.timer && game.timer.unlock) game.timer.unlock();

                if (typeof isLoggedIn !== 'undefined' && !isLoggedIn) {
                    const loginModal = document.getElementById('login-modal');
                    const loginStatusMsg = document.getElementById('login-status-msg');
                    if (loginModal) loginModal.style.display = 'flex';
                    if (loginStatusMsg) {
                        loginStatusMsg.innerText = "🔒 Please login to play.";
                        loginStatusMsg.className = 'cert-msg error';
                    }
                    return;
                }

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
        if (document.getElementById('song-list')) {
            document.getElementById('song-list').innerHTML = `<p style="color:red">Error loading songs</p>`;
        }
    }

    // 5.2 Search Filter Logic
    const searchInput = document.getElementById('song-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.song-item');
            items.forEach(item => {
                const text = item.innerText.toLowerCase();
                if (text.includes(term)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    // 6. Mobile Pause Button
    const pauseBtnMobile = document.getElementById('pause-btn-mobile');
    if (pauseBtnMobile) {
        pauseBtnMobile.addEventListener('click', () => {
            if (game.isPaused) {
                game.resume();
            } else if (game.timer.isRunning) {
                game.pause();
            }
        });
    }

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
    const goMainMenuBtn = document.getElementById('go-main-menu');

    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            game.resume();
        });
    }

    if (goMainMenuBtn) {
        goMainMenuBtn.addEventListener('click', () => {
            const pauseMenu = document.getElementById('pause-menu');
            const gameContainer = document.getElementById('game-container');
            if (game.timer.isRunning || game.isPaused) {
                showPopup("Quit to main menu? Progress lost.", "info", () => {
                    game.stop();
                    document.getElementById('settings-tab').classList.remove('active'); // Close popup
                    document.getElementById('hamburger-btn').classList.remove('active');
                    document.getElementById('pause-menu').style.display = 'none';
                    document.getElementById('game-container').style.display = 'none';
                    document.getElementById('main-menu').style.display = 'flex';
                });
            } else {
                // Not in game, just close
                document.getElementById('settings-tab').classList.remove('active');
                document.getElementById('hamburger-btn').classList.remove('active');
            }
        });
    }

    // 9. Result Screen Return Button
    const resultReturnBtn = document.getElementById('result-return-btn');
    if (resultReturnBtn) {
        resultReturnBtn.addEventListener('click', () => {
            game.stop();
            document.getElementById('result-screen').style.display = 'none';
            document.getElementById('game-container').style.display = 'none';
            document.getElementById('main-menu').style.display = 'flex';
        });
    }

    // 10. Settings Logic
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const settingsTab = document.getElementById('settings-tab');
    const settingsModal = document.getElementById('settings-modal');
    const openKeySettings = document.getElementById('open-key-settings');
    const closeSettingsModal = document.getElementById('close-settings-modal');
    const saveKeySettings = document.getElementById('save-key-settings');
    const keyButtons = [
        document.getElementById('key-btn-0'),
        document.getElementById('key-btn-1'),
        document.getElementById('key-btn-2'),
        document.getElementById('key-btn-3')
    ];

    // Toggle Sidebar
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsTab.classList.toggle('active');
        });
    }

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (settingsTab && !settingsTab.contains(e.target) && e.target !== hamburgerBtn) {
            settingsTab.classList.remove('active');
        }
    });

    // Open Modal
    if (openKeySettings) {
        openKeySettings.addEventListener('click', async () => {
            settingsTab.classList.remove('active');
            settingsModal.style.display = 'flex';
            // Initialize buttons with current keys
            const { CONFIG } = await import('./core/CONFIG.js');
            keyButtons.forEach((btn, i) => {
                if (btn) btn.innerText = CONFIG.KEYS[i].replace('Key', '');
            });
        });
    }

    // Close Modal
    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', () => {
            settingsModal.style.display = 'none';
            activeKeyBindingLane = -1;
        });
    }

    let activeKeyBindingLane = -1;

    keyButtons.forEach((btn, i) => {
        if (btn) {
            btn.addEventListener('click', () => {
                // Reset others
                keyButtons.forEach(b => b && b.classList.remove('waiting'));
                btn.classList.add('waiting');
                btn.innerText = 'PRESS ANY KEY...';
                activeKeyBindingLane = i;
            });
        }
    });

    window.addEventListener('keydown', async (e) => {
        if (activeKeyBindingLane === -1) return;

        const { CONFIG } = await import('./core/CONFIG.js');
        const lane = activeKeyBindingLane;
        const newKeyCode = e.code;

        // Visual feedback
        if (keyButtons[lane]) {
            keyButtons[lane].innerText = newKeyCode.replace('Key', '');
            keyButtons[lane].classList.remove('waiting');
        }

        // Temporarily store in a local working array or update CONFIG directly
        CONFIG.KEYS[lane] = newKeyCode;

        activeKeyBindingLane = -1;
    });

    if (saveKeySettings) {
        saveKeySettings.addEventListener('click', async () => {
            const { CONFIG } = await import('./core/CONFIG.js');
            localStorage.setItem('beatzero_keys', JSON.stringify(CONFIG.KEYS));
            settingsModal.style.display = 'none';
            console.log("💾 Keys saved:", CONFIG.KEYS);
            if (window.updateKeyHints) window.updateKeyHints(); // Sync UI hints immediately
        });
    }

    // 11. Login & Sign Up Access Logic
    const openLoginBtn = document.getElementById('open-login-modal');
    const loginModal = document.getElementById('login-modal');
    const closeLoginBtn = document.getElementById('close-login-modal');
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    const loginUserField = document.getElementById('login-username');
    const loginPassField = document.getElementById('login-password');
    const loginStatusMsg = document.getElementById('login-status-msg');

    const signupConfirmGroup = document.getElementById('signup-confirm-group');
    const signupConfirmField = document.getElementById('signup-confirm-password');
    const loginModalTitle = document.getElementById('login-modal-title');
    const loginToggleBtn = document.getElementById('login-toggle-btn');
    const loginToggleText = document.getElementById('login-toggle-text');

    const songEditorTab = document.getElementById('open-song-editor');

    let isLoggedIn = false;
    let currentUsername = '';
    let isSignupMode = false;

    // Report score for ranking
    game.onSongFinish = async (result) => {
        if (!isLoggedIn || !currentUsername) {
            console.log("ℹ️ Score not saved: Guest session.");
            return;
        }

        console.log("🏆 Reporting score for ranking:", result);
        try {
            const response = await fetch('/api/save_score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    song_name: result.songName,
                    username: currentUsername,
                    score: result.score,
                    accuracy: result.accuracy,
                    grade: result.grade
                })
            });
            if (response.ok) {
                console.log("✅ Score saved successfully!");
            } else {
                throw new Error("Save score failed on server");
            }
        } catch (err) {
            console.error("❌ Failed to save score:", err);
            // Non-intrusive alert on result screen? 
            // For now, let's just log it robustly for the 20+ fixes task.
        }
    };

    const toggleLoginMode = (signup) => {
        isSignupMode = signup;
        if (isSignupMode) {
            loginModalTitle.innerText = "Create Account";
            loginSubmitBtn.innerText = "SIGN UP";
            signupConfirmGroup.style.display = 'block';
            loginToggleText.innerText = "Already have an account?";
            loginToggleBtn.innerText = "Sign In";
        } else {
            loginModalTitle.innerText = "Login";
            loginSubmitBtn.innerText = "SIGN IN";
            signupConfirmGroup.style.display = 'none';
            loginToggleText.innerText = "Don't have an account?";
            loginToggleBtn.innerText = "Sign Up";
        }
        loginStatusMsg.innerText = '';
        loginStatusMsg.className = 'cert-msg';
    };

    if (loginToggleBtn) {
        loginToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleLoginMode(!isSignupMode);
        });
    }

    if (openLoginBtn) {
        openLoginBtn.addEventListener('click', () => {
            settingsTab.classList.remove('active');
            loginModal.style.display = 'flex';
            toggleLoginMode(false);
            loginUserField.value = '';
            loginPassField.value = '';
            if (signupConfirmField) signupConfirmField.value = '';
        });
    }

    if (closeLoginBtn) {
        closeLoginBtn.addEventListener('click', () => {
            loginModal.style.display = 'none';
        });
    }

    if (loginSubmitBtn) {
        loginSubmitBtn.addEventListener('click', async () => {
            const username = loginUserField.value.trim();
            const password = loginPassField.value.trim();
            const confirmPass = signupConfirmField ? signupConfirmField.value.trim() : '';

            if (!username || !password) {
                loginStatusMsg.innerText = "⚠️ Please enter ID and Password.";
                return;
            }

            if (isSignupMode) {
                if (password !== confirmPass) {
                    loginStatusMsg.innerText = "❌ Passwords do not match.";
                    loginStatusMsg.className = 'cert-msg error';
                    return;
                }

                try {
                    const response = await fetch('/api/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const result = await response.json();

                    if (result.status === 'success') {
                        loginStatusMsg.innerText = '✅ Account Created! Switching to Login...';
                        loginStatusMsg.className = 'cert-msg success';
                        setTimeout(() => toggleLoginMode(false), 2000);
                    } else {
                        loginStatusMsg.innerText = `❌ ${result.error || 'Signup failed.'}`;
                        loginStatusMsg.className = 'cert-msg error';
                    }
                } catch (err) {
                    loginStatusMsg.innerText = "❌ Server error.";
                }
                return;
            }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    isLoggedIn = true;
                    currentUsername = username;

                    // Initialize Layout Editor for this user
                    if (window.layoutEditor) {
                        window.layoutEditor.setUsername(currentUsername);
                    }

                    loginStatusMsg.innerText = '✅ Login Successful!';
                    loginStatusMsg.className = 'cert-msg success';

                    if (username === 'mason14') {
                        if (navBtnEditor) navBtnEditor.style.display = 'block';
                    }

                    openLoginBtn.innerHTML = '<i>🔓</i> Logged In';
                    openLoginBtn.style.pointerEvents = 'none';
                    openLoginBtn.style.opacity = '0.7';

                    setTimeout(() => {
                        loginModal.style.display = 'none';
                    }, 1500);
                } else {
                    loginStatusMsg.innerText = '❌ Invalid Credentials.';
                    loginStatusMsg.className = 'cert-msg error';
                    loginModal.querySelector('.settings-content').style.animation = 'none';
                    void loginModal.offsetWidth;
                    loginModal.querySelector('.settings-content').style.animation = 'hamburger-shake 0.1s 5 alternate';
                }
            } catch (err) {
                console.error("Login Error:", err);
                loginStatusMsg.innerText = "❌ Server error.";
            }
        });
    }

    // 11.5 Rankings Modal Logic
    const openRankingsBtn = document.getElementById('open-rankings');
    const rankingsModal = document.getElementById('rankings-modal');
    const closeRankingsBtn = document.getElementById('close-rankings-modal');
    const rankingsListContainer = document.getElementById('rankings-list-container');


    const updateRankingSongs = () => {
        const buttonsContainer = document.getElementById('ranking-song-buttons');
        if (!buttonsContainer) return;

        buttonsContainer.innerHTML = '';
        if (!songData) return;

        const songsList = Array.isArray(songData) ? songData : [songData];
        songsList.forEach((s, index) => {
            const btn = document.createElement('button');
            btn.className = 'ranking-song-btn';
            btn.innerText = s.name;
            if (index === 0) {
                btn.classList.add('active');
                fetchAndShowRankings(s.name);
            }

            btn.onclick = () => {
                document.querySelectorAll('.ranking-song-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                fetchAndShowRankings(s.name);
            };
            buttonsContainer.appendChild(btn);
        });
    };


    const fetchAndShowRankings = async (songName) => {
        if (!songName) {
            rankingsListContainer.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); margin-top: 20px;">Select a song to view rankings.</p>';
            return;
        }

        rankingsListContainer.innerHTML = '<p style="text-align: center; color: #00ffff; margin-top: 20px;">Loading rankings...</p>';

        try {
            const response = await fetch('/api/get_rankings');
            const data = await response.json();
            const songRankings = data[songName] || [];

            if (songRankings.length === 0) {
                rankingsListContainer.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); margin-top: 20px;">No rankings yet for this song. Be the first!</p>';
                return;
            }

            rankingsListContainer.innerHTML = songRankings.map((r, index) => `
                <div class="song-item ranking-item" style="cursor: default; padding: 10px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); animation: elastic-appear 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; animation-delay: ${index * 0.05}s; opacity: 0; transform: scale(0.8);">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-size: 1.2rem; font-weight: bold; color: ${index < 3 ? '#ffcc00' : '#ffffff'}; width: 40px;">#${index + 1}</span>
                        <div style="flex: 1;">
                            <h3 style="margin: 0; font-size: 1rem;">${r.username}</h3>
                            <span style="font-size: 0.8rem; color: rgba(255,255,255,0.5);">${r.date}</span>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.1rem; color: #00ffff; font-weight: bold;">${r.score.toString().padStart(7, '0')}</div>
                            <span style="font-size: 0.8rem; color: ${r.grade === 'S' ? '#ffcc00' : '#ffffff'}; font-weight: bold;">[${r.grade}]</span>
                            <span style="font-size: 0.8rem; color: rgba(255,255,255,0.7); margin-left: 5px;">${r.accuracy}%</span>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            rankingsListContainer.innerHTML = '<p style="text-align: center; color: #ff4444; margin-top: 20px;">Failed to load rankings.</p>';
        }
    };

    if (openRankingsBtn) {
        openRankingsBtn.addEventListener('click', () => {
            if (settingsTab) settingsTab.classList.remove('active');
            rankingsModal.style.display = 'flex';
            updateRankingSongs();
        });
    }



    // Top Navigation Logic
    const navBtnSongSelect = document.getElementById('nav-btn-song-select');
    const navBtnRankings = document.getElementById('nav-btn-rankings');
    const navBtnEditor = document.getElementById('nav-btn-editor');

    // Hide Editor Button by Default
    if (navBtnEditor) navBtnEditor.style.display = 'none';

    const viewSongSelect = document.getElementById('view-song-select');
    // const rankingsModal = document.getElementById('rankings-modal'); // Assuming no longer modal
    // const songEditorModal ...

    const updateTopNav = (activeId) => {
        // Handle Button States
        [navBtnSongSelect, navBtnRankings, navBtnEditor].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        const activeBtn = document.getElementById(activeId);
        if (activeBtn) activeBtn.classList.add('active');

        // Handle View Switching (Full Screen Tabs)
        const viewRankings = document.getElementById('view-rankings');
        const viewEditor = document.getElementById('view-editor');

        [viewSongSelect, viewRankings, viewEditor].forEach(v => {
            if (v) v.style.display = 'none';
        });

        if (activeId === 'nav-btn-song-select' && viewSongSelect) viewSongSelect.style.display = 'flex';
        if (activeId === 'nav-btn-rankings' && viewRankings) {
            viewRankings.style.display = 'flex';
            updateRankingSongs();
        }
        if (activeId === 'nav-btn-editor' && viewEditor) {
            viewEditor.style.display = 'flex';
            if (songData) {
                // Fix: Initialize editor data from global songData
                localSongData = JSON.parse(JSON.stringify(songData));
                renderSongListEditor();
            }
        }
    };

    if (navBtnSongSelect) {
        navBtnSongSelect.addEventListener('click', () => {
            updateTopNav('nav-btn-song-select');
        });
    }

    if (navBtnRankings) {
        navBtnRankings.addEventListener('click', () => {
            updateTopNav('nav-btn-rankings');
        });
    }

    // 12. Song Editor Logic (Admin Only)
    // 12. Song Editor Logic (Admin Only)
    // const songEditorModal = document.getElementById('song-editor-modal'); // Removed in favor of view-editor
    const closeSongEditor = document.getElementById('close-song-editor');
    const songEditorList = document.getElementById('song-editor-list');
    const songEditorListView = document.getElementById('song-editor-list-view');
    const songEditorDetailView = document.getElementById('song-editor-detail-view');
    const addNewSongBtn = document.getElementById('add-new-song-btn');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const saveSongDetails = document.getElementById('save-song-details');
    const deleteSongBtn = document.getElementById('delete-song-btn');
    const saveAllSongsBtn = document.getElementById('save-all-songs');

    // Form inputs
    const editSongName = document.getElementById('edit-song-name');
    const editSongFile = document.getElementById('edit-song-file');
    const editDiffChips = document.getElementById('edit-diff-chips');
    const editSongTimestamps = document.getElementById('edit-song-timestamps');

    let localSongData = [];
    let currentEditingIndex = -1;

    const renderSongListEditor = () => {
        songEditorList.innerHTML = '';
        localSongData.forEach((song, index) => {
            const row = document.createElement('div');
            row.className = 'diff-edit-row';
            const tierClass = getDiffClass(song.difficulty || 'NORMAL');

            row.innerHTML = `
                <div class="diff-song-header">
                    <div class="diff-song-name">${song.name}</div>
                    <div class="diff-current-label">TIER: ${song.difficulty || 'NORMAL'}</div>
                </div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 5px;">
                    ${song.filename} • ${(song.timestamps || []).length} NOTES
                </div>
            `;

            row.style.cursor = 'pointer';
            row.onclick = () => openDetailView(index);
            songEditorList.appendChild(row);
        });
    };

    const openDetailView = (index) => {
        currentEditingIndex = index;
        const song = localSongData[index] || {};

        editSongName.value = song.name || '';
        editSongFile.value = song.filename || '';

        // Reverted to textarea value
        editSongTimestamps.value = (song.timestamps || []).join('\n');

        // Render Chips
        editDiffChips.innerHTML = '';
        DIFF_LEVELS.forEach(level => {
            const chip = document.createElement('div');
            chip.className = `diff-chip ${getDiffClass(level)} ${song.difficulty === level ? 'active' : ''}`;
            chip.innerText = level;
            chip.onclick = () => {
                editDiffChips.querySelectorAll('.diff-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            };
            editDiffChips.appendChild(chip);
        });

        // Toggle Views
        songEditorListView.style.display = 'none';
        songEditorDetailView.style.display = 'flex';
        songEditorDetailView.scrollTop = 0;
    };

    const closeDetailView = () => {
        songEditorDetailView.style.display = 'none';
        songEditorListView.style.display = 'flex';
        currentEditingIndex = -1;
    };

    // Make sure we bind the click event for opening the editor
    if (navBtnEditor) {
        navBtnEditor.addEventListener('click', (e) => {
            updateTopNav('nav-btn-editor');
            e.preventDefault();
            console.log("📝 Editor Nav Clicked");

            if (currentUsername === 'mason14') {
                // Open Modal
                rankingsModal.style.display = 'none';
                // songEditorModal.style.display = 'flex'; // Use full screen view logic instead
                updateTopNav('nav-btn-editor'); // This now handles data loading

                // Initialize Data if not already
                if (!localSongData || localSongData.length === 0) {
                    localSongData = JSON.parse(JSON.stringify(Array.isArray(songData) ? songData : [songData]));
                }
                renderSongListEditor();
                closeDetailView();
            } else {
                showPopup("🚫 Access Denied: Admin only.", "error");
                updateTopNav('nav-btn-song-select'); // Revert
            }
        });
    }

    // Custom Popup System
    window.showPopup = (message, type = 'info', confirmCallback = null) => {
        // Create popup elements dynamically
        const overlay = document.createElement('div');
        overlay.className = 'custom-popup-overlay';

        const popup = document.createElement('div');
        popup.className = `custom-popup ${type}`;

        const icon = type === 'error' ? '❌' : (type === 'success' ? '✅' : 'ℹ️');

        popup.innerHTML = `
            <div class="popup-icon">${icon}</div>
            <div class="popup-message">${message}</div>
            <div class="popup-actions">
                ${confirmCallback ? `<button class="popup-btn confirm">CONFIRM</button><button class="popup-btn cancel">CANCEL</button>` : `<button class="popup-btn close">OK</button>`}
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
            popup.classList.add('active');
        });

        const close = () => {
            overlay.classList.remove('active');
            popup.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        };

        if (confirmCallback) {
            popup.querySelector('.confirm').onclick = () => { confirmCallback(); close(); };
            popup.querySelector('.cancel').onclick = close;
        } else {
            popup.querySelector('.close').onclick = close;
        }
    };

    // Replace native alerts/confirms in Editor
    // Sidebar Navigation Logic
    const navEditorHome = document.getElementById('nav-editor-home');
    const navToMain = document.getElementById('nav-to-main');
    const navToRankings = document.getElementById('nav-to-rankings');

    const updateNavState = (activeId) => {
        [navEditorHome, navToMain, navToRankings].forEach(el => {
            if (el) el.classList.remove('active');
        });
        const activeEl = document.getElementById(activeId);
        if (activeEl) activeEl.classList.add('active');
    };

    if (navEditorHome) {
        navEditorHome.onclick = () => {
            updateNavState('nav-editor-home');
            // Already here
        };
    }

    if (navToMain) {
        navToMain.onclick = () => {
            updateTopNav('nav-btn-song-select');
        };
    }

    if (navToRankings) {
        navToRankings.onclick = () => {
            updateTopNav('nav-btn-rankings');
        };
    }

    if (closeSongEditor) {
        closeSongEditor.addEventListener('click', () => {
            updateTopNav('nav-btn-song-select');
        });
    }

    if (backToListBtn) {
        backToListBtn.addEventListener('click', closeDetailView);
    }

    if (addNewSongBtn) {
        addNewSongBtn.addEventListener('click', () => {
            const newSong = {
                name: "NEW SONG",
                filename: "song.mp3",
                difficulty: "NORMAL",
                timestamps: []
            };
            localSongData.push(newSong);
            openDetailView(localSongData.length - 1);
        });
    }

    if (saveSongDetails) {
        saveSongDetails.addEventListener('click', () => {
            if (currentEditingIndex === -1) return;

            const activeChip = editDiffChips.querySelector('.diff-chip.active');

            // Parsing textarea
            const timestampsArr = editSongTimestamps.value.split('\n')
                .map(t => parseFloat(t.trim()))
                .filter(t => !isNaN(t))
                .sort((a, b) => a - b);

            localSongData[currentEditingIndex] = {
                ...localSongData[currentEditingIndex],
                name: editSongName.value,
                filename: editSongFile.value,
                difficulty: activeChip ? activeChip.innerText : 'NORMAL',
                timestamps: timestampsArr
            };

            renderSongListEditor();
            closeDetailView();
        });
    }

    if (deleteSongBtn) {
        deleteSongBtn.addEventListener('click', () => {
            if (currentEditingIndex === -1) return;
            showPopup(`Delete '${localSongData[currentEditingIndex].name}'?`, "info", () => {
                localSongData.splice(currentEditingIndex, 1);
                renderSongListEditor();
                closeDetailView();
            });
        });
    }

    if (saveAllSongsBtn) {
        saveAllSongsBtn.addEventListener('click', async () => {
            saveAllSongsBtn.disabled = true;
            saveAllSongsBtn.innerText = 'SAVING TO SERVER...';

            try {
                const res = await fetch('/api/update_songs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        admin_user: currentUsername, // Secure check on server
                        songs: localSongData
                    })
                });

                if (res.ok) {
                    saveAllSongsBtn.innerText = '✅ ALL SONGS SYNCED!';
                    showPopup("✅ All songs saved to server!", "success");
                    // setTimeout(() => location.reload(), 1500); // Reload optional, maybe just stay
                    setTimeout(() => { saveAllSongsBtn.innerText = 'SAVE ALL & PUSH TO SERVER'; saveAllSongsBtn.disabled = false; }, 2000);
                } else {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "Failed to push updates");
                }
            } catch (err) {
                console.error("Save error:", err);
                showPopup("❌ Error saving: " + err.message, "error");
                saveAllSongsBtn.innerText = '❌ FAILED TO SAVE';
                saveAllSongsBtn.disabled = false;
            }
        });
    }

    // 13. Hamburger Easter Egg (15s Hover)
    let hamburgerTimer = null;
    const chaosFlash = document.createElement('div');
    chaosFlash.id = 'chaos-flash';
    document.body.appendChild(chaosFlash);

    const crtStatic = document.createElement('div');
    crtStatic.className = 'crt-static';
    document.body.appendChild(crtStatic);

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('mouseenter', () => {
            if (document.body.classList.contains('chaos-active')) return;

            console.log("🤫 Something is happening... keep hovering for 15s...");
            hamburgerBtn.classList.add('charging');

            hamburgerTimer = setTimeout(() => {
                console.log("🔥 CHAOS MODE ACTIVATED!!! 🔥");
                document.body.classList.add('chaos-active');
                chaosFlash.style.display = 'block';
                crtStatic.style.display = 'block';

                // Screen flash effect
                setTimeout(() => {
                    chaosFlash.style.display = 'none';
                }, 500);

                // Play a glitchy sound if possible
                if (window.game && window.game.playGlitchSound) {
                    window.game.playGlitchSound();
                }

                // After 10 seconds of chaos, revert to normal
                setTimeout(() => {
                    document.body.classList.remove('chaos-active');
                    crtStatic.style.display = 'none';
                    hamburgerBtn.classList.remove('charging');
                    console.log("✨ Balance restored.");
                }, 10000);

            }, 15000);
        });

        hamburgerBtn.addEventListener('mouseleave', () => {
            if (hamburgerTimer) {
                clearTimeout(hamburgerTimer);
                hamburgerTimer = null;
                if (!document.body.classList.contains('chaos-active')) {
                    hamburgerBtn.classList.remove('charging');
                    console.log("👀 The energy dissipated...");
                }
            }
        });
    }
});

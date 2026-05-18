/* ==========================================================================
   iOS 26 MODERN MEDIA CONTROLLER — APPLICATION ENGINE
   ========================================================================== */

(() => {
    'use strict';

    // ─── DOM References ──────────────────────────
    const audio = document.getElementById('audio-player');
    const btnPlay = document.getElementById('btn-play');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnShuffle = document.getElementById('btn-shuffle');
    const btnRepeat = document.getElementById('btn-repeat');
    const btnVolume = document.getElementById('btn-volume');
    const volumeRange = document.getElementById('volume-range');
    const volumeProgress = document.getElementById('volume-progress');
    const progressRange = document.getElementById('progress-range');
    const progressFill = document.getElementById('progress-fill');
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');
    const trackTitle = document.getElementById('track-title');
    const trackListEl = document.getElementById('track-list');
    const visualizerCanvas = document.getElementById('visualizer');
    const bgToggleBtn = document.getElementById('bg-toggle-btn');
    const bgPanel = document.getElementById('bg-panel');
    const bgPanelClose = document.getElementById('bg-panel-close');
    const bgList = document.getElementById('bg-list');
    const bgVideo = document.getElementById('bg-video');
    const bgImage = document.getElementById('bg-image');
    const bgOverlay = document.getElementById('bg-overlay');

    // ─── SVG Vector Icon Markup (No emojis) ──────
    const SVG_ICONS = {
        play: `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
        pause: `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
        repeat: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`,
        repeatOne: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path><text x="9" y="15" font-size="7" font-weight="bold" fill="currentColor" font-family="sans-serif">1</text></svg>`,
        volHigh: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
        volLow: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
        volMute: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
    };

    // ─── State Variables ─────────────────────────
    let tracks = [];
    let backgrounds = [];
    let currentTrackIndex = -1;
    let isPlaying = false;
    let isShuffle = false;
    let repeatMode = 0; // 0: No Repeat, 1: Repeat All, 2: Repeat One
    
    // Web Audio Analyzer Node
    let audioContext = null;
    let analyser = null;
    let source = null;
    let animFrameId = null;
    let sourceConnected = false;

    // ─── Initialization ──────────────────────────
    function init() {
        loadTracks();
        loadBackgrounds();
        setupEvents();
        setupVolumeSlider();
        drawIdleVisualizer();
    }

    // ─── Discover tracks from server directory ───
    function loadTracks() {
        fetch('music/')
            .then(r => r.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const links = doc.querySelectorAll('a');
                const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.webm'];

                tracks = [];
                links.forEach(link => {
                    const href = decodeURIComponent(link.getAttribute('href') || '');
                    const name = href.split('/').pop();
                    if (name && audioExtensions.some(ext => name.toLowerCase().endsWith(ext))) {
                        tracks.push({
                            name: name,
                            path: 'music/' + name,
                            displayName: name.replace(/\.[^/.]+$/, '')
                        });
                    }
                });
                renderTrackList();
            })
            .catch(() => {
                fetch('tracklist.json')
                    .then(r => r.json())
                    .then(data => {
                        tracks = data.map(name => ({
                            name: name,
                            path: 'music/' + name,
                            displayName: name.replace(/\.[^/.]+$/, '')
                        }));
                        renderTrackList();
                    })
                    .catch(() => {
                        renderTrackList();
                    });
            });
    }

    // ─── Discover wallpapers from server directory
    function loadBackgrounds() {
        fetch('zadni/')
            .then(r => r.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const links = doc.querySelectorAll('a');
                const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.avif'];
                const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

                backgrounds = [];
                links.forEach(link => {
                    const href = decodeURIComponent(link.getAttribute('href') || '');
                    const name = href.split('/').pop();
                    if (!name) return;
                    const lower = name.toLowerCase();

                    if (imageExts.some(ext => lower.endsWith(ext))) {
                        backgrounds.push({ name, path: 'zadni/' + name, type: 'image' });
                    } else if (videoExts.some(ext => lower.endsWith(ext))) {
                        backgrounds.push({ name, path: 'zadni/' + name, type: 'video' });
                    }
                });
                renderBackgrounds();
            })
            .catch(() => {
                fetch('bglist.json')
                    .then(r => r.json())
                    .then(data => {
                        const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
                        backgrounds = data.map(name => {
                            const lower = name.toLowerCase();
                            let type = 'image';
                            if (videoExts.some(ext => lower.endsWith(ext))) type = 'video';
                            return { name, path: 'zadni/' + name, type };
                        });
                        renderBackgrounds();
                    })
                    .catch(() => {
                        renderBackgrounds();
                    });
            });
    }

    // ─── Render dynamic track list ───────────────
    function renderTrackList() {
        if (tracks.length === 0) {
            trackListEl.innerHTML = '<li class="empty-msg">Добавь музыку в папку <code>music</code></li>';
            return;
        }

        trackListEl.innerHTML = tracks.map((track, i) => `
            <li data-index="${i}" id="track-item-${i}">
                <span class="track-number">${(i + 1).toString().padStart(2, '0')}</span>
                <span class="track-name">${track.displayName}</span>
                <span class="track-playing-indicator">
                    <span class="bar"></span>
                    <span class="bar"></span>
                    <span class="bar"></span>
                    <span class="bar"></span>
                </span>
            </li>
        `).join('');

        trackListEl.querySelectorAll('li[data-index]').forEach(li => {
            li.addEventListener('click', () => {
                const idx = parseInt(li.dataset.index);
                playTrack(idx);
            });
        });
    }

    // ─── Render dynamic wallpapers list ──────────
    function renderBackgrounds() {
        if (backgrounds.length === 0) {
            bgList.innerHTML = '<p class="empty-msg">Добавь файлы в папку <code>zadni</code></p>';
            return;
        }

        bgList.innerHTML = backgrounds.map((bg, i) => {
            const ext = bg.name.split('.').pop().toUpperCase();
            if (bg.type === 'video') {
                return `
                    <div class="bg-item" data-index="${i}" id="bg-item-${i}">
                        <video src="${bg.path}" muted preload="metadata"></video>
                        <span class="bg-type-badge">${ext}</span>
                        <span class="bg-label">${bg.name}</span>
                    </div>
                `;
            } else {
                return `
                    <div class="bg-item" data-index="${i}" id="bg-item-${i}">
                        <img src="${bg.path}" alt="${bg.name}" loading="lazy">
                        <span class="bg-type-badge">${ext}</span>
                        <span class="bg-label">${bg.name}</span>
                    </div>
                `;
            }
        }).join('');

        bgList.querySelectorAll('.bg-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                setBackground(idx);
            });
        });

        // Set the first background as default if present
        if (backgrounds.length > 0) {
            setBackground(0);
        }
    }

    // ─── Set active background ───────────────────
    function setBackground(index) {
        const bg = backgrounds[index];
        if (!bg) return;

        bgList.querySelectorAll('.bg-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.getElementById(`bg-item-${index}`);
        if (activeItem) activeItem.classList.add('active');

        if (bg.type === 'video') {
            bgImage.classList.remove('active');
            bgVideo.src = bg.path;
            bgVideo.classList.add('active');
            bgVideo.play().catch(() => {});
        } else {
            bgVideo.classList.remove('active');
            bgVideo.pause();
            bgImage.src = bg.path;
            bgImage.classList.add('active');
        }
    }

    // ─── Play Track ──────────────────────────────
    function playTrack(index) {
        if (index < 0 || index >= tracks.length) return;

        currentTrackIndex = index;
        const track = tracks[index];
        audio.src = track.path;
        audio.play().then(() => {
            isPlaying = true;
            btnPlay.innerHTML = SVG_ICONS.pause;
            trackTitle.textContent = track.displayName;
            highlightTrack(index);
            initAudioContext();
            startVisualizer();
        }).catch(err => {
            console.warn('Playback error:', err);
        });
    }

    // ─── Highlight active track item ─────────────
    function highlightTrack(index) {
        trackListEl.querySelectorAll('li').forEach(li => li.classList.remove('active'));
        const activeLi = document.querySelector(`#track-item-${index}`);
        if (activeLi) {
            activeLi.classList.add('active');
            activeLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // ─── Setup Volume Slider Custom State ────────
    function setupVolumeSlider() {
        audio.volume = 0.8;
        volumeRange.value = 80;
        updateVolumeUI();
    }

    function updateVolumeUI() {
        const val = volumeRange.value;
        volumeProgress.style.width = val + '%';
        const vol = val / 100;
        audio.volume = vol;

        if (vol === 0) {
            btnVolume.innerHTML = SVG_ICONS.volMute;
        } else if (vol < 0.5) {
            btnVolume.innerHTML = SVG_ICONS.volLow;
        } else {
            btnVolume.innerHTML = SVG_ICONS.volHigh;
        }
    }

    // ─── Event Listeners ─────────────────────────
    function setupEvents() {
        // Play / Pause
        btnPlay.addEventListener('click', togglePlay);

        // Previous / Next
        btnPrev.addEventListener('click', playPrev);
        btnNext.addEventListener('click', playNext);

        // Shuffle Toggle
        btnShuffle.addEventListener('click', () => {
            isShuffle = !isShuffle;
            btnShuffle.classList.toggle('active', isShuffle);
        });

        // Repeat Toggle Modes
        btnRepeat.addEventListener('click', () => {
            repeatMode = (repeatMode + 1) % 3;
            updateRepeatButton();
        });

        // Volume adjustment
        volumeRange.addEventListener('input', updateVolumeUI);

        // Mute / Unmute Toggle
        btnVolume.addEventListener('click', () => {
            if (audio.volume > 0) {
                audio.dataset.prevVolume = audio.volume;
                volumeRange.value = 0;
            } else {
                const prev = parseFloat(audio.dataset.prevVolume) || 0.8;
                volumeRange.value = prev * 100;
            }
            updateVolumeUI();
        });

        // Audio Progress range adjustment
        progressRange.addEventListener('input', () => {
            if (audio.duration) {
                audio.currentTime = (progressRange.value / 100) * audio.duration;
            }
        });

        // Time updates
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadedmetadata', () => {
            timeTotal.textContent = formatTime(audio.duration);
        });
        audio.addEventListener('ended', onTrackEnd);

        // Wallpaper selector panels
        bgToggleBtn.addEventListener('click', toggleBgPanel);
        bgPanelClose.addEventListener('click', closeBgPanel);
        bgOverlay.addEventListener('click', closeBgPanel);

        // Keyboard navigation shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (audio.duration) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    audio.currentTime = Math.max(audio.currentTime - 5, 0);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    volumeRange.value = Math.min(parseInt(volumeRange.value) + 5, 100);
                    updateVolumeUI();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    volumeRange.value = Math.max(parseInt(volumeRange.value) - 5, 0);
                    updateVolumeUI();
                    break;
            }
        });

        // Auto-scale Canvas Visualizer on Resize
        window.addEventListener('resize', () => {
            if (analyser && isPlaying) {
                // Let the next animation frame handle scaling
            } else {
                drawIdleVisualizer();
            }
        });
    }

    // ─── Play / Pause Toggle Action ─────────────
    function togglePlay() {
        if (tracks.length === 0) return;

        if (currentTrackIndex === -1) {
            playTrack(0);
            return;
        }

        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            btnPlay.innerHTML = SVG_ICONS.play;
        } else {
            audio.play().then(() => {
                isPlaying = true;
                btnPlay.innerHTML = SVG_ICONS.pause;
                initAudioContext();
                startVisualizer();
            }).catch(() => {});
        }
    }

    // ─── Previous & Next Actions ─────────────────
    function playPrev() {
        if (tracks.length === 0) return;
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        let idx = currentTrackIndex - 1;
        if (idx < 0) idx = tracks.length - 1;
        playTrack(idx);
    }

    function playNext() {
        if (tracks.length === 0) return;
        let idx;
        if (isShuffle) {
            idx = Math.floor(Math.random() * tracks.length);
            if (idx === currentTrackIndex && tracks.length > 1) {
                idx = (idx + 1) % tracks.length;
            }
        } else {
            idx = (currentTrackIndex + 1) % tracks.length;
        }
        playTrack(idx);
    }

    // ─── On Track Playback Finished ──────────────
    function onTrackEnd() {
        if (repeatMode === 2) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        } else if (repeatMode === 1 || currentTrackIndex < tracks.length - 1) {
            playNext();
        } else {
            isPlaying = false;
            btnPlay.innerHTML = SVG_ICONS.play;
        }
    }

    // ─── Update Repeat Button UI ─────────────────
    function updateRepeatButton() {
        switch (repeatMode) {
            case 0:
                btnRepeat.innerHTML = SVG_ICONS.repeat;
                btnRepeat.classList.remove('active');
                break;
            case 1:
                btnRepeat.innerHTML = SVG_ICONS.repeat;
                btnRepeat.classList.add('active');
                break;
            case 2:
                btnRepeat.innerHTML = SVG_ICONS.repeatOne;
                btnRepeat.classList.add('active');
                break;
        }
    }

    // ─── Timeline progress ───────────────────────
    function updateProgress() {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = pct + '%';
        progressRange.value = pct;
        timeCurrent.textContent = formatTime(audio.currentTime);
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // ─── Background Selectors Drawer ─────────────
    function toggleBgPanel() {
        const isOpen = !bgPanel.classList.contains('hidden');
        if (isOpen) {
            closeBgPanel();
        } else {
            bgPanel.classList.remove('hidden');
            bgOverlay.classList.remove('hidden');
        }
    }

    function closeBgPanel() {
        bgPanel.classList.add('hidden');
        bgOverlay.classList.add('hidden');
    }

    // ─── Advanced Web Audio API Engine ───────────
    function initAudioContext() {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.85;
        } catch (e) {
            console.warn('Web Audio API not supported on this browser context:', e);
        }
    }

    function connectSource() {
        if (sourceConnected || !audioContext || !analyser) return;
        try {
            source = audioContext.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            sourceConnected = true;
        } catch (e) {
            console.warn('Failed connecting audio stream source:', e);
        }
    }

    function startVisualizer() {
        if (!audioContext || !analyser) return;
        connectSource();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        if (!animFrameId) {
            drawVisualizer();
        }
    }

    // ─── Dynamic Glowing Wave Visualizer ─────────
    function drawVisualizer() {
        const canvas = visualizerCanvas;
        const ctx = canvas.getContext('2d');

        function draw() {
            animFrameId = requestAnimationFrame(draw);

            const W = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
            const H = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);

            if (!analyser) return;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, W, H);

            // Draw a high-end gorgeous symmetrical sine-wave visualizer
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';

            // Glow styling
            ctx.shadowBlur = 15;

            // Draw 3 layers of wave lines with varying transparencies & speeds for premium multi-depth feel
            for (let layer = 0; layer < 3; layer++) {
                const alpha = [0.65, 0.4, 0.15][layer];
                const scale = [1.0, 0.7, 0.4][layer];
                const shift = layer * 40;

                ctx.beginPath();
                
                // Color Gradient
                const gradient = ctx.createLinearGradient(0, 0, W, 0);
                gradient.addColorStop(0, `rgba(0, 198, 255, ${alpha})`);     // Blue
                gradient.addColorStop(0.5, `rgba(176, 106, 179, ${alpha})`); // Purple
                gradient.addColorStop(1, `rgba(249, 83, 198, ${alpha})`);   // Pink

                ctx.strokeStyle = gradient;
                ctx.shadowColor = `rgba(176, 106, 179, ${alpha * 0.5})`;

                for (let i = 0; i < W; i++) {
                    // Match X to frequency buffer data index
                    const dataIndex = Math.floor((i / W) * (bufferLength * 0.7));
                    const value = dataArray[dataIndex] / 255;
                    
                    // Bezier sin curve computation
                    const amplitude = value * (H * 0.35) * scale;
                    const frequency = 0.015;
                    const y = (H / 2) + Math.sin(i * frequency + Date.now() * 0.005 + shift) * amplitude;

                    if (i === 0) {
                        ctx.moveTo(i, y);
                    } else {
                        ctx.lineTo(i, y);
                    }
                }
                ctx.stroke();
            }
        }

        draw();
    }

    // ─── Idle Symmetrical Wave (No Audio Playing) 
    function drawIdleVisualizer() {
        const canvas = visualizerCanvas;
        const ctx = canvas.getContext('2d');
        const W = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
        const H = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, W, H);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;

        // Subtle glowing centered line
        const gradient = ctx.createLinearGradient(0, 0, W, 0);
        gradient.addColorStop(0, 'rgba(0, 198, 255, 0.35)');
        gradient.addColorStop(0.5, 'rgba(176, 106, 179, 0.35)');
        gradient.addColorStop(1, 'rgba(249, 83, 198, 0.35)');

        ctx.strokeStyle = gradient;
        ctx.shadowColor = 'rgba(176, 106, 179, 0.15)';

        ctx.beginPath();
        for (let i = 0; i < W; i++) {
            const y = (H / 2) + Math.sin(i * 0.015 + Date.now() * 0.001) * 3;
            if (i === 0) {
                ctx.moveTo(i, y);
            } else {
                ctx.lineTo(i, y);
            }
        }
        ctx.stroke();
    }

    // ─── Start the engine ────────────────────────
    document.addEventListener('DOMContentLoaded', init);
})();

// DOM Elements
const playerNameInput = document.getElementById('player-name');
const addPlayerBtn = document.getElementById('add-player-btn');
const playerList = document.getElementById('player-list');
const participantCountEl = document.getElementById('participant-count');
const startBtn = document.getElementById('start-btn');
const setupDashboard = document.getElementById('setup-dashboard');
const arena = document.getElementById('arena');
const activeCountEl = document.getElementById('active-count');
const winnerModal = document.getElementById('winner-modal');
const winnerAvatarEl = document.getElementById('winner-avatar');
const restartBtn = document.getElementById('restart-btn');
const gameSession = document.getElementById('game-session');

// Game State
let participants = []; // { id, name, color, unitClass, avatar, x, y, vx, vy, el, active }
let animationId = null;
let eliminationInterval = null;
const AVATAR_SIZE = 144;
const INITIAL_MAX_ARENA_SIZE = 960;
const SPEED = 2;
let START_PLAYER_COUNT = 0;
let cachedArenaRect = { width: 960, height: 960, top: 0, left: 0 };
let countdownActive = false;

let UNIT_COLORS = [];
let COLOR_HEXMAP = {};
let UNIT_CLASSES = [];
let SPRITE_MAP = {};

// Disable entry until config loads
playerNameInput.disabled = true;
addPlayerBtn.disabled = true;
playerNameInput.placeholder = "Loading game assets...";

function preloadImages(urls) {
    let loaded = 0;
    playerNameInput.placeholder = `Loading assets (0/${urls.length})...`;
    return Promise.all(urls.map(url => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                loaded++;
                playerNameInput.placeholder = `Loading assets (${loaded}/${urls.length})...`;
                resolve();
            }
            img.onerror = () => {
                console.warn("Failed to load: ", url);
                resolve(); // resolve anyway to not block game
            }
            img.src = url;
        });
    }));
}

fetch('assets/units.json?v=' + Date.now())
    .then(response => response.json())
    .then(data => {
        UNIT_COLORS = data.factions;
        COLOR_HEXMAP = data.hexMap;
        UNIT_CLASSES = Object.keys(data.classes);
        
        for (const [unitClass, config] of Object.entries(data.classes)) {
            SPRITE_MAP[unitClass] = config.sprites;
            SPRITE_MAP[unitClass]._visualScale = config.visualScale || 1.0;
        }
        
        let imagesToLoad = [];
        UNIT_COLORS.forEach(color => {
            UNIT_CLASSES.forEach(unitClass => {
                imagesToLoad.push(`assets/avatars/${color.toLowerCase()}_${unitClass.toLowerCase()}.png`);
                const sprites = SPRITE_MAP[unitClass];
                if (sprites.idle.file) imagesToLoad.push(`assets/Units/${color} Units/${unitClass}/${sprites.idle.file}`);
                if (sprites.run.file) imagesToLoad.push(`assets/Units/${color} Units/${unitClass}/${sprites.run.file}`);
                if (sprites.attack.file) imagesToLoad.push(`assets/Units/${color} Units/${unitClass}/${sprites.attack.file}`);
                if (sprites.dead.file) imagesToLoad.push(`assets/Units/${color} Units/${unitClass}/${sprites.dead.file}`);
            });
        });
        imagesToLoad = [...new Set(imagesToLoad)];
        
        return preloadImages(imagesToLoad);
    })
    .then(() => {
        // Enable entry
        playerNameInput.disabled = false;
        addPlayerBtn.disabled = false;
        playerNameInput.placeholder = "Enter Player Name...";
        
        loadParticipants();
    })
    .catch(error => {
        console.error("Error loading units configuration:", error);
        playerNameInput.placeholder = "Error loading assets!";
    });

function updateParticipantState(p, stateKey) {
    p.currentState = stateKey;
    const f  = p.frames[stateKey].count;
    const fw = p.frames[stateKey].frameW; // native width per cell
    const fh = p.frames[stateKey].frameH; // native height per cell
    const DISPLAY = 144; // target display size in px
    
    // Scale so the native cell maps 1:1 to DISPLAY px
    // bgW = (sheet_width / frameH) * DISPLAY = (fw * frames / frameH) * DISPLAY
    const scale = DISPLAY / fh;
    const bgW = Math.round(fw * f * scale);
    const bgH = DISPLAY;
    const stepW = Math.round(fw * scale); // expected == DISPLAY when fw == fh
    
    p.el.style.backgroundImage = `var(--anim-${stateKey})`;
    p.el.style.backgroundSize = `${bgW}px ${bgH}px`;
    const dur = Math.max(0.4, f * 0.1).toFixed(2);
    
    // Dynamic keyframe end position based on actual scaled sheet width
    p.el.style.setProperty('--sprite-step-w', `${-bgW}px`);
    
    if (stateKey === 'dead') {
        p.el.style.animation = `bloodFade 2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, sprite-cycle ${dur}s steps(${f}) 1 forwards`;
    } else {
        p.el.style.animation = ''; // Clear composite
        p.el.style.animationName = `sprite-cycle`;
        p.el.style.animationDuration = `${dur}s`;
        p.el.style.animationTimingFunction = `steps(${f})`;
        p.el.style.animationIterationCount = 'infinite';
        p.el.style.animationFillMode = 'none';
    }
}

function updateArenaSize() {
    const mainArea = document.getElementById('arena-main');
    if (!mainArea) return;

    // Calculate scale to fit the arena (960x960) into the available viewport area
    const availableW = mainArea.clientWidth - 40;
    const availableH = mainArea.clientHeight - 40;
    
    const scale = Math.min(1, availableW / 960, availableH / 960);
    
    // Set CSS variable for visual scaling
    arena.style.setProperty('--arena-scale', scale);
    
    // Keep internal logic coordinates strictly at 960x960
    cachedArenaRect = { width: 960, height: 960, left: 0, top: 0 };
}

// The character engine relies on dynamically injected background-images via CSS vars
// representing Idle, Run, and Attack animations.


// LocalStorage Persistence
function saveParticipants() {
    const rawData = participants.map(p => ({
        name: p.name,
        color: p.color,
        unitClass: p.unitClass,
        avatar: p.avatar
    }));
    localStorage.setItem('duckRumblePlayers', JSON.stringify(rawData));
}

function loadParticipants() {
    try {
        const data = localStorage.getItem('duckRumblePlayers');
        if (data) {
            participants = JSON.parse(data);
            
            if (participants.length > 12) {
                participants = participants.slice(0, 12);
            }
            
            saveParticipants();
            updateSetupUI();
        }
    } catch(e) {
        console.error("Local storage error:", e);
    }
}

// Add Player Logic
function addPlayer(name) {
    if (!name.trim()) return;
    
    if (participants.length >= 12) {
        alert("Maximum 12 participants allowed.");
        return;
    }
    
    let color, unitClass;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 100) {
        color = UNIT_COLORS[Math.floor(Math.random() * UNIT_COLORS.length)];
        unitClass = UNIT_CLASSES[Math.floor(Math.random() * UNIT_CLASSES.length)];
        
        isUnique = !participants.some(p => p.color === color && p.unitClass === unitClass);
        attempts++;
    }
    
    // Avatar filename: {color}_{class}.png — all lowercase
    // e.g. blue_warrior.png, red_lancer.png, purple_monk.png
    const avatar = `assets/avatars/${color.toLowerCase()}_${unitClass.toLowerCase()}.png`;
    
    participants.push({ name: name.trim(), color, unitClass, avatar });
    saveParticipants();
    playerNameInput.value = '';
    updateSetupUI();
}

// Event Listeners for Adding
addPlayerBtn.addEventListener('click', () => {
    addPlayer(playerNameInput.value);
});

playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addPlayer(playerNameInput.value);
});

// Remove player
function removePlayer(index) {
    participants.splice(index, 1);
    saveParticipants();
    updateSetupUI();
}

function updateSetupUI() {
    participantCountEl.textContent = participants.length;
    
    // Rebuild list
    playerList.innerHTML = '';
    participants.forEach((p, index) => {
        const li = document.createElement('li');
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'lobby-info';
        
        const avatarImg = document.createElement('img');
        avatarImg.src = p.avatar;
        avatarImg.className = 'lobby-avatar';
        // Assign border color based on unit color
        avatarImg.style.borderColor = COLOR_HEXMAP[p.color];
        
        const nameDiv = document.createElement('div');
        nameDiv.textContent = p.name;
        nameDiv.className = 'lobby-name';
        nameDiv.style.color = COLOR_HEXMAP[p.color];
        
        infoDiv.appendChild(avatarImg);
        infoDiv.appendChild(nameDiv);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'X';
        removeBtn.onclick = () => removePlayer(index);
        
        li.appendChild(infoDiv);
        li.appendChild(removeBtn);
        playerList.appendChild(li);
    });

    if (participants.length > 1) {
        startBtn.disabled = false;
    } else {
        startBtn.disabled = true;
    }

    if (participants.length >= 12) {
        addPlayerBtn.disabled = true;
        playerNameInput.disabled = true;
        playerNameInput.placeholder = "Max 12 Participants Reached";
    } else {
        addPlayerBtn.disabled = false;
        playerNameInput.disabled = false;
        playerNameInput.placeholder = "Enter Player Name...";
    }
}

// Start Game
startBtn.addEventListener('click', () => {
    setupDashboard.classList.add('hidden');
    gameSession.classList.remove('hidden');
    initArena();
});

window.addEventListener('resize', () => {
    if (!arena.classList.contains('hidden')) {
        cachedArenaRect = arena.getBoundingClientRect();
    }
});

function initArena() {
    arena.innerHTML = '<div id="countdown-overlay"></div>';
    
    // Reset scoreboard and active count
    const scoreboard = document.getElementById('scoreboard');
    scoreboard.innerHTML = '';
    
    START_PLAYER_COUNT = participants.length;
    updateArenaSize();
    cachedArenaRect = arena.getBoundingClientRect();
    
    // Initialize participant objects
    participants = participants.map((p, index) => {
        const el = document.createElement('div');
        // Initialize base class
        el.className = `participant state-run`;
        
        // Inject Dynamic Medieval Assets
        const sprites = SPRITE_MAP[p.unitClass];
        el.style.setProperty('--anim-idle', `url('assets/Units/${p.color} Units/${p.unitClass}/${sprites.idle.file}')`);
        el.style.setProperty('--anim-run', `url('assets/Units/${p.color} Units/${p.unitClass}/${sprites.run.file}')`);
        el.style.setProperty('--anim-attack', `url('assets/Units/${p.color} Units/${p.unitClass}/${sprites.attack.file}')`);
        el.style.setProperty('--anim-dead', `url('assets/Units/${p.color} Units/${p.unitClass}/${sprites.dead.file}')`);
        
        // Health Bar
        const healthBar = document.createElement('div');
        healthBar.className = 'health-bar';
        healthBar.innerHTML = '<div class="health-segment"></div><div class="health-segment"></div><div class="health-segment"></div>';
        el.appendChild(healthBar);
        
        // Label
        const label = document.createElement('div');
        label.className = 'participant-label';
        label.textContent = p.name;
        label.style.color = COLOR_HEXMAP[p.color];
        label.style.textShadow = `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 5px ${COLOR_HEXMAP[p.color]}`;
        el.appendChild(label);
        
        // Random start position within bounds
        const x = Math.random() * (cachedArenaRect.width - AVATAR_SIZE);
        const y = Math.random() * (cachedArenaRect.height - AVATAR_SIZE);
        
        // Random direction
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * SPEED;
        const vy = Math.sin(angle) * SPEED;
        
        arena.appendChild(el);
        
        const participantObj = {
            id: index,
            name: p.name,
            color: p.color,
            unitClass: p.unitClass,
            avatar: p.avatar,
            x, y, vx, vy, el,
            labelEl: label,
            healthBarEl: healthBar,
            healthSegments: Array.from(healthBar.querySelectorAll('.health-segment')),
            active: true,
            dashing: false,
            kills: 0,
            hp: 3,
            isFighting: false,
            cooldown: false,
            forceFlip: false,
            currentState: 'none',
            currentClass: 'participant state-run',
            visualScale: sprites._visualScale || 1.0,
            frames: {
                idle:   { count: sprites.idle.frames,   frameW: sprites.idle.frameW,   frameH: sprites.idle.frameH },
                run:    { count: sprites.run.frames,    frameW: sprites.run.frameW,    frameH: sprites.run.frameH },
                attack: { count: sprites.attack.frames, frameW: sprites.attack.frameW, frameH: sprites.attack.frameH },
                dead:   { count: sprites.dead.frames,   frameW: sprites.dead.frameW,   frameH: sprites.dead.frameH }
            }
        };
        updateParticipantState(participantObj, 'run');
        return participantObj;
    });
    
    // Build Scoreboard
    participants.forEach(p => {
        const card = document.createElement('div');
        card.className = 'score-card';
        card.id = `score-card-${p.id}`;
        card.innerHTML = `
            <img src="${p.avatar}" class="score-avatar" style="border: 2px solid ${COLOR_HEXMAP[p.color]};">
            <div class="score-name" style="color: ${COLOR_HEXMAP[p.color]}">${p.name}</div>
            <div class="score-hp" id="score-hp-${p.id}" style="color: #27ae60; margin: 0 5px; font-size: 0.9em; font-family: monospace;">♥♥♥</div>
            <div class="score-kills" id="score-kills-${p.id}">⚔️ 0</div>
        `;
        scoreboard.appendChild(card);
    });
    
    updateActiveCount();
    
    countdownActive = true;
    let count = 3;
    const countdownEl = document.getElementById('countdown-overlay');
    countdownEl.textContent = count;
    
    const countInterval = setInterval(() => {
        countdownEl.classList.remove('countdown-pulse');
        void countdownEl.offsetWidth; // trigger reflow
        countdownEl.classList.add('countdown-pulse');
        
        setTimeout(() => {
            count--;
            countdownEl.classList.remove('countdown-pulse');
            if (count > 0) {
                countdownEl.textContent = count;
            } else if (count === 0) {
                countdownEl.textContent = "BRAWL!";
            } else {
                clearInterval(countInterval);
                if (countdownEl && countdownEl.parentNode) countdownEl.remove();
                countdownActive = false;
            }
        }, 200);
    }, 1000);
    
    gameLoop();
}

function gameLoop() {
    if (!countdownActive) {
        // Movement and bounds
        participants.forEach(p => {
        if (!p.active || p.isFighting) return;
        
        p.x += p.vx;
        p.y += p.vy;
        
        // Bounce off walls & Ensure they don't get trapped outside shrinking borders
        if (p.x < 0) { 
            p.x = 0; 
            p.vx = Math.abs(p.vx); 
        }
        if (p.x + AVATAR_SIZE > cachedArenaRect.width) { 
            p.x = cachedArenaRect.width - AVATAR_SIZE; 
            p.vx = -Math.abs(p.vx); 
        }
        if (p.y < 0) { 
            p.y = 0; 
            p.vy = Math.abs(p.vy); 
        }
        if (p.y + AVATAR_SIZE > cachedArenaRect.height) { 
            p.y = cachedArenaRect.height - AVATAR_SIZE; 
            p.vy = -Math.abs(p.vy); 
        }
    });

    // Collision Pass
    for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
            const p1 = participants[i];
            const p2 = participants[j];
            
            if (p1.active && p2.active && !p1.isFighting && !p2.isFighting && !p1.cooldown && !p2.cooldown) {
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                
                if (dx * dx + dy * dy < 3600) {
                    startFight(p1, p2);
                }
            }
        }
    }
    }

    // Render pass
    participants.forEach(p => {
        if (!p.active) return;
        
        let stateClass = 'state-idle';
        let stateKey = 'idle';
        let flipped = p.x > cachedArenaRect.width / 2; // Face center
        
        if (!countdownActive) {
            stateClass = p.isFighting ? 'state-attack' : 'state-run';
            stateKey = p.isFighting ? 'attack' : 'run';
            flipped = p.isFighting ? p.forceFlip : (p.vx < 0);
        }
        
        let extraClass = '';
        if (p.dashing) extraClass += ' dashing';
        if (p.cooldown) extraClass += ' cooldown';

        const newClassName = `participant ${stateClass}${extraClass}`;
        if (p.currentClass !== newClassName) {
            p.el.className = newClassName;
            p.currentClass = newClassName;
        }
        
        if (p.currentState !== stateKey) {
            updateParticipantState(p, stateKey);
        }

        const vs = p.visualScale;
        
        // Save bounds for CSS animations to reference
        p.el.style.setProperty('--p-x', `${p.x}px`);
        p.el.style.setProperty('--p-y', `${p.y}px`);
        p.el.style.setProperty('--p-scale', vs);
        p.el.style.setProperty('--p-flip', flipped ? -1 : 1);
        
        const flipTransform = flipped ? ' scaleX(-1)' : '';
        p.el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${vs})${flipTransform}`;
        
        const innerTransform = `translateX(-50%) scale(${1/vs})${flipTransform}`;
        p.labelEl.style.transform = innerTransform;
        if (p.healthBarEl) {
            p.healthBarEl.style.transform = innerTransform;
        }
    });
    
    animationId = requestAnimationFrame(gameLoop);
}

function updateActiveCount() {
    const activeContenders = participants.filter(p => p.active);
    document.getElementById('active-count').textContent = activeContenders.length;
}

function startFight(p1, p2) {
    p1.isFighting = true;
    p2.isFighting = true;
    
    p1.vx = 0; p1.vy = 0;
    p2.vx = 0; p2.vy = 0;
    
    // Face each other
    if (p1.x < p2.x) {
        p1.forceFlip = false;
        p2.forceFlip = true;
        p1.x = p2.x - 40;
        p1.y = p2.y;
    } else {
        p1.forceFlip = true;
        p2.forceFlip = false;
        p1.x = p2.x + 40;
        p1.y = p2.y;
    }
    
    setTimeout(() => {
        resolveFight(p1, p2);
    }, 2000);
}

function resolveFight(p1, p2) {
    if (!p1.active || !p2.active) return;
    
    const p1Loses = Math.random() > 0.5;
    const loser = p1Loses ? p1 : p2;
    const winner = p1Loses ? p2 : p1;
    
    drawSlash(loser.x + AVATAR_SIZE/2, loser.y + AVATAR_SIZE/2, COLOR_HEXMAP[winner.color]);
    
    loser.hp -= 1;
    updateHealthUI(loser);
    
    if (loser.hp <= 0) {
        loser.active = false;
        updateParticipantState(loser, 'dead');
        loser.el.classList.add('eliminated');
        updateActiveCount();
        updateArenaSize();
        
        winner.kills++;
        const scoreKillsEl = document.getElementById(`score-kills-${winner.id}`);
        if(scoreKillsEl) {
            scoreKillsEl.textContent = `⚔️ ${winner.kills}`;
            scoreKillsEl.style.transform = "scale(1.5)";
            setTimeout(() => scoreKillsEl.style.transform = "scale(1)", 200);
        }
        
        const targetScoreCard = document.getElementById(`score-card-${loser.id}`);
        if (targetScoreCard) targetScoreCard.classList.add('eliminated-score');
    }
    
    resetFighter(winner);
    if (loser.hp > 0) {
        resetFighter(loser);
    }
    
    const remaining = participants.filter(p => p.active);
    if (remaining.length === 1) {
        setTimeout(declareWinner, 1500);
    }
}

function resetFighter(p) {
    p.isFighting = false;
    p.cooldown = true;
    updateParticipantState(p, 'run');
    p.el.classList.remove('state-attack');
    p.el.classList.add('state-run');
    
    const angle = Math.random() * Math.PI * 2;
    p.vx = Math.cos(angle) * SPEED;
    p.vy = Math.sin(angle) * SPEED;
    
    setTimeout(() => {
        p.cooldown = false;
        p.el.classList.remove('cooldown');
    }, 1500);
}

function updateHealthUI(p) {
    const scoreHpEl = document.getElementById(`score-hp-${p.id}`);
    if (scoreHpEl) {
        if (p.hp === 3) scoreHpEl.textContent = "♥♥♥";
        else if (p.hp === 2) scoreHpEl.textContent = "♥♥♡";
        else if (p.hp === 1) scoreHpEl.textContent = "♥♡♡";
        else scoreHpEl.textContent = "♡♡♡";
        
        if (p.hp <= 1) scoreHpEl.style.color = "#c0392b";
        else if (p.hp === 2) scoreHpEl.style.color = "#f39c12";
    }
    
    if (p.healthSegments) {
        for (let i = 0; i < p.healthSegments.length; i++) {
            if (i < p.hp) {
                p.healthSegments[i].classList.remove('lost');
            } else {
                p.healthSegments[i].classList.add('lost');
            }
        }
    }
}

function drawSlash(x, y, colorHex) {
    const slash = document.createElement('div');
    slash.className = 'slash';
    
    // Color slash to match attacker's hex config
    slash.style.borderTopColor = colorHex;
    slash.style.left = `${x}px`;
    slash.style.top = `${y}px`;
    
    arena.appendChild(slash);
    
    setTimeout(() => {
        slash.remove();
    }, 300);
}

function declareWinner() {
    cancelAnimationFrame(animationId);
    const winner = participants.find(p => p.active);
    
    if (winner) {
        winner.el.classList.add('champion');
        // Center the winner
        const arenaRect = arena.getBoundingClientRect();
        winner.x = arenaRect.width / 2 - AVATAR_SIZE / 2;
        winner.y = arenaRect.height / 2 - AVATAR_SIZE / 2;
        winner.el.style.transform = `translate(${winner.x}px, ${winner.y}px) scale(1.5)`;
        winner.el.style.transition = 'transform 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        
        // Keep the text oriented correctly
        winner.el.querySelector('.participant-label').style.transform = `translateX(-50%)`;
        
        // Force the winner into idle animation explicitly
        updateParticipantState(winner, 'idle');
        
        // Show winner modal using CSS classes
        winnerAvatarEl.className = `participant state-idle`;
        const winnerSprites = SPRITE_MAP[winner.unitClass];
        winnerAvatarEl.style.setProperty('--anim-idle', `url('assets/Units/${winner.color} Units/${winner.unitClass}/${winnerSprites.idle.file}')`);
        const f  = winnerSprites.idle.frames;
        const fw = winnerSprites.idle.frameW;
        const fh = winnerSprites.idle.frameH;
        const scale = 144 / fh;
        const bgW = Math.round(fw * f * scale);
        winnerAvatarEl.style.backgroundImage = `var(--anim-idle)`;
        winnerAvatarEl.style.backgroundSize = `${bgW}px 144px`;
        const dur = Math.max(0.4, f * 0.1).toFixed(2);
        winnerAvatarEl.style.setProperty('--sprite-step-w', `${-bgW}px`);
        winnerAvatarEl.style.animation = `championPulse 2s infinite, sprite-cycle ${dur}s steps(${f}) infinite`;
        
        // Use visualScale for the winner character art
        const vs = winner.visualScale || 1.0;
        winnerAvatarEl.style.transform = `scale(${1.5 * vs})`;
        winnerAvatarEl.style.position = 'relative'; 

        winnerAvatarEl.style.margin = '0 auto';
        
        document.querySelector('.winner-title').innerHTML = `CHAMPION<br/>${winner.name}`;
        
        setTimeout(() => {
            gameSession.classList.add('hidden');
            winnerModal.classList.remove('hidden');
        }, 1500);
    }
}

// Restart
restartBtn.addEventListener('click', () => {
    winnerModal.classList.add('hidden');
    setupDashboard.classList.remove('hidden');
    // Reset pool back to pristine state from localStorage (removes DOM elements)
    if (localStorage.getItem('duckRumblePlayers')) {
        loadParticipants();
    } else {
        participants = [];
        updateSetupUI();
    }
});

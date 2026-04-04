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

// Game State
let participants = []; // { id, name, color, unitClass, avatar, x, y, vx, vy, el, active }
let animationId = null;
let eliminationInterval = null;
const AVATAR_SIZE = 144;
const SPEED = 2;

let UNIT_COLORS = [];
let COLOR_HEXMAP = {};
let UNIT_CLASSES = [];
let SPRITE_MAP = {};

// Disable entry until config loads
playerNameInput.disabled = true;
addPlayerBtn.disabled = true;
playerNameInput.placeholder = "Loading game assets...";

fetch('assets/units.json?v=' + Date.now())
    .then(response => response.json())
    .then(data => {
        UNIT_COLORS = data.factions;
        COLOR_HEXMAP = data.hexMap;
        UNIT_CLASSES = Object.keys(data.classes);
        
        for (const [unitClass, config] of Object.entries(data.classes)) {
            SPRITE_MAP[unitClass] = config.sprites;
        }
        
        // Enable entry
        playerNameInput.disabled = false;
        addPlayerBtn.disabled = false;
        playerNameInput.placeholder = "Enter Player Name...";
    })
    .catch(error => {
        console.error("Error loading units configuration:", error);
        playerNameInput.placeholder = "Error loading assets!";
    });

function updateParticipantState(p, stateKey) {
    p.currentState = stateKey;
    const f = p.frames[stateKey];
    p.el.style.backgroundImage = `var(--anim-${stateKey})`;
    p.el.style.backgroundSize = `${f * 144}px 144px`;
    const dur = Math.max(0.4, f * 0.1).toFixed(2);
    p.el.style.animationName = `sprite-cycle-${f}`;
    p.el.style.animationDuration = `${dur}s`;
    p.el.style.animationTimingFunction = `steps(${f})`;
    p.el.style.animationIterationCount = `infinite`;
}

// The character engine relies on dynamically injected background-images via CSS vars
// representing Idle, Run, and Attack animations.


// Add Player Logic
function addPlayer(name) {
    if (!name.trim()) return;
    
    const color = UNIT_COLORS[Math.floor(Math.random() * UNIT_COLORS.length)];
    const unitClass = UNIT_CLASSES[Math.floor(Math.random() * UNIT_CLASSES.length)];
    
    // Random avatar (1 to 25)
    const avatarNum = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
    const avatar = `assets/avatars/Avatars_${avatarNum}.png`;
    
    participants.push({ name: name.trim(), color, unitClass, avatar });
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
}

// Start Game
startBtn.addEventListener('click', () => {
    setupDashboard.classList.add('hidden');
    arena.classList.remove('hidden');
    initArena();
});

function initArena() {
    arena.innerHTML = '<div id="overlay-stats">Contenders Left: <span id="active-count">0</span></div><div id="scoreboard"></div>';
    
    const arenaRect = arena.getBoundingClientRect();
    
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
        
        // Label
        const label = document.createElement('div');
        label.className = 'participant-label';
        label.textContent = p.name;
        label.style.color = COLOR_HEXMAP[p.color];
        label.style.textShadow = `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 5px ${COLOR_HEXMAP[p.color]}`;
        el.appendChild(label);
        
        // Random start position within bounds
        const x = Math.random() * (arenaRect.width - AVATAR_SIZE);
        const y = Math.random() * (arenaRect.height - AVATAR_SIZE);
        
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
            active: true,
            dashing: false,
            kills: 0,
            currentState: 'none',
            frames: {
                idle: sprites.idle.frames,
                run: sprites.run.frames,
                attack: sprites.attack.frames
            }
        };
        updateParticipantState(participantObj, 'run');
        return participantObj;
    });
    
    // Build Scoreboard
    const scoreboard = document.getElementById('scoreboard');
    participants.forEach(p => {
        const card = document.createElement('div');
        card.className = 'score-card';
        card.id = `score-card-${p.id}`;
        card.innerHTML = `
            <img src="${p.avatar}" class="score-avatar" style="border: 2px solid ${COLOR_HEXMAP[p.color]};">
            <div class="score-name" style="color: ${COLOR_HEXMAP[p.color]}">${p.name}</div>
            <div class="score-kills" id="score-kills-${p.id}">⚔️ 0</div>
        `;
        scoreboard.appendChild(card);
    });
    
    updateActiveCount();
    gameLoop();
    
    // Start Elimination Timer (slower: every 5 seconds)
    eliminationInterval = setInterval(eliminateRandomParticipant, 5000);
}

function gameLoop() {
    const arenaRect = arena.getBoundingClientRect();
    
    participants.forEach(p => {
        if (!p.active) return;
        
        // Move
        p.x += p.vx;
        p.y += p.vy;
        
        // Bounce off walls
        if (p.x <= 0) { p.x = 0; p.vx *= -1; }
        if (p.x + AVATAR_SIZE >= arenaRect.width) { p.x = arenaRect.width - AVATAR_SIZE; p.vx *= -1; }
        if (p.y <= 0) { p.y = 0; p.vy *= -1; }
        if (p.y + AVATAR_SIZE >= arenaRect.height) { p.y = arenaRect.height - AVATAR_SIZE; p.vy *= -1; }
        
        // Deduce directional component
        let stateClass = 'state-run';
        let stateKey = 'run';
        if (p.el.classList.contains('state-attack')) {
             stateClass = 'state-attack';
             stateKey = 'attack';
        }
        let extraClass = '';
        if (p.dashing) extraClass += ' dashing';
        
        let flipTransform = '';
        let flipped = p.vx < 0;
        if (p.active && !p.el.classList.contains('eliminated')) {
            p.el.className = `participant ${stateClass}${extraClass}`;
            if (p.currentState !== stateKey) {
                updateParticipantState(p, stateKey);
            }
            if (flipped) {
                flipTransform = ' scaleX(-1)';
            }
        }

        // Apply baseline transform
        p.el.style.transform = `translate(${p.x}px, ${p.y}px)${flipTransform}`;
        
        // Ensure name label remains unflipped and properly centered
        p.el.querySelector('.participant-label').style.transform = `translateX(-50%)${flipTransform ? ' scaleX(-1)' : ''}`;
    });
    
    animationId = requestAnimationFrame(gameLoop);
}

function updateActiveCount() {
    const activeContenders = participants.filter(p => p.active);
    document.getElementById('active-count').textContent = activeContenders.length;
}

function eliminateRandomParticipant() {
    const activeContenders = participants.filter(p => p.active && !p.dashing);
    
    // Need at least 2 people not currently mid-dash
    if (activeContenders.length <= 1) return; 
    
    // Pick random attacker
    const attackerIndex = Math.floor(Math.random() * activeContenders.length);
    const attacker = activeContenders[attackerIndex];
    
    // Pick random target (ensure it's not the attacker)
    let targetIndex = Math.floor(Math.random() * activeContenders.length);
    while (targetIndex === attackerIndex) {
        targetIndex = Math.floor(Math.random() * activeContenders.length);
    }
    const target = activeContenders[targetIndex];
    
    // Suspend typical attacker logic to DASH at target
    attacker.dashing = true;
    attacker.el.classList.remove('state-run');
    attacker.el.classList.add('state-attack');
    attacker.vx = 0;
    attacker.vy = 0;
    attacker.el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    // Attack position (next to target)
    const dx = target.x - attacker.x;
    const direction = dx > 0 ? 1 : -1;
    const clashX = target.x - (30 * direction); // stop just in front of them
    const clashY = target.y;
    
    attacker.x = clashX;
    attacker.y = clashY;
    // Force face target during dash
    const isFacingLeft = dx < 0;
    attacker.el.className = `participant state-attack dashing`;
    attacker.el.style.transform = `translate(${attacker.x}px, ${attacker.y}px)${isFacingLeft ? ' scaleX(-1)' : ''}`;
    attacker.el.querySelector('.participant-label').style.transform = `translateX(-50%)${isFacingLeft ? ' scaleX(-1)' : ''}`;

        // Wait for dash to physically complete, then Slash
    setTimeout(() => {
        target.active = false;
        
        // Slash effect centered on target
        drawSlash(target.x + AVATAR_SIZE/2, target.y + AVATAR_SIZE/2, COLOR_HEXMAP[attacker.color]);
        
        target.el.classList.add('eliminated');
        updateActiveCount();
        
        // Update the live scoreboard
        attacker.kills++;
        const scoreKillsEl = document.getElementById(`score-kills-${attacker.id}`);
        if(scoreKillsEl) {
            scoreKillsEl.textContent = `⚔️ ${attacker.kills}`;
            // Optional little bump animation on kill gain
            scoreKillsEl.style.transform = "scale(1.5)";
            setTimeout(() => scoreKillsEl.style.transform = "scale(1)", 200);
        }
        
        const targetScoreCard = document.getElementById(`score-card-${target.id}`);
        if (targetScoreCard) targetScoreCard.classList.add('eliminated-score');
        
        // Let attacker resume bouncing
        attacker.el.style.transition = 'none';
        const angle = Math.random() * Math.PI * 2;
        attacker.vx = Math.cos(angle) * SPEED;
        attacker.vy = Math.sin(angle) * SPEED;
        attacker.dashing = false;
        attacker.el.classList.remove('state-attack');
        // Do not explicitly set classList.add('state-run') here, the `gameLoop()` applies the class correctly on the next frame based on dashing/attack states so it resets natively.
        
        // Check if 1 winner left
        const remaining = participants.filter(p => p.active);
        if (remaining.length === 1) {
            clearInterval(eliminationInterval);
            setTimeout(declareWinner, 1500); 
        }
    }, 300);
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
        const f = winnerSprites.idle.frames;
        winnerAvatarEl.style.setProperty('--anim-idle', `url('assets/Units/${winner.color} Units/${winner.unitClass}/${winnerSprites.idle.file}')`);
        winnerAvatarEl.style.backgroundImage = `var(--anim-idle)`;
        winnerAvatarEl.style.backgroundSize = `${f * 144}px 144px`;
        const dur = Math.max(0.4, f * 0.1).toFixed(2);
        winnerAvatarEl.style.animation = `championPulse 2s infinite, sprite-cycle-${f} ${dur}s steps(${f}) infinite`;
        
        winnerAvatarEl.style.transform = 'scale(1.5)';
        winnerAvatarEl.style.position = 'relative';
        winnerAvatarEl.style.margin = '0 auto';
        
        document.querySelector('.winner-title').innerHTML = `CHAMPION<br/>${winner.name}`;
        
        setTimeout(() => {
            arena.classList.add('hidden');
            winnerModal.classList.remove('hidden');
        }, 1500);
    }
}

// Restart
restartBtn.addEventListener('click', () => {
    winnerModal.classList.add('hidden');
    setupDashboard.classList.remove('hidden');
    // Reset pool
    participants = [];
    updateSetupUI();
});

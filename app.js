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
let participants = []; // { id, name, hue, x, y, vx, vy, el, active }
let animationId = null;
let eliminationInterval = null;
const AVATAR_SIZE = 64;
const SPEED = 2;

// The Chibi Warrior sprite is now handled purely in CSS via background-image animations.
// It will dynamically use the hue tint given to it.


// Add Player Logic
function addPlayer(name) {
    if (!name.trim()) return;
    
    // Give them a random color hue
    const hue = Math.floor(Math.random() * 360);
    
    participants.push({ name: name.trim(), hue });
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
        li.textContent = p.name;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'X';
        removeBtn.onclick = () => removePlayer(index);
        
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
    arena.innerHTML = '<div id="overlay-stats">Contenders Left: <span id="active-count">0</span></div>';
    
    const arenaRect = arena.getBoundingClientRect();
    
    // Initialize participant objects
    participants = participants.map((p, index) => {
        const el = document.createElement('div');
        el.className = 'participant dir-east'; // start facing right
        el.style.filter = `hue-rotate(${p.hue}deg)`;
        
        // Label
        const label = document.createElement('div');
        label.className = 'participant-label';
        label.textContent = p.name;
        el.appendChild(label);
        
        // Random start position within bounds
        const x = Math.random() * (arenaRect.width - AVATAR_SIZE);
        const y = Math.random() * (arenaRect.height - AVATAR_SIZE);
        
        // Random direction
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * SPEED;
        const vy = Math.sin(angle) * SPEED;
        
        arena.appendChild(el);
        
        return {
            id: index,
            name: p.name,
            hue: p.hue,
            x, y, vx, vy, el,
            active: true,
            dashing: false
        };
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
        
        // Deduce directional component strictly via velocity
        let dir = 'east';
        if (Math.abs(p.vx) > Math.abs(p.vy)) {
            dir = p.vx > 0 ? 'east' : 'west';
        } else {
            dir = p.vy > 0 ? 'south' : 'north';
        }

        // Apply baseline transform
        p.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
        
        let extraClass = '';
        if (p.dashing) extraClass = ' dashing';
        if (p.active && !p.el.classList.contains('eliminated')) {
            p.el.className = `participant dir-${dir}${extraClass}`;
        }
        
        // Ensure name label remains unflipped and properly centered
        p.el.querySelector('.participant-label').style.transform = `translateX(-50%)`;
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
    attacker.el.classList.add('dashing');
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
    const faceDir = dx > 0 ? 'east' : 'west';
    attacker.el.className = `participant dir-${faceDir} dashing`;
    attacker.el.style.transform = `translate(${attacker.x}px, ${attacker.y}px)`;

    // Wait for dash to physically complete, then Slash
    setTimeout(() => {
        target.active = false;
        
        // Slash effect centered on target
        drawSlash(target.x + AVATAR_SIZE/2, target.y + AVATAR_SIZE/2, attacker.hue);
        
        target.el.classList.add('eliminated');
        updateActiveCount();
        
        // Let attacker resume bouncing
        attacker.el.style.transition = 'none';
        const angle = Math.random() * Math.PI * 2;
        attacker.vx = Math.cos(angle) * SPEED;
        attacker.vy = Math.sin(angle) * SPEED;
        attacker.dashing = false;
        attacker.el.classList.remove('dashing');
        
        // Check if 1 winner left
        const remaining = participants.filter(p => p.active);
        if (remaining.length === 1) {
            clearInterval(eliminationInterval);
            setTimeout(declareWinner, 1500); 
        }
    }, 300);
}

function drawSlash(x, y, hue) {
    const slash = document.createElement('div');
    slash.className = 'slash';
    
    // Color slash to match attacker
    slash.style.filter = `hue-rotate(${hue}deg)`;
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
        
        // Show winner modal (idle south frame works best for mugshot)
        winnerAvatarEl.className = 'dir-south';
        winnerAvatarEl.style.backgroundImage = "url('assets/warrior/animations/running-4-frames/south/frame_000.png')";
        winnerAvatarEl.style.backgroundSize = "contain";
        winnerAvatarEl.style.backgroundRepeat = "no-repeat";
        winnerAvatarEl.style.backgroundPosition = "center center";
        winnerAvatarEl.style.width = "64px";
        winnerAvatarEl.style.height = "64px";
        winnerAvatarEl.style.margin = "0 auto";
        winnerAvatarEl.style.filter = `hue-rotate(${winner.hue}deg)`;
        
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

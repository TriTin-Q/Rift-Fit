/**
 * ==========================================================================
 * 1. CONFIGURATION & STATE
 * ==========================================================================
 */

function sanitize(str) {
    if (!str) return "";
    const temp = document.createElement('div');
    temp.textContent = str; // Transforme le code dangereux en texte inoffensif
    return temp.innerHTML;
}
const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const API_BASE_URL = isLocal 
    ? "http://localhost:3000" 
    : "https://ton-api-en-ligne.com";

let translations = {};

const gameThemes = {
    lol: { quote: "League of Legends", colorClass: "color-lol" },
    tft: { quote: "Teamfight Tactics", colorClass: "color-tft" },
    valorant: { quote: "Valorant", colorClass: "color-valorant" }
};

/**
 * ==========================================================================
 * 2. INITIALIZATION (On Load)
 * ==========================================================================
 */
document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Load Translations ---
    try {
        const response = await fetch('../Assets/translations.json');
        translations = await response.json();
    } catch (error) {
        console.error("Translation file missing:", error);
    }

    // --- 2. Initial Setup (Settings & UI) ---
    const savedDiff = localStorage.getItem('preferredDiff') || 'gold';
    const savedLang = localStorage.getItem('preferredLang') || 'fr';
    const lastGame = localStorage.getItem('selectedGame') || 'lol';

    document.getElementById('difficulty').value = savedDiff;
    document.getElementById('lang-select').value = savedLang;
    
    setTheme(lastGame);
    updateLanguage(); // Apply initial translations

    // --- 3. Event Listeners ---
    // Game selection banner
    document.querySelector('.lol')?.addEventListener('click', () => setTheme('lol'));
    // document.querySelector('.tft')?.addEventListener('click', () => setTheme('tft'));
    // Remplace la ligne du clic TFT par celle-ci :
document.querySelector('.tft')?.addEventListener('click', () => {
    openComingSoon();
    setTheme('tft'); // On garde le changement de couleur en fond, c'est plus joli
});


    // Difficulty change
    document.getElementById('difficulty').onchange = (e) => {
        localStorage.setItem('preferredDiff', e.target.value);
    };

    // Unlock buttons on input
    document.getElementById('riotId').addEventListener('input', checkInputValidity);

    // Onboarding check
    if (!localStorage.getItem('hasSeenOnboarding')) {
        openOnboarding();
    }
});

/**
 * ==========================================================================
 * 3. CORE LOGIC (Dispatcher & Match Analysis)
 * ==========================================================================
 */

/** Main function triggered by buttons */
async function generateWorkout(mode = 'solo') {
    const currentGame = localStorage.getItem('selectedGame') || 'lol';
    const userDiff = document.getElementById('difficulty').value;
    const fullRiotId = document.getElementById('riotId').value.trim();

    if (!fullRiotId.includes('#')) return;

    // UI Feedback
    document.getElementById('loading').style.display = 'block';
    document.getElementById('workout-board').style.display = 'none';

    try {
        await generateLoLWorkout(userDiff, fullRiotId, mode);
        // if (currentGame === 'lol') {
        //     await generateLoLWorkout(userDiff, fullRiotId, mode);
        // } else if (currentGame === 'tft') {
        //     await generateTFTWorkout(userDiff, fullRiotId, mode);
        // }
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        alert("Error fetching data: " + error.message);
    }
}

/** League of Legends Logic */
async function generateLoLWorkout(difficulty, fullRiotId, mode) {
    const region = document.getElementById('region').value;
    const [gameName, tagLine] = fullRiotId.split('#');

    const response = await fetch(`${API_BASE_URL}/api/last-match/${region}/${gameName}/${tagLine}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    // Config & Multipliers
    const difficultySettings = {
        iron: { mult: 1.0, maxPushUp: 10 },
        gold: { mult: 1.2, maxPushUp: 15 },
        challenger: { mult: 1.5, maxPushUp: 25 }
    };
    const config = difficultySettings[difficulty];
    const collateralMult = (mode === 'collateral') ? 1.6 : 1.0;
    const gameResultMult = data.victoire ? 0.8 : 1.2;

    const calculate = (stat) => Math.max(3, Math.ceil(stat * config.mult * gameResultMult * collateralMult));

    // Special capped calculation for Push-ups
    const calculatePushups = (stat) => {
        const dynamicMax = mode === 'collateral' ? config.maxPushUp * 1.5 : config.maxPushUp;
        let res = Math.ceil(stat * config.mult * gameResultMult * collateralMult);
        return Math.min(dynamicMax, Math.max(3, res));
    };

    const squats = calculate(data.kills);
    const pushups = calculatePushups(data.morts);
    const abs = calculate(data.assists);

    const board = document.getElementById('workout-board');

    // 1. Inject correct UI
    if (mode === 'collateral') {
        renderCollateralUI(board, squats, pushups, abs, data);
    } else {
        renderSoloUI(board, squats, pushups, abs, data);
    }

    // 2. Final Touches (Theme & Status)
    let champImg = data.champion.replace(/['\s.]/g, '');
    if (champImg === 'Wukong') champImg = 'MonkeyKing';
    board.style.setProperty('--champ-bg', `url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champImg}_0.jpg')`);

    updateGameStatus(data.victoire);
    
    // 3. Reveal and Refresh Translations
    document.getElementById('loading').style.display = 'none';
    board.style.display = 'block';
    updateLanguage(); 
}

/** Teamfight Tactics Logic */
async function generateTFTWorkout(difficulty, fullRiotId, mode) {
    const region = document.getElementById('region').value;
    const [gameName, tagLine] = fullRiotId.split('#');

    const response = await fetch(`${API_BASE_URL}/api/tft-match/${region}/${gameName}/${tagLine}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const config = { iron: 1.0, gold: 1.2, challenger: 1.5 };
    const mult = config[difficulty];
    const duoMult = (mode === 'collateral') ? 1.5 : 1.0;

    const pushups = Math.max(5, Math.ceil(data.placement * 2 * mult * duoMult));
    const squats = Math.max(5, Math.ceil(data.traits_active * 2 * mult * duoMult));
    const abs = Math.max(5, Math.ceil(data.last_round * mult * duoMult));

    const board = document.getElementById('workout-board');
    
    // For now, TFT uses Solo template as default but with TFT labels
    renderSoloUI(board, squats, pushups, abs, data);
    
    // Update TFT specific headers
    document.getElementById('player-title').innerText = `Level ${sanitize(data.level)} Tactician`;
    const rankLabel = (localStorage.getItem('preferredLang') === 'fr') ? "TOP" : "RANK";
    document.getElementById('player-kda').innerText = `${rankLabel} ${sanitize(data.placement)} | ${sanitize(data.traits_active)} Traits`;

    let companionImg = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/hextech-images/tft_item_tome_of_traits.png';
    if (data.companion?.content_ID) {
        companionImg = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/companion-icons/${sanitize(data.companion.content_ID.toLowerCase())}.png`;
    }
    board.style.setProperty('--champ-bg', `url('${companionImg}')`);

    updateGameStatus(data.placement <= 4);
    document.getElementById('loading').style.display = 'none';
    board.style.display = 'block';
    updateLanguage();
}

/**
 * ==========================================================================
 * 4. UI RENDERING (Solo vs Duo)
 * ==========================================================================
 */

function renderSoloUI(container, squats, pushups, abs, data) {
    container.innerHTML = `
        <div id="game-status" data-i18n="loss">DÉFAITE</div>
        <h3 id="player-title" style="margin: 0; color: var(--text-main);">${sanitize(data.champion|| 'Champion')}</h3>
        <div class="stats-kda" id="player-kda">KDA : ${sanitize(data.kills)} / ${sanitize(data.morts)} / ${sanitize(data.assists)}</div>
        
        <div class="exercise-grid">
            <div class="exercise-item">
                <div class="ex-num" id="nb-squats">${squats}</div>
                <div class="ex-label" data-i18n="exSquats">Squats (Kills)</div>
            </div>
            <div class="exercise-item">
                <div class="ex-num" id="nb-pompes">${pushups}</div>
                <div class="ex-label" data-i18n="exPushups">Pompes (Morts)</div>
            </div>
            <div class="exercise-item">
                <div class="ex-num" id="nb-abdos">${abs}</div>
                <div class="ex-label" data-i18n="exAbs">Abdos (Assists)</div>
            </div>
        </div>
        <div class="workout-formula">
            <p><i class="info-icon">ⓘ</i> <span data-i18n="formulaDesc">...</span></p>
        </div>
    `;
}

function renderCollateralUI(container, squats, pushups, abs, data) {
    container.innerHTML = `
        <div class="duo-header">
            <img src="../Assets/fist_bump.png" class="duo-emote-mini">
            <div class="duo-title-group">
                <div id="game-status" data-i18n="duoStatus" style="color: #ff00ff;">OBJECTIF DUO</div>
                <h3 id="player-title" style="margin-top: 10px;">${sanitize(data.champion)} (${sanitize(data.role)})</h3>
                <div id="player-kda" class="stats-kda">KDA : ${sanitize(data.kills)} / ${sanitize(data.morts)} / ${sanitize(data.assists)}</div>
            </div>
        </div>
        
        <div class="exercise-grid duo-grid">
            <div class="exercise-item shared">
                <div class="ex-num">${squats}</div>
                <div class="ex-label" data-i18n="sharedSquats">SQUATS PARTAGÉS</div>
            </div>
            <div class="exercise-item shared">
                <div class="ex-num">${pushups}</div>
                <div class="ex-label" data-i18n="sharedPushups">POMPES PARTAGÉES</div>
            </div>
            <div class="exercise-item shared">
                <div class="ex-num">${abs}</div>
                <div class="ex-label" data-i18n="sharedAbs">ABDOS PARTAGÉS</div>
            </div>
        </div>
    `;
}
/**
 * ==========================================================================
 * 5. UTILITIES (Language, Theme, Validity)
 * ==========================================================================
 */

function updateLanguage() {
    const lang = localStorage.getItem('preferredLang') || 'fr';
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = translations[lang]?.[key] || translations['en']?.[key];
        if (text) {
            if (el.tagName === 'INPUT') el.placeholder = text;
            else el.innerHTML = text;
        }
    });
}

function changeLanguage(lang) {
    localStorage.setItem('preferredLang', lang);
    updateLanguage();
}

function setTheme(game) {
    const fitText = document.getElementById('fit-text');
    const gameQuote = document.getElementById('game-quote');

    fitText.classList.remove('color-lol', 'color-tft', 'color-valorant');
    fitText.classList.add(gameThemes[game].colorClass);
    gameQuote.innerText = gameThemes[game].quote;

    localStorage.setItem('selectedGame', game);
}

function updateGameStatus(isWin) {
    const statusDiv = document.getElementById('game-status');
    statusDiv.className = isWin ? "status-win" : "status-loss";
    statusDiv.setAttribute('data-i18n', isWin ? 'win' : 'loss');
}

function checkInputValidity(e) {
    const value = e.target.value.trim();
    
    // Regex : Nom (1-16 car.) # Tag (3-5 car. alphanumériques)
    const riotIdPattern = /^.{1,16}#[a-zA-Z0-9]{3,5}$/;    
    const isValid = riotIdPattern.test(value);    

    const quickTrainBtn = document.getElementById('quick-train-btn');
    const collateralBtn = document.getElementById('collateral-btn');
    
    if (quickTrainBtn && collateralBtn) {
        // .toggle active/désactive la classe selon le booléen 'isValid'
        quickTrainBtn.classList.toggle('disabled-box', !isValid);
        collateralBtn.classList.toggle('disabled-box', !isValid);
    }
}

/**
 * ==========================================================================
 * 6. MODALS MANAGEMENT
 * ==========================================================================
 */

function openOnboarding() { document.getElementById('onboarding-modal').style.display = 'flex'; }
function openAdvices() { document.getElementById('advices-modal').style.display = 'flex'; updateLanguage(); }

function closeOnboarding() { 
    handleModalClose('onboarding-modal', 'about-anchor'); 
    localStorage.setItem('hasSeenOnboarding', 'true');
}

function closeAdvices() { handleModalClose('advices-modal', 'advices-anchor'); }

function handleModalClose(modalId, anchorId) {
    const modal = document.getElementById(modalId);
    const anchor = document.getElementById(anchorId);
    
    if (anchor) {
        const rect = anchor.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        modal.style.transition = "all 0.6s cubic-bezier(0.6, -0.28, 0.735, 0.045)";
        modal.style.transform = `translate(${centerX - window.innerWidth/2}px, ${centerY - window.innerHeight/2}px) scale(0.1)`;
        modal.style.opacity = "0";

        setTimeout(() => {
            modal.style.display = 'none';
            modal.style.transform = "none";
            modal.style.opacity = "1";
        }, 600);
    } else {
        modal.style.display = 'none';
    }
}

function showLegal(type) {
    const modal = document.getElementById('legal-modal');
    const textZone = document.getElementById('legal-text');
    
    if (type === 'mentions') {
        textZone.innerHTML = `<h2>Legal Notices</h2><p><strong>Editor:</strong> QUACH Tri Tin</p><p>ttquachpro@outlook.com</p>`;
    } else {
        textZone.innerHTML = `<h2>Privacy Policy</h2><p>RiftFit does not store personal data.</p>`;
    }
    modal.style.display = 'flex';
}

function closeLegal() { document.getElementById('legal-modal').style.display = "none"; }


function openComingSoon() {
    document.getElementById('coming-soon-modal').style.display = 'flex';
    updateLanguage(); 
}

function closeComingSoon() {
    document.getElementById('coming-soon-modal').style.display = 'none';
}
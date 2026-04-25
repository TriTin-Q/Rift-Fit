// ==========================================
// 1. CONFIGURATION (Dictionnaires)
// ==========================================
const translations = {
    fr: {
        placeholder: "Pseudo#Tag (ex: Hide on bush #KR1)",
        quickTrainTitle: "Entraînement Rapide",
        quickTrainDesc: "Générer un entraînement basé sur le dernier match",
        featCollateral: "Collatéral",
        featCollateralDesc: "Lier plusieurs objectifs fitness",
        loading: "Analyse des données Riot en cours...",
        win: "VICTOIRE",
        loss: "DÉFAITE",
        exSquats: "Squats (Kills)",
        exPushups: "Pompes (Morts)",
        exAbs: "Abdos (Assists)"
    },
    en: {
        placeholder: "Game Name#Tag (ex: Hide on bush #KR1)",
        quickTrainTitle: "Quick Training",
        quickTrainDesc: "Generate a workout based on your last match",
        featCollateral: "Collateral",
        featCollateralDesc: "Link multiple fitness goals",
        loading: "Analyzing Riot data...",
        win: "VICTORY",
        loss: "DEFEAT",
        exSquats: "Squats (Kills)",
        exPushups: "Push-ups (Deaths)",
        exAbs: "Crunches (Assists)"
    },
    // ... j'ai gardé ta structure exacte pour 'es'
};

const gameThemes = {
    lol: { quote: "League of legends", colorClass: "color-lol" },
    tft: { quote: "Teamfight Tactics", colorClass: "color-tft" },
    valorant: { quote: "Valorant", colorClass: "color-valorant" }
};

// ==========================================
// 2. INITIALISATION AU DÉMARRAGE
// ==========================================
// Ce bloc regroupe tout ce qui doit se passer quand la page se charge
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Initialisation de la langue ---
    const savedLang = localStorage.getItem('preferredLang') || 'fr';
    document.getElementById('lang-select').value = savedLang;
    changeLanguage(savedLang);

    // --- Initialisation du thème ---
    const lastGame = localStorage.getItem('selectedGame') || 'lol';
    setTheme(lastGame);

    // --- Écouteurs de clics pour la bannière des jeux ---
    const lolBtn = document.querySelector('.game-item.lol');
    const tftBtn = document.querySelector('.game-item.tft');
    const valoBtn = document.querySelector('.game-item.valorant');

    if(lolBtn) lolBtn.onclick = () => setTheme('lol');
    if(tftBtn) tftBtn.onclick = () => setTheme('tft');
    if(valoBtn) valoBtn.onclick = () => setTheme('valorant');

    // --- Écouteur pour dégriser le bouton d'entraînement ---
    document.getElementById('riotId').addEventListener('input', checkInputValidity);
});

// ==========================================
// 3. FONCTIONS UTILITAIRES (UI)
// ==========================================

function changeLanguage(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (el.tagName === 'INPUT') {
            el.placeholder = translations[lang]?.[key] || translations['en'][key];
        } else {
            el.innerText = translations[lang]?.[key] || translations['en'][key];
        }
    });
    localStorage.setItem('preferredLang', lang);
}

function setTheme(game) {
    const fitText = document.getElementById('fit-text');
    const gameQuote = document.getElementById('game-quote');

    fitText.classList.remove('color-lol', 'color-tft', 'color-valorant');
    fitText.classList.add(gameThemes[game].colorClass);
    gameQuote.innerText = gameThemes[game].quote;

    localStorage.setItem('selectedGame', game);
}

// Vérifie si le format Pseudo#Tag est respecté pour activer le bouton
function checkInputValidity(e) {
    const value = e.target.value.trim();
    const quickTrainBtn = document.getElementById('quick-train-btn');
    
    if (value.includes('#')) {
        const parts = value.split('#');
        if (parts[0].length > 0 && parts[1].length > 0) {
            quickTrainBtn.classList.remove('disabled-box');
            return;
        }
    }
    quickTrainBtn.classList.add('disabled-box');
}

// ==========================================
// 4. CŒUR DU PROGRAMME : API & CALCULS
// ==========================================
async function generateWorkout() {
    const region = document.getElementById('region').value;
    const fullRiotId = document.getElementById('riotId').value.trim();
    
    if (!fullRiotId.includes('#')) return; // Sécurité supplémentaire
    
    const parts = fullRiotId.split('#');
    const gameName = parts[0];
    const tagLine = parts[1];

    const loading = document.getElementById('loading');
    const workoutBoard = document.getElementById('workout-board');
    const gameStatusDiv = document.getElementById('game-status');

    loading.style.display = 'block';
    workoutBoard.style.display = 'none';

    try {
        const response = await fetch(`http://localhost:3000/api/last-match/${region}/${gameName}/${tagLine}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // --- Calculs Sportifs ---
        const multiplicateur = data.victoire ? 0.8 : 1.5;
        const totalSquats = Math.ceil(Math.round((data.kills)) * multiplicateur);
        const totalPompes = Math.ceil(Math.round((data.morts)) * multiplicateur);
        const totalAbdos = Math.ceil(Math.round((data.assists)) * multiplicateur);

        // --- Mise à jour du KDA et de l'image de fond ---
        document.getElementById('player-title').innerText = `${data.champion} (${data.role})`;
        document.getElementById('player-kda').innerText = `KDA : ${data.kills} / ${data.morts} / ${data.assists}`;
        
        let champImageName = data.champion.replace(/['\s.]/g, '');
        if (champImageName === 'Wukong') champImageName = 'MonkeyKing';
        
        workoutBoard.style.setProperty('--champ-bg', `url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champImageName}_0.jpg')`);

        // --- Gestion de la victoire/défaite ---
        const currentLang = localStorage.getItem('preferredLang') || 'fr';
        if (data.victoire) {
            gameStatusDiv.innerText = translations[currentLang].win;
            gameStatusDiv.className = "status-win";
            gameStatusDiv.setAttribute('data-i18n', 'win'); 
        } else {
            gameStatusDiv.innerText = translations[currentLang].loss;
            gameStatusDiv.className = "status-loss";
            gameStatusDiv.setAttribute('data-i18n', 'loss');
        }

        // --- Affichage des résultats ---
        document.getElementById('nb-squats').innerText = totalSquats;
        document.getElementById('nb-pompes').innerText = totalPompes;
        document.getElementById('nb-abdos').innerText = totalAbdos;

        loading.style.display = 'none';
        workoutBoard.style.display = 'block';
        workoutBoard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (error) {
        loading.style.display = 'none';
        alert("Erreur : " + error.message);
    }
}
// ==========================================
// 1. CONFIGURATION (Dictionnaires)
// ==========================================
let translations = {}; // On crée une variable vide qui va recevoir notre JSON

const gameThemes = {
    lol: { quote: "League of legends", colorClass: "color-lol" },
    tft: { quote: "Teamfight Tactics", colorClass: "color-tft" },
    valorant: { quote: "Valorant", colorClass: "color-valorant" }
};

// ==========================================
// 2. INITIALISATION AU DÉMARRAGE
// ==========================================
// Ce bloc regroupe tout ce qui doit se passer quand la page se charge
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- Initialisation de la difficulté ---
    const savedDiff = localStorage.getItem('preferredDiff') || 'gold';
    document.getElementById('difficulty').value = savedDiff;
    
    // On écoute le changement pour sauvegarder
    document.getElementById('difficulty').onchange = (e) => {
        localStorage.setItem('preferredDiff', e.target.value);
    };

    // --- 1. Chargement du fichier JSON ---
    try {
        const response = await fetch('../Assets/translations.json');
        translations = await response.json();
    } catch (error) {
        console.error("Erreur lors du chargement des traductions :", error);
        return; // On arrête tout si on ne trouve pas les textes
    }

    // --- 2. Initialisation de la langue ---
    const savedLang = localStorage.getItem('preferredLang') || 'fr';
    document.getElementById('lang-select').value = savedLang;
    changeLanguage(savedLang); // Maintenant que "translations" est rempli, ça va marcher !

    // --- 3. Initialisation du thème ---
    const lastGame = localStorage.getItem('selectedGame') || 'lol';
    setTheme(lastGame);

    // --- 4. Écouteurs de clics pour la bannière des jeux ---
    const lolBtn = document.querySelector('.game-item.lol');
    const tftBtn = document.querySelector('.game-item.tft');
    const valoBtn = document.querySelector('.game-item.valorant');

    if(lolBtn) lolBtn.onclick = () => setTheme('lol');
    if(tftBtn) tftBtn.onclick = () => setTheme('tft');
    if(valoBtn) valoBtn.onclick = () => setTheme('valorant');

    // --- 5. Écouteur pour dégriser le bouton d'entraînement ---
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


// --- L'AIGUILLEUR (S'active quand on clique sur "Quick Training") ---
async function generateWorkout() {
    const currentGame = localStorage.getItem('selectedGame') || 'lol';
    const userDiff = document.getElementById('difficulty').value; // On lit la difficulté ici
    console.log(JSON.stringify(currentGame));
    // On bloque le bouton s'il manque le #
    const fullRiotId = document.getElementById('riotId').value.trim();
    if (!fullRiotId.includes('#')) return; 

    // On affiche le chargement
    document.getElementById('loading').style.display = 'block';
    document.getElementById('workout-board').style.display = 'none';

    try {
        if (currentGame === 'lol') {
            await generateLoLWorkout(userDiff, fullRiotId);
        } 
        else if (currentGame === 'tft') {
            await generateTFTWorkout(userDiff, fullRiotId);
        }
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        alert("Erreur : " + error.message);
    }
}

// --- LA LOGIQUE LEAGUE OF LEGENDS ---
async function generateLoLWorkout(difficulty, fullRiotId) {
    const region = document.getElementById('region').value;
    const [gameName, tagLine] = fullRiotId.split('#');

    const response = await fetch(`http://localhost:3000/api/last-match/${region}/${gameName}/${tagLine}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    // 1. Réglages de difficulté
    const difficultySettings = {
        iron: { base: 2, ratio: 0.7 },
        gold: { base: 5, ratio: 1.0 },
        challenger: { base: 10, ratio: 2.0 }
    };
    const config = difficultySettings[difficulty];

    // 2. Calculs sportifs LoL
    const multiplicateur = data.victoire ? 0.8 : 1.5;
    const totalSquats = Math.ceil((data.kills <= 1 ? config.base : data.kills) * config.ratio * multiplicateur);
    const totalPompes = Math.ceil((data.morts <= 1 ? config.base : data.morts) * config.ratio * multiplicateur);
    const totalAbdos  = Math.ceil((data.assists <= 1 ? config.base : data.assists) * config.ratio * multiplicateur);

    // 3. Mise à jour de l'UI (Textes, KDA, Image)
    document.getElementById('player-title').innerText = `${data.champion} (${data.role})`;
    document.getElementById('player-kda').innerText = `KDA : ${data.kills} / ${data.morts} / ${data.assists}`;
    
    let champImageName = data.champion.replace(/['\s.]/g, '');
    if (champImageName === 'Wukong') champImageName = 'MonkeyKing';
    document.getElementById('workout-board').style.setProperty('--champ-bg', `url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champImageName}_0.jpg')`);

    // 4. Gestion Victoire/Défaite
    updateGameStatus(data.victoire);

    // 5. Affichage final
    showWorkoutBoard(totalSquats, totalPompes, totalAbdos);
}

// --- LA LOGIQUE TFT ---
async function generateTFTWorkout(difficulty, fullRiotId) {
    const region = document.getElementById('region').value;
    const [gameName, tagLine] = fullRiotId.split('#');

    // 1. Appel à la nouvelle route TFT de ton serveur
    const response = await fetch(`http://localhost:3000/api/tft-match/${region}/${gameName}/${tagLine}`);
    const data = await response.json();
    
    if (data.error) throw new Error(data.error);

    // 2. Réglages de difficulté (Identiques à LoL pour la cohérence)
    const difficultySettings = {
        iron: { base: 2, ratio: 0.5 },
        gold: { base: 5, ratio: 1.0 },
        challenger: { base: 10, ratio: 1.5 }
    };
    const config = difficultySettings[difficulty];

    // 3. Calcul du Multiplicateur selon ton barème (Top 1 à 8)
    let placementMultiplicateur = 1;
    switch (data.placement) {
        case 1: placementMultiplicateur = 0.6; break;
        case 2: placementMultiplicateur = 0.8; break;
        case 3: placementMultiplicateur = 1.0; break;   
        case 4: placementMultiplicateur = 1.0; break;
        case 5: placementMultiplicateur = 1.2; break;
        case 6: placementMultiplicateur = 1.4; break;
        case 7: placementMultiplicateur = 1.4; break;
        case 8: placementMultiplicateur = 1.5; break;
    }

    // 4. Calculs sportifs TFT basés sur tes idées
    // Pompes : Éliminations | Squats : Traits | Abdos : Niveau
    const totalPompes = Math.ceil((config.base - data.players_eliminated + data.traits_active) * config.ratio * placementMultiplicateur * 0.5) <= config.base ? config.base : Math.ceil((config.base - data.players_eliminated + data.traits_active) * config.ratio * placementMultiplicateur * 0.6);
    const totalSquats = Math.ceil((config.base - data.players_eliminated + data.traits_active) * config.ratio * placementMultiplicateur * 0.8) <= config.base ? config.base : Math.ceil((config.base - data.players_eliminated + data.traits_active) * config.ratio * placementMultiplicateur * 0.8);
    const totalAbdos  = Math.ceil((config.base - data.players_eliminated + data.traits_active) * config.ratio * placementMultiplicateur) <= config.base ? config.base : Math.ceil((config.base - data.players_eliminated + data.traits_active) * config.ratio * placementMultiplicateur);

    // 5. Mise à jour de l'UI
    // On affiche le placement au lieu du KDA
    const currentLang = localStorage.getItem('preferredLang') || 'fr';
    const placementText = currentLang === 'fr' ? `TOP ${data.placement}` : `RANK ${data.placement}`;
    
    document.getElementById('player-title').innerText = `Level ${data.level} Tactician`;
    document.getElementById('player-kda').innerText = `${placementText} | ${data.traits_active} Traits`;
    
    // Image de fond : On utilise une image générique de TFT ou de la petite légende si dispo
    document.getElementById('workout-board').style.setProperty('--champ-bg', `url('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/hextech-images/tft_item_tome_of_traits.png')`);

    // 6. Gestion Victoire/Défaite (Victoire si Top <= 4)
    updateGameStatus(data.placement <= 4);

    // 7. Affichage final
    showWorkoutBoard(totalSquats, totalPompes, totalAbdos);
}

// --- FONCTIONS UTILITAIRES POUR LE DASHBOARD ---
function updateGameStatus(isWin) {
    const gameStatusDiv = document.getElementById('game-status');
    const currentLang = localStorage.getItem('preferredLang') || 'fr';

    if (isWin) {
        gameStatusDiv.innerText = translations[currentLang]?.win || "VICTOIRE";
        gameStatusDiv.className = "status-win";
        gameStatusDiv.setAttribute('data-i18n', 'win'); 
    } else {
        gameStatusDiv.innerText = translations[currentLang]?.loss || "DÉFAITE";
        gameStatusDiv.className = "status-loss";
        gameStatusDiv.setAttribute('data-i18n', 'loss');
    }
}

function showWorkoutBoard(squats, pompes, abdos) {
    document.getElementById('nb-squats').innerText = squats;
    document.getElementById('nb-pompes').innerText = pompes;
    document.getElementById('nb-abdos').innerText = abdos;

    const workoutBoard = document.getElementById('workout-board');
    document.getElementById('loading').style.display = 'none';
    workoutBoard.style.display = 'block';
    workoutBoard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
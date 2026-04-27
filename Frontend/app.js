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
        //  else {
        //     await generateValWorkout(userDiff,  fullRiotId);
        // }
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
    // --- CONFIGURATION ÉQUILIBRÉE DES DIFFICULTÉS ---
    const difficultySettings = {
        iron: { mult: 1.0, hint: "Effort : x1.0", maxPushUp : 10, maxElse : 15},
        gold: { mult: 1.2, hint: "Effort : x1.3", maxPushUp : 15, maxElse : 25 },
        challenger: { mult: 1.5, hint: "Effort : x1.5",  maxPushUp : 25, maxElse : 35}
    };
    const config = difficultySettings[difficulty];

    const minReps = 3; // Le minimum syndical pour chaque exercice

    // Multiplicateur Victoire/Défaite (optionnel mais recommandé pour garder le sel du jeu)
    const gameResultMult = data.victoire ? 0.8 : 1.2;

    // Calcul direct : Stat * Difficulté * Résultat
    const calculate = (stat) => {
        const result = Math.ceil(stat * config.mult * gameResultMult);
        return result < minReps ? Math.round(minReps * config.mult * gameResultMult) : result; // On applique le plancher
    };

    const calculateSpecialForPushUp = (stat) => {
        const result = Math.ceil(stat * config.mult * gameResultMult);
        if(result > minReps && result < config.maxPushUp){
             return result;
        } else if(result < minReps) {
            return Math.round(minReps * config.mult * gameResultMult);
        } else {
            return config.maxPushUp
        }
    };

    const totalSquats = calculate(data.kills);
    const totalPompes = calculateSpecialForPushUp(data.morts);
    const totalAbdos  = calculate(data.assists);

    // 3. Mise à jour de l'UI (Textes, KDA, Image)
    document.getElementById('player-title').innerText = `${data.champion} (${data.role})`;
    document.getElementById('player-kda').innerText = `KDA : ${data.kills} / ${data.morts} / ${data.assists}`;
    
    let champImageName = data.champion.replace(/['\s.]/g, '');
    if (champImageName === 'Wukong') champImageName = 'MonkeyKing';
    document.getElementById('workout-board').style.setProperty('--champ-bg', `url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champImageName}_0.jpg')`);

    // 4. Gestion Victoire/Défaite
    updateGameStatus(data.victoire);

    // 5. Affichage final
    showWorkoutBoard(totalSquats, totalPompes, totalAbdos, "lol");
}

// --- LA LOGIQUE TFT ---
async function generateTFTWorkout(difficulty, fullRiotId) {
    const region = document.getElementById('region').value;
    const [gameName, tagLine] = fullRiotId.split('#');


    // 1. Appel à la nouvelle route TFT de ton serveur
    const response = await fetch(`http://localhost:3000/api/tft-match/${region}/${gameName}/${tagLine}`);
    const data = await response.json();
    console.log('data : ' + JSON.stringify(data));
    
    if (data.error) throw new Error(data.error);

    // 2. Réglages de difficulté (Identiques à LoL pour la cohérence)
    const difficultySettings = {
        iron: { base: 2, mult: 1.0, maxPushUp : 10, maxElse : 15 },
        gold: { base: 5, mult: 1.2, maxPushUp : 15, maxElse : 20 },
        challenger: { base: 7, mult: 1.5, maxPushUp : 25, maxElse : 35 }
    };
    const config = difficultySettings[difficulty];

    const rawPompes = (data.placement < config.base ? config.base : data.placement * config.mult);

    const rawSquats = data.traits_active * 1.5;

    // 3. Abdos : La durée de la game (Rounds)
    const rawAbdos = data.last_round / 2;

    // 4. Application de la difficulté et du plancher
    const calculate = (val) => {
        const final = Math.ceil(val * config.mult);
        return Math.max(5, final);
    };

    const totalPompes = calculate(rawPompes);
    const totalSquats = calculate(rawSquats);
    const totalAbdos  = calculate(rawAbdos);

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


    let companionImg = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/hextech-images/tft_item_tome_of_traits.png';
    if (data.companion && data.companion.content_ID) {
        // On construit l'URL de CommunityDragon
        // Note : CommunityDragon utilise souvent les IDs bruts
        companionImg = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/companion-icons/${data.companion.content_ID.toLowerCase()}.png`;
    }

    // On applique l'image au tableau de bord
    const workoutBoard = document.getElementById('workout-board');
    workoutBoard.style.setProperty('--champ-bg', `url('${companionImg}')`);

    // 7. Affichage final
    showWorkoutBoard(totalSquats, totalPompes, totalAbdos, "tft");
}

// --- LA LOGIQUE VALORANT ---
// async function generateValWorkout(difficulty, fullRiotId) {
//     const region = document.getElementById('region').value; // ex: 'eu'
//     const [gameName, tagLine] = fullRiotId.split('#');

//     // On imagine ta route API côté serveur : /api/val-match/
//     const response = await fetch(`http://localhost:3000/api/val-match/${region}/${gameName}/${tagLine}`);
//     const data = await response.json();
//     console.log('data : ' + JSON.stringify(data));
//     console.log('data donnee : ' + region + " ; " + gameName + " ; " + tagLine);
//     console.log('data link : ' + 'http://localhost:3000/api/val-match/'+ region + '/' + gameName + '/'+ tagLine);
//     const difficultySettings = {
//         iron: { base: 2, mult: 1.0, maxPushUp : 10, maxElse : 15 },
//         gold: { base: 5, mult: 1.2, maxPushUp : 15, maxElse : 20 },
//         challenger: { base: 7, mult: 1.5, maxPushUp : 25, maxElse : 35 }
//     };

//     const config = difficultySettings[difficulty];
//     const gameResultMult = data.victoire ? 0.9 : 1.2; // La défaite pique !

//     const calculate = (stat) => Math.max(5, Math.ceil(stat * config.mult * gameResultMult));

//     // --- GESTION DE L'IMAGE DE L'AGENT ---
//     // Riot fournit des portraits via leur API asset. 
//     // Si tu as le nom de l'agent (ex: "Jett"), tu peux utiliser :
//     const agentName = data.agentName.toLowerCase();
//     const agentImg = `https://media.valorant-api.com/agents/${data.agentId}/fullportrait.png`;
    
//     document.getElementById('workout-board').style.setProperty('--champ-bg', `url('${agentImg}')`);

//     // --- MISE À JOUR DES TEXTES ---
//     document.getElementById('player-title').innerText = `${data.agentName} | ${data.map}`;
//     document.getElementById('player-kda').innerText = `KDA : ${data.kills} / ${data.morts} / ${data.assists}`;

//     showWorkoutBoard(calculate(data.kills), calculate(data.morts), calculate(data.assists), 'val');
// }

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

function showWorkoutBoard(squats, pompes, abdos, gameType = 'lol') {
    const lang = localStorage.getItem('preferredLang') || 'fr';
    document.getElementById('nb-squats').innerText = squats;
    document.getElementById('nb-pompes').innerText = pompes;
    document.getElementById('nb-abdos').innerText = abdos;
    console.log("lang : " + lang);
    // 2. Changement des labels selon le jeu
    switch (gameType) {
        case 'tft' : 
            document.getElementById('label-squats').innerText = translations[lang].tftSquats;
            document.getElementById('label-pompes').innerText = translations[lang].tftPushUp;
            document.getElementById('label-abdos').innerText = translations[lang].tftAbs;
            
            // Optionnel : on met aussi à jour le data-i18n pour que le changement de langue futur fonctionne
            document.getElementById('label-squats').setAttribute('data-i18n', 'tftSquats');
            document.getElementById('label-pompes').setAttribute('data-i18n', 'tftPushUp');
            document.getElementById('label-abdos').setAttribute('data-i18n', 'tftAbs');

            document.getElementById('workout-board').style.setProperty('--champ-bg', `url('../Assets/teamfightTactics.jpg')`);
        break;
        case 'lol' :
            document.getElementById('label-squats').innerText = translations[lang].exSquats;
            document.getElementById('label-pompes').innerText = translations[lang].exPushups;
            document.getElementById('label-abdos').innerText = translations[lang].exAbs;

            document.getElementById('label-squats').setAttribute('data-i18n', 'exSquats');
            document.getElementById('label-pompes').setAttribute('data-i18n', 'exPushups');
            document.getElementById('label-abdos').setAttribute('data-i18n', 'exAbs');
        break;
        // case 'valorant':
        //     document.getElementById('label-squats').innerText = translations[lang].exSquatsVAL;
        //     document.getElementById('label-pompes').innerText = translations[lang].exPushupsVAL;
        //     document.getElementById('label-abdos').innerText = translations[lang].exAbsVAL;

        //     document.getElementById('label-squats').setAttribute('data-i18n', 'exSquatsVAL');
        //     document.getElementById('label-pompes').setAttribute('data-i18n', 'exPushupsVAL');
        //     document.getElementById('label-abdos').setAttribute('data-i18n', 'exAbsVAL');
        // break;
    }

    document.getElementById('workout-board').style.display = 'block';
}

// --- GESTION DES MODAUX ---

function openOnboarding() {
    document.getElementById('onboarding-modal').style.display = 'flex';
}

function closeOnboarding() {
    const modal = document.getElementById('onboarding-modal');
    const anchor = document.getElementById('about-anchor');
    
    // Si l'ancre existe, on fait la jolie animation
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
        // Sinon fermeture sèche
        modal.style.display = 'none';
    }

    localStorage.setItem('hasSeenOnboarding', 'true');
}

function showLegal(type) {
    const modal = document.getElementById('legal-modal');
    const textZone = document.getElementById('legal-text');
    
    if (type === 'mentions') {
        textZone.innerHTML = `
            <h2>Legal Notices</h2>
            <p><strong>Éditeur :</strong> QUACH Tri Tin</p>
            <p><strong>Contact :</strong> ttquachpro@outlook.com</p>
            <p><strong>Hébergement :</strong> Hetzner Online GmbH...</p>
            <p>This site is a personal project created for portfolio purposes.</p>
        `;
    } else {
        textZone.innerHTML = `
            <h2>Privacy Policy</h2>
            <p>RiftFit does not store any personal data...</p>
        `;
    }
    modal.style.display = 'flex'; // Activé uniquement au clic
}

function closeLegal() {
    document.getElementById('legal-modal').style.display = "none";
}

// --- INITIALISATION AU CHARGEMENT ---
window.onload = function() {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
        openOnboarding();
    }
    // On s'assure que le legal-modal est bien caché au cas où le CSS bugge
    document.getElementById('legal-modal').style.display = "none";
};
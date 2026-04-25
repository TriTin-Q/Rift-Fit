const translations = {
    fr: {
        placeholder: "Pseudo#Tag (ex: Faker#KR1)",
        quickTrainTitle: "Entraînement Rapide",
        quickTrainDesc: "Générer un entraînement basé sur le dernier match",
        featCollateral: "Collatéral",
        featCollateralDesc: "Lier plusieurs objectifs fitness",
        loading: "Analyse des données Riot en cours...",
        win: "VICTOIRE",
        loss: "DÉFAITE",
        // Nouveaux ajouts pour les exercices
        exSquats: "Squats (Kills)",
        exPushups: "Pompes (Morts)",
        exAbs: "Abdos (Assists)"
    },
    en: {
        placeholder: "Game Name#Tag (ex: Faker#KR1)",
        quickTrainTitle: "Quick Training",
        quickTrainDesc: "Generate a workout based on your last match",
        featCollateral: "Collateral",
        featCollateralDesc: "Link multiple fitness goals",
        loading: "Analyzing Riot data...",
        win: "VICTORY",
        loss: "DEFEAT",
        // Nouveaux ajouts pour les exercices
        exSquats: "Squats (Kills)",
        exPushups: "Push-ups (Deaths)",
        exAbs: "Crunches (Assists)"
    },
    es: {
        placeholder: "ID de Riot#Tag (ej: Faker#KR1)",
        quickTrainTitle: "Entrenamiento Rápido",
        quickTrainDesc: "Generar un entrenamiento basado en el último partido",
        featCollateral: "Colateral",
        featCollateralDesc: "Vincular múltiples objetivos de fitness",
        loading: "Analizando datos de Riot...",
        win: "VICTORIA",
        loss: "DERROTA",
        // Nouveaux ajouts pour les ejercicios
        exSquats: "Sentadillas (Kills)",
        exPushups: "Flexiones (Muertes)",
        exAbs: "Abdominales (Asistencias)"
    }
};
function changeLanguage(lang) {
    // 1. Traduire les textes simples
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        
        // Cas spécial pour le placeholder de l'input
        if (el.tagName === 'INPUT') {
            el.placeholder = translations[lang][key];
        } else {
            el.innerText = translations[lang][key];
        }
    });

    // 2. Optionnel : Sauvegarder le choix dans le navigateur
    localStorage.setItem('preferredLang', lang);
}

// Au chargement de la page : vérifier s'il y a une langue enregistrée
window.onload = () => {
    const savedLang = localStorage.getItem('preferredLang') || 'fr';
    document.getElementById('lang-select').value = savedLang;
    changeLanguage(savedLang);
};

 async function generateWorkout() {
            const region = document.getElementById('region').value;
            const fullRiotId = document.getElementById('riotId').value.trim();
            
            // Séparation automatique du pseudo et du tag
            if (!fullRiotId.includes('#')) {
                alert("N'oublie pas d'ajouter ton Tag ! (ex: Pseudo#1234)");
                return;
            }
            
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

                // Calcul sportif
                const multiplicateur = data.victoire ? 0.8 : 1.5;
                const totalSquats = Math.ceil(Math.round((data.kills)) * multiplicateur);
                const totalPompes = Math.ceil(Math.round((data.morts)) * multiplicateur);
                const totalAbdos = Math.ceil(Math.round((data.assists)) * multiplicateur);

                // Mise à jour de l'UI
                document.getElementById('player-title').innerText = `${data.champion} (${data.role})`;
                document.getElementById('player-kda').innerText = `KDA : ${data.kills} / ${data.morts} / ${data.assists}`;
                
                // On récupère la langue actuelle
                const currentLang = localStorage.getItem('preferredLang') || 'fr';

                if (data.victoire) {
                    gameStatusDiv.innerText = translations[currentLang].win;
                    gameStatusDiv.className = "status-win";
                    // CRUCIAL : On change la clé de traduction pour que changeLanguage() la retrouve
                    gameStatusDiv.setAttribute('data-i18n', 'win'); 
                } else {
                    gameStatusDiv.innerText = translations[currentLang].loss;
                    gameStatusDiv.className = "status-loss";
                    // CRUCIAL : On change la clé de traduction
                    gameStatusDiv.setAttribute('data-i18n', 'loss');
                }

                document.getElementById('nb-squats').innerText = totalSquats;
                document.getElementById('nb-pompes').innerText = totalPompes;
                document.getElementById('nb-abdos').innerText = totalAbdos;

                loading.style.display = 'none';
                workoutBoard.style.display = 'block';

                // Petit bonus UI : scroller doucement vers le résultat
                workoutBoard.scrollIntoView({ behavior: 'smooth', block: 'center' });

            } catch (error) {
                loading.style.display = 'none';
                alert("Erreur : " + error.message);
            }
        }
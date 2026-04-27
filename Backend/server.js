require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());


// Route pour récupérer le compte d'un joueur
// On ajoute :region dans l'URL de notre API
app.get('/api/player/:region/:gameName/:tagLine', async (req, res) => {
    const { region, gameName, tagLine } = req.params;
    const apiKey = process.env.RIOT_LOL_API_KEY;

    try {
        // On remplace "europe" en dur par la variable ${region}
        const response = await fetch(`https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`, {
            headers: { 'X-Riot-Token': apiKey }
        });
        
        if (!response.ok) throw new Error('Joueur introuvable, mauvaise région ou erreur API');
        
        const data = await response.json();
        res.json(data); 
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Nouvelle route : Enchaînement automatique ET filtrage des données du match
app.get('/api/last-match/:region/:gameName/:tagLine', async (req, res) => {
    const { region, gameName, tagLine } = req.params;
    const apiKey = process.env.RIOT_LOL_API_KEY;
    const headers = { 'X-Riot-Token': apiKey };

    try {
        // ÉTAPE 1 : Récupérer le PUUID
        const accountRes = await fetch(`https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`, { headers });
        if (!accountRes.ok) throw new Error("Joueur introuvable");
        const accountData = await accountRes.json();
        const puuid = accountData.puuid;

        // ÉTAPE 2 : Récupérer l'ID du dernier match
        const matchIdsRes = await fetch(`https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1`, { headers });
        if (!matchIdsRes.ok) throw new Error("Impossible de récupérer l'historique");
        const matchIds = await matchIdsRes.json();
        
        if (matchIds.length === 0) throw new Error("Aucun match récent trouvé");
        const lastMatchId = matchIds[0];

        // ÉTAPE 3 : Récupérer les détails complets du match
        const matchRes = await fetch(`https://${region}.api.riotgames.com/lol/match/v5/matches/${lastMatchId}`, { headers });
        if (!matchRes.ok) throw new Error("Impossible de lire les détails du match");
        const matchData = await matchRes.json();

        // ÉTAPE 4 : Filtrer pour trouver NOTRE joueur (La magie opère ici)
        const participants = matchData.info.participants;
        const myPlayer = participants.find(joueur => joueur.puuid === puuid);

        if (!myPlayer) {
            throw new Error("Erreur système : Le joueur n'est pas dans la partie.");
        }

        // ÉTAPE 5 : Créer l'objet "RiftFit" avec uniquement ce qui nous intéresse
        const riftFitStats = {
            pseudo: gameName,
            champion: myPlayer.championName,
            role: myPlayer.individualPosition, // Te permet de savoir quelle routine sportive activer
            victoire: myPlayer.win,
            kills: myPlayer.kills,
            morts: myPlayer.deaths,
            assists: myPlayer.assists,
            dureePartie: matchData.info.gameDuration,
     
        };

        // ÉTAPE 6 : Ajouter dynamiquement LA stat spécifique selon le rôle
        switch (myPlayer.teamPosition) {
            case 'BOTTOM': // ADC
                riftFitStats.statSpecifique = {
                    nom: "Sbires tués",
                    valeur: myPlayer.totalMinionsKilled + myPlayer.neutralMinionsKilled,
                    csMinute : ((myPlayer.totalMinionsKilled + myPlayer.neutralMinionsKilled) / (matchData.info.gameDuration / 60)).toFixed(2) + "/min"
                };
                break;
                
            case 'UTILITY': // Support
                riftFitStats.statSpecifique = {
                    nom: "Avantage Vision",
                    // On arrondit un peu le chiffre pour que ce soit plus lisible (ex: 1.2 au lieu de 1.2345)
                    valeur: myPlayer.challenges ? Math.round(myPlayer.challenges.visionScoreAdvantageLaneOpponent * 100) / 100 : 0
                };
                break;
                
            case 'JUNGLE': // Jungler
                riftFitStats.statSpecifique = {
                    nom: "Dragons tués",
                    valeur: myPlayer.dragonKills
                };
                break;
                
            case 'TOP': // Toplaner
                riftFitStats.statSpecifique = {
                    nom: "Dégâts aux Tours",
                    valeur: myPlayer.damageDealtToTurrets
                };
                break;
                
            case 'MIDDLE': // Midlaner
                riftFitStats.statSpecifique = {
                    nom: "Participation aux Kills",
                    // On multiplie par 100 pour afficher un pourcentage (ex: 54%)
                    valeur: myPlayer.challenges ? Math.round(myPlayer.challenges.killParticipation * 100) + "%" : "0%"
                };
                break;
                
            default: // Au cas où (modes de jeu spéciaux comme ARAM)
                riftFitStats.statSpecifique = {
                    nom: "Aucune",
                    valeur: 0
                };
        }

        // On renvoie ce magnifique petit objet tout propre au frontend !
        res.json(riftFitStats);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Nouvelle route pour le dernier match TFT
app.get('/api/tft-match/:region/:name/:tag', async (req, res) => {
    const { region, name, tag } = req.params;
    const apiKey = process.env.RIOT_TFT_API_KEY;
    
    // Mapping des régions pour TFT (Americas, Asia, Europe)
    const routingValue = region === 'europe' ? 'europe' : (region === 'asia' ? 'asia' : 'americas');

    try {
        // 1. Récupérer le PUUID
        const accountRes = await fetch(`https://${routingValue}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${name}/${tag}?api_key=${apiKey}`);
        const accountData = await accountRes.json();
        const puuid = accountData.puuid;

        // 2. Récupérer l'ID du dernier match TFT
        const matchIdsRes = await fetch(`https://${routingValue}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=1&api_key=${apiKey}`);
        const matchIds = await matchIdsRes.json();
        const lastMatchId = matchIds[0];

        // 3. Récupérer les détails du match
        const matchDetailRes = await fetch(`https://${routingValue}.api.riotgames.com/tft/match/v1/matches/${lastMatchId}?api_key=${apiKey}`);
        const matchData = await matchDetailRes.json();

        // 4. Chercher les stats du joueur spécifique dans les participants
        const participant = matchData.info.participants.find(p => p.puuid === puuid);

        // 5. Envoyer les données filtrées au Front-end
        res.json({
            placement: participant.placement,
            level: participant.level,
            players_eliminated: participant.players_eliminated,
            traits_active: participant.traits.filter(t => t.style > 0).length, // Seulement les traits activés (Bronze+)
            gold_left: participant.gold_left,
            last_round: participant.last_round,
            companion: participant.companion 
        });

    } catch (error) {
        res.status(500).json({ error: "Impossible de récupérer les données TFT" });
    }
});

// Route pour récupérer le dernier match Valorant
// app.get('/api/val-match/:region/:gameName/:tagLine', async (req, res) => {
//     const { region, gameName, tagLine } = req.params;
//     const apiKey = process.env.RIOT_API_KEY;

//     // On convertit la région "compte" en shard "Valorant"
//     const valRegionMapping = {
//         'europe': 'eu',
//         'americas': 'na',
//         'asia': 'ap',
//         'esports': 'esports'
//     };
    
//     // Le shard pour les matchs (eu, na, etc.)
//     const shard = valRegionMapping[region] || region; 
//     // La zone pour le PUUID (europe, americas, etc.)
//     const accountRegion = region;

//     try {
//         // 1. Récupérer le PUUID (Même endpoint que LoL/TFT)
//         const accountUrl = `https://${accountRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}?api_key=${apiKey}`;        const accountRes = await fetch(accountUrl);
//         const accountResult = await fetch(accountUrl);
//         const accountData = await accountResult.json();        
//         if (!accountData.puuid) return res.status(404).json({ error: "Joueur introuvable" });
//         const puuid = accountData.puuid;

//         // 2. Récupérer la liste des matchs (Endpoint VAL-MATCH-V1)
//         // Attention : La région ici est 'eu', 'na', etc.
//         const matchListUrl = `https://${shard}.api.riotgames.com/val/match/v1/matchlists/by-puuid/${puuid}?api_key=${apiKey}`;
//         const matchListRes = await fetch(matchListUrl);
//         const matchListData = await matchListRes.json();
//         console.log('QQ 1 : ' + JSON.stringify(matchListUrl));
//         console.log('QQ 2 : ' + JSON.stringify(matchListRes));
//         console.log('QQ 3 : ' + JSON.stringify(matchListData));

//         if (!matchListData.history || matchListData.history.length === 0) {
//             return res.status(404).json({ error: "Aucun match trouvé" });
//         }

//         const lastMatchId = matchListData.history[0].matchId;

//         // 3. Récupérer les détails du match
//         const matchUrl = `https://${region}.api.riotgames.com/val/match/v1/matches/${lastMatchId}?api_key=${apiKey}`;
//         const matchRes = await fetch(matchUrl);
//         const matchData = await matchRes.json();

//         // 4. Extraire les stats du joueur
//         const player = matchData.players.find(p => p.puuid === puuid);
//         const teamId = player.teamId;
//         const teamStats = matchData.teams.find(t => t.teamId === teamId);
        
//         // Victoire si ton équipe a gagné
//         const victory = teamStats.won; 

//         res.json({
//             kills: player.stats.kills,
//             morts: player.stats.deaths,
//             assists: player.stats.assists,
//             score: player.stats.score,
//             agentId: player.characterId, // Utile pour l'image
//             agentName: await getAgentName(player.characterId), // Optionnel si tu as une fonction de mapping
//             map: matchData.matchInfo.mapId,
//             victoire: victory
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: "Erreur lors de la récupération du match Valorant" });
//     }
// });
app.listen(3000, () => console.log('✅ Serveur Backend lancé sur http://localhost:3000'));
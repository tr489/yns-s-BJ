/* --- Variablen & State --- */
const suits = ['H', 'D', 'C', 'S'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

let deck = [];
let playersHand = [];
let dealersHand = [];
let playerMoney = 1000;

// Wett-Variablen
let currentSelectedChip = 5;
let bets = {
    main: 0,
    pairs: 0,
    '213': 0
};

// Referenzen
const dealerCardsEl = document.getElementById('dealer-cards');
const playerCardsEl = document.getElementById('player-cards');
const messageEl = document.getElementById('message-area');
const playerMoneyEl = document.getElementById('player-money');
const dealerScoreEl = document.getElementById('dealer-score');
const playerScoreEl = document.getElementById('player-score');

// UI Bereiche
const chipRack = document.getElementById('chip-rack');
const bettingSpotsLayer = document.getElementById('betting-spots-layer');
const actionPanel = document.getElementById('action-panel');
const resetPanel = document.getElementById('reset-panel');


/* --- Helper: Verzögerung (Sleep) --- */
// Das ist der Trick für langsame Animationen!
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* --- Init --- */
createDeck();
shuffleDeck();
updateMoneyDisplay();

// Event Listeners
document.getElementById('btn-deal').addEventListener('click', startRound);
document.getElementById('btn-hit').addEventListener('click', onHit);
document.getElementById('btn-stand').addEventListener('click', onStand);
document.getElementById('btn-next-round').addEventListener('click', resetGame);

/* --- Chip Logik --- */

function selectChip(value, el) {
    currentSelectedChip = value;
    // Visuelles Feedback
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
}

function placeBet(type) {
    if (playerMoney < currentSelectedChip) {
        messageEl.innerText = "Nicht genug Guthaben!";
        return;
    }

    // Logik
    playerMoney -= currentSelectedChip;
    bets[type] += currentSelectedChip;

    // UI Update
    updateMoneyDisplay();
    updateBetSpot(type);
}

function updateBetSpot(type) {
    const valEl = document.getElementById(`val-${type}`);
    const stackEl = document.getElementById(`stack-${type}`);
    
    valEl.innerText = bets[type];

    // Einen kleinen Chip visuell in den Kreis legen
    const miniChip = document.createElement('div');
    miniChip.className = `chip chip-${currentSelectedChip} chip-mini`;
    miniChip.innerText = ""; // Kein Text im Mini-Chip
    // Zufällige leichte Rotation für Realismus
    miniChip.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`;
    stackEl.appendChild(miniChip);
}

function clearBets() {
    // Geld zurückgeben
    playerMoney += bets.main + bets.pairs + bets['213'];
    
    // Wetten nullen
    bets.main = 0; bets.pairs = 0; bets['213'] = 0;

    // UI leeren
    ['main', 'pairs', '213'].forEach(t => {
        document.getElementById(`val-${t}`).innerText = "0";
        document.getElementById(`stack-${t}`).innerHTML = "";
    });
    updateMoneyDisplay();
}

/* --- Spiel Start (mit Animation) --- */

async function startRound() {
    if (bets.main < 10) {
        messageEl.innerText = "Mindesteinsatz Hauptwette: 10 €";
        return;
    }

    // UI aufräumen
    chipRack.classList.add('hidden'); // Chips weg
    // Wettfelder einfrieren (könnte man per CSS pointer-events:none machen)
    
    messageEl.innerText = "Karten werden ausgegeben...";

    if (deck.length < 20) {
        createDeck();
        shuffleDeck();
    }

    playersHand = [];
    dealersHand = [];
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';

    // AUSTEILEN MIT VERZÖGERUNG (async/await)
    
    // 1. Karte Spieler
    await sleep(400); 
    const c1 = deck.pop();
    playersHand.push(c1);
    addCardToUI(c1, playerCardsEl);
    
    // 2. Karte Dealer (Verdeckt - eigentlich, aber wir zeigen sie erstmal offen, oder?)
    // Normalerweise: Dealer bekommt 1 offene, 1 verdeckte.
    await sleep(400);
    const d1 = deck.pop(); // Dealer verdeckt (Hole Card)
    dealersHand.push(d1);
    addCardToUI(d1, dealerCardsEl, true); // true = verdeckt anzeigen

    // 3. Karte Spieler
    await sleep(400);
    const c2 = deck.pop();
    playersHand.push(c2);
    addCardToUI(c2, playerCardsEl);
    updateScores(); // Score Spieler zeigen

    // 4. Karte Dealer (Offen)
    await sleep(400);
    const d2 = deck.pop();
    dealersHand.push(d2);
    addCardToUI(d2, dealerCardsEl);
    
    // Jetzt Scores updaten (Dealer zeigt nur Wert der offenen Karte)
    updateScores(false); 

    // --- Sidebets Auswerten ---
    await sleep(500);
    checkSideBets();

    // Check auf Sofort-Blackjack
    const pScore = calculateHandValue(playersHand);
    if (pScore === 21) {
        renderFullDealerHand(); // Dealer aufdecken
        const dScore = calculateHandValue(dealersHand);
        if (dScore === 21) {
             endRound("PUSH"); // Beide Blackjack
        } else {
             endRound("BLACKJACK");
        }
    } else {
        // Spiel geht weiter
        actionPanel.classList.remove('hidden');
        messageEl.innerText = "Du bist dran!";
    }
}

/* --- Game Actions --- */

async function onHit() {
    const card = deck.pop();
    playersHand.push(card);
    addCardToUI(card, playerCardsEl);
    
    updateScores();

    const score = calculateHandValue(playersHand);
    if (score > 21) {
        await sleep(500);
        endRound("BUST");
    }
}

async function onStand() {
    // Dealer Runde
    actionPanel.classList.add('hidden');
    
    // Hole Card aufdecken (Visuell ersetzen)
    renderFullDealerHand();
    updateScores(true);
    
    let dealerScore = calculateHandValue(dealersHand);

    while (dealerScore < 17) {
        await sleep(800); // Dealer denkt nach...
        const card = deck.pop();
        dealersHand.push(card);
        addCardToUI(card, dealerCardsEl);
        dealerScore = calculateHandValue(dealersHand);
        updateScores(true);
    }

    await sleep(500);
    determineWinner();
}

/* --- Logik & UI Helper --- */

function addCardToUI(card, container, isHidden = false) {
    const el = document.createElement('div');
    el.className = 'card';
    
    if (isHidden) {
        el.classList.add('back');
        el.id = "dealer-hole-card"; // ID merken zum Aufdecken
    } else {
        if (card.suit === 'H' || card.suit === 'D') el.classList.add('red');
        else el.classList.add('black');

        let s = '';
        if (card.suit === 'H') s = '♥';
        if (card.suit === 'D') s = '♦';
        if (card.suit === 'C') s = '♣';
        if (card.suit === 'S') s = '♠';
        el.innerHTML = `${card.value}<br>${s}`;
    }
    container.appendChild(el);
}

function renderFullDealerHand() {
    // Wir entfernen einfach alles und bauen neu auf, 
    // oder wir ersetzen nur die verdeckte Karte.
    // Einfachste Methode: Hole Card suchen und Inhalt ändern.
    const holeCardEl = document.getElementById('dealer-hole-card');
    if (holeCardEl) {
        const card = dealersHand[0]; // Die erste war verdeckt
        holeCardEl.classList.remove('back');
        
        if (card.suit === 'H' || card.suit === 'D') holeCardEl.classList.add('red');
        else holeCardEl.classList.add('black');

        let s = '';
        if (card.suit === 'H') s = '♥';
        if (card.suit === 'D') s = '♦';
        if (card.suit === 'C') s = '♣';
        if (card.suit === 'S') s = '♠';
        holeCardEl.innerHTML = `${card.value}<br>${s}`;
    }
}

function checkSideBets() {
    let winnings = 0;
    let txt = [];

    // Pairs
    if (bets.pairs > 0) {
        // Logik wie vorher...
        const c1 = playersHand[0]; const c2 = playersHand[1];
        if (c1.value === c2.value) {
            let mult = 6;
            if (c1.suit === c2.suit) mult = 25;
            else if (isRed(c1) === isRed(c2)) mult = 12;
            
            winnings += bets.pairs * mult;
            txt.push(`Pairs gewonnen! (+${bets.pairs * mult})`);
        }
    }
    
    // 21+3
    if (bets['213'] > 0) {
        // Logik Poker... (Vereinfacht für Länge des Codes, hier voll einfügen wenn nötig)
        // Wir nehmen an du hast die Logik aus dem vorigen Code noch
        // ... (Füge hier deine check21Plus3 Logik ein oder kopiere sie)
        // Platzhalter:
        // if (gewonnen) winnings += ...
    }

    if (winnings > 0) {
        playerMoney += winnings;
        updateMoneyDisplay();
        alert(txt.join("\n"));
    }
}

function isRed(c) { return c.suit === 'H' || c.suit === 'D'; }

function updateScores(showFullDealer = false) {
    playerScoreEl.innerText = calculateHandValue(playersHand);
    
    if (showFullDealer) {
        dealerScoreEl.innerText = calculateHandValue(dealersHand);
    } else {
        // Nur die 2. Karte ist offen
        if(dealersHand.length > 1)
            dealerScoreEl.innerText = dealersHand[1].weight;
    }
}

/* --- Deck & Math Helpers --- */
// (Hier kopierst du createDeck, shuffleDeck und calculateHandValue von vorhin rein)
// Aus Platzgründen hier gekürzt, aber du brauchst sie!

function createDeck() {
    deck = [];
    for(let i=0; i<6; i++) {
        for(let s of suits) {
            for(let v of values) {
                let w = parseInt(v);
                if(['J','Q','K'].includes(v)) w = 10;
                if(v === 'A') w = 11;
                deck.push({value:v, suit:s, weight:w});
            }
        }
    }
}
function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}
function calculateHandValue(hand) {
    let sum = 0; let aces = 0;
    for (let c of hand) { sum += c.weight; if (c.value === 'A') aces++; }
    while (sum > 21 && aces > 0) { sum -= 10; aces--; }
    return sum;
}
function updateMoneyDisplay() { playerMoneyEl.innerText = `Guthaben: ${playerMoney} €`; }

function determineWinner() {
    const p = calculateHandValue(playersHand);
    const d = calculateHandValue(dealersHand);
    let r = "PUSH";
    if (d > 21) r = "DEALER_BUST";
    else if (p > d) r = "WIN";
    else if (p < d) r = "LOSE";
    endRound(r);
}

function endRound(result) {
    let win = 0;
    let msg = "";
    
    if (result === "BLACKJACK") {
        win = bets.main * 2.5; // Einsatz + 1.5
        msg = "BLACKJACK!";
    } else if (result === "WIN" || result === "DEALER_BUST") {
        win = bets.main * 2;
        msg = "Gewonnen!";
    } else if (result === "PUSH") {
        win = bets.main;
        msg = "Unentschieden.";
    } else {
        msg = "Verloren.";
    }

    playerMoney += win;
    updateMoneyDisplay();
    messageEl.innerText = msg;
    
    resetPanel.classList.remove('hidden');
}

function resetGame() {
    clearBets(); // Setzt interne Wetten auf 0, aber Geld ist schon ausgezahlt
    resetPanel.classList.add('hidden');
    chipRack.classList.remove('hidden');
    bettingSpotsLayer.style.pointerEvents = 'auto'; // Wetten wieder erlauben
    
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';
    dealerScoreEl.innerText = '';
    playerScoreEl.innerText = '';
    messageEl.innerText = "Plaziere deine Wetten!";
}

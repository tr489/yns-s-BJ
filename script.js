/* ==========================================
   1. VARIABLEN & STATE
   ========================================== */
const suits = ['H', 'D', 'C', 'S'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
let isGameActive = true; // <--- NEU: Verhindert Klicks zur falschen Zeit
let deck = [];
let playersHand = [];
let dealersHand = [];
let playerMoney = 1000;
let currentSelectedChip = 5; // Standard-Chip

// Speichert die aktuellen Einsätze
let bets = {
    main: 0,
    pairs: 0,
    '213': 0 // '213' steht für 21+3
};

// HTML Elemente referenzieren
const dealerCardsEl = document.getElementById('dealer-cards');
const playerCardsEl = document.getElementById('player-cards');
const dealerScoreEl = document.getElementById('dealer-score');
const playerScoreEl = document.getElementById('player-score');
const messageEl = document.getElementById('message-area');
const playerMoneyEl = document.getElementById('player-money');

const chipRack = document.getElementById('chip-rack');
const bettingSpotsLayer = document.getElementById('betting-spots-layer');
const actionPanel = document.getElementById('action-panel');
const resetPanel = document.getElementById('reset-panel');

/* ==========================================
   2. INITIALISIERUNG & EVENT LISTENERS
   ========================================== */

// Buttons verbinden
document.getElementById('btn-deal').addEventListener('click', startRound);
document.getElementById('btn-hit').addEventListener('click', onHit);
document.getElementById('btn-stand').addEventListener('click', onStand);
document.getElementById('btn-next-round').addEventListener('click', resetGame);

// Start-Setup
createDeck();
shuffleDeck();
updateMoneyDisplay();

/* ==========================================
   3. CHIP & WETT LOGIK
   ========================================== */

// Wird aufgerufen, wenn man unten auf einen Chip klickt
function selectChip(value, el) {
    currentSelectedChip = value;
    
    // Visuelles Feedback: Alle Chips deselektieren, dann den geklickten markieren
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
}

// Wird aufgerufen, wenn man auf einen Wett-Kreis (Spot) klickt
function placeBet(type) {
    // Prüfen, ob das Spiel schon läuft (Chips sind dann ausgeblendet)
    if (chipRack.classList.contains('hidden')) return;

    if (playerMoney < currentSelectedChip) {
        messageEl.innerText = "Nicht genug Guthaben!";
        return;
    }

    // Geld abziehen und Wette erhöhen
    playerMoney -= currentSelectedChip;
    bets[type] += currentSelectedChip;

    updateMoneyDisplay();
    updateBetSpotUI(type);
}

// Zeigt den Chip visuell im Kreis an
function updateBetSpotUI(type) {
    const valEl = document.getElementById(`val-${type}`);
    const stackEl = document.getElementById(`stack-${type}`);
    
    // Zahlenwert updaten
    valEl.innerText = bets[type];

    // Einen kleinen Mini-Chip in den Stack legen
    const miniChip = document.createElement('div');
    miniChip.className = `chip chip-${currentSelectedChip} chip-mini`;
    
    // Zufällige Rotation für Realismus
    const randomRot = Math.floor(Math.random() * 360);
    miniChip.style.transform = `translate(-50%, -50%) rotate(${randomRot}deg)`;
    
    stackEl.appendChild(miniChip);
}

function clearBets() {
    // Geld zurückerstatten
    playerMoney += bets.main + bets.pairs + bets['213'];
    
    // Wetten zurücksetzen
    bets.main = 0;
    bets.pairs = 0;
    bets['213'] = 0;

    // UI bereinigen
    ['main', 'pairs', '213'].forEach(type => {
        document.getElementById(`val-${type}`).innerText = "0";
        document.getElementById(`stack-${type}`).innerHTML = "";
    });
    
    updateMoneyDisplay();
    messageEl.innerText = "Einsätze gelöscht.";
}

/* ==========================================
   4. SPIEL ABLAUF (MIT ANIMATION)
   ========================================== */

// Hilfsfunktion für "Warten" (Sleep)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startRound() {
    // Mindesteinsatz prüfen
    if (bets.main < 10) {
        messageEl.innerText = "Bitte mindestens 10 € auf die Hauptwette setzen!";
        return;
    }

    // UI vorbereiten
    chipRack.classList.add('hidden'); // Chips ausblenden
    messageEl.innerText = "Karten werden ausgegeben...";
    
    // Deck prüfen
    if (deck.length < 20) {
        createDeck();
        shuffleDeck();
        messageEl.innerText = "Deck wird neu gemischt...";
        await sleep(1000);
    }

    // Hände leeren
    playersHand = [];
    dealersHand = [];
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';

    // -- AUSTEILEN --
    
    // 1. Spieler
    await sleep(400);
    const p1 = deck.pop();
    playersHand.push(p1);
    addCardToUI(p1, playerCardsEl);

    // 2. Dealer (Verdeckt)
    await sleep(400);
    const d1 = deck.pop();
    dealersHand.push(d1);
    addCardToUI(d1, dealerCardsEl, true); // true = verdeckt

    // 3. Spieler
    await sleep(400);
    const p2 = deck.pop();
    playersHand.push(p2);
    addCardToUI(p2, playerCardsEl);
    
    // Score update
    playerScoreEl.innerText = calculateHandValue(playersHand);

    // 4. Dealer (Offen)
    await sleep(400);
    const d2 = deck.pop();
    dealersHand.push(d2);
    addCardToUI(d2, dealerCardsEl);
    
    // Dealer Score (nur offene Karte)
    dealerScoreEl.innerText = d2.weight;

    // -- SIDEBETS PRÜFEN --
    await sleep(500);
    checkSideBets();

    // -- BLACKJACK PRÜFEN --
    const pScore = calculateHandValue(playersHand);
    if (pScore === 21) {
        // Spieler hat sofort 21
        renderFullDealerHand(); // Dealer aufdecken
        const dScore = calculateHandValue(dealersHand);
        
        await sleep(500);
        if (dScore === 21) {
            endRound("PUSH");
        } else {
            endRound("BLACKJACK");
        }
    } else {
        // Spiel geht weiter
        actionPanel.classList.remove('hidden');
        messageEl.innerText = "Du bist dran: Hit oder Stand?";
    }
}

async function onHit() {
    // 1. Prüfen: Darf der Spieler überhaupt klicken?
    if (!isGameActive) return; 

    // 2. Sofort sperren, damit man nicht spammen kann während die Karte fliegt
    isGameActive = true; 

    const card = deck.pop();
    playersHand.push(card);
    addCardToUI(card, playerCardsEl);
    
    // Kurz warten für Animation
    await sleep(300);

    const score = calculateHandValue(playersHand);
    playerScoreEl.innerText = score;

    if (score > 21) {
        // Spieler ist raus -> Runde beenden
        await sleep(500);
        endRound("BUST");
    } else {
        // Spieler darf weitermachen -> Buttons wieder freigeben
        isGameActive = true; 
    }
}

async function onStand() {
   if (!isGameActive) return; // Sicherheits-Check
    isGameActive = false;      // <--- NEU: Sofort sperren, Dealer ist dran
   actionPanel.classList.add('hidden');
    messageEl.innerText = "Dealer ist am Zug...";

    // Dealer Karte aufdecken
    renderFullDealerHand();
    let dScore = calculateHandValue(dealersHand);
    dealerScoreEl.innerText = dScore;
    await sleep(800);

    // Dealer muss ziehen bis 17
    while (dScore < 17) {
        const card = deck.pop();
        dealersHand.push(card);
        addCardToUI(card, dealerCardsEl);
        
        dScore = calculateHandValue(dealersHand);
        dealerScoreEl.innerText = dScore;
        await sleep(800);
    }

    determineWinner();
}

/* ==========================================
   5. LOGIK: SIDEBETS & GEWINNER
   ========================================== */

function checkSideBets() {
    let winnings = 0;
    let messages = [];

    // --- Perfect Pairs ---
    if (bets.pairs > 0) {
        const c1 = playersHand[0];
        const c2 = playersHand[1];
        let winAmount = 0;

        if (c1.value === c2.value) {
            // Werte gleich -> Gewinn! Aber wie viel?
            if (c1.suit === c2.suit) {
                winAmount = bets.pairs * 25; // Perfect Pair
                messages.push("Perfect Pair! (25:1)");
            } else if (isRed(c1) === isRed(c2)) {
                winAmount = bets.pairs * 12; // Coloured Pair
                messages.push("Coloured Pair! (12:1)");
            } else {
                winAmount = bets.pairs * 6;  // Mixed Pair
                messages.push("Mixed Pair! (6:1)");
            }
        }
        winnings += winAmount;
    }

    // --- 21+3 (Poker) ---
    if (bets['213'] > 0) {
        // Spieler Karten + Dealer offene Karte
        const p1 = playersHand[0];
        const p2 = playersHand[1];
        const d1 = dealersHand[1]; // Die offene Karte
        
        const winAmount = checkPokerLogic(p1, p2, d1, bets['213']);
        if (winAmount > 0) {
            winnings += winAmount;
            messages.push(`21+3 Gewonnen! (+${winAmount}€)`);
        }
    }

    if (winnings > 0) {
        playerMoney += winnings;
        updateMoneyDisplay();
        alert("SIDEBET GEWINN:\n" + messages.join("\n"));
    }
}

function checkPokerLogic(c1, c2, c3, bet) {
    const hand = [c1, c2, c3];
    
    // Sortieren für Straße
    const ranks = hand.map(c => {
        if (c.value === 'J') return 11;
        if (c.value === 'Q') return 12;
        if (c.value === 'K') return 13;
        if (c.value === 'A') return 14;
        return parseInt(c.value);
    }).sort((a,b) => a-b);
    
    const suitsArr = hand.map(c => c.suit);
    
    // Prüfungen
    const isFlush = (suitsArr[0] === suitsArr[1] && suitsArr[1] === suitsArr[2]);
    const isStraight = (ranks[0]+1 === ranks[1] && ranks[1]+1 === ranks[2]);
    const isTrips = (ranks[0] === ranks[1] && ranks[1] === ranks[2]);

    if (isFlush && isStraight) return bet * 40; // Straight Flush
    if (isTrips) return bet * 30;               // Drilling
    if (isStraight) return bet * 10;            // Straße
    if (isFlush) return bet * 5;                // Flush

    return 0;
}

function determineWinner() {
    const pScore = calculateHandValue(playersHand);
    const dScore = calculateHandValue(dealersHand);
    let result = "PUSH";

    if (dScore > 21) {
        result = "DEALER_BUST";
    } else if (pScore > dScore) {
        result = "WIN";
    } else if (pScore < dScore) {
        result = "LOSE";
    }
    
    endRound(result);
}

function endRound(result) {
    let win = 0;
    let msg = "";

    switch(result) {
        case "BLACKJACK":
            win = bets.main * 2.5; // Einsatz + 1.5x
            msg = "BLACKJACK! (3:2 Auszahlung)";
            break;
        case "WIN":
        case "DEALER_BUST":
            win = bets.main * 2; // Einsatz x 2
            msg = "GEWONNEN!";
            break;
        case "PUSH":
            win = bets.main; // Einsatz zurück
            msg = "UNENTSCHIEDEN (Push)";
            break;
        default: // BUST oder LOSE
            msg = "VERLOREN.";
            break;
    }

    if (win > 0) playerMoney += win;
    
    updateMoneyDisplay();
    messageEl.innerText = msg;
    resetPanel.classList.remove('hidden');
}

function resetGame() {
    // UI resetten
    clearBets(); // Setzt interne Wetten auf 0
    resetPanel.classList.add('hidden');
    chipRack.classList.remove('hidden');
    
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';
    dealerScoreEl.innerText = '';
    playerScoreEl.innerText = '';
    messageEl.innerText = "Plaziere deine Wetten!";
}

/* ==========================================
   6. HELPER FUNKTIONEN (Deck, UI, Math)
   ========================================== */

function createDeck() {
    deck = [];
    // 6 Decks
    for(let i=0; i<6; i++) {
        for(let s of suits) {
            for(let v of values) {
                let w = parseInt(v);
                if(v === 'J' || v === 'Q' || v === 'K') w = 10;
                if(v === 'A') w = 11;
                deck.push({value: v, suit: s, weight: w});
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
    let sum = 0;
    let aces = 0;
    for (let c of hand) {
        sum += c.weight;
        if (c.value === 'A') aces++;
    }
    while (sum > 21 && aces > 0) {
        sum -= 10;
        aces--;
    }
    return sum;
}

function isRed(card) {
    return (card.suit === 'H' || card.suit === 'D');
}

function updateMoneyDisplay() {
    playerMoneyEl.innerText = `Guthaben: ${playerMoney} €`;
}

// Erstellt das HTML für eine Karte
function addCardToUI(card, container, isHidden = false) {
    const el = document.createElement('div');
    el.className = 'card';

    if (isHidden) {
        el.classList.add('back');
        el.id = 'dealer-hole-card'; // ID merken zum Aufdecken
    } else {
        if (isRed(card)) el.classList.add('red');
        else el.classList.add('black');

        let sSymbol = '';
        if (card.suit === 'H') sSymbol = '♥';
        if (card.suit === 'D') sSymbol = '♦';
        if (card.suit === 'C') sSymbol = '♣';
        if (card.suit === 'S') sSymbol = '♠';

        el.innerHTML = `${card.value}<br>${sSymbol}`;
    }
    // Animation wird durch CSS Klasse .card ausgelöst
    container.appendChild(el);
}

// Deckt die verdeckte Dealer-Karte visuell auf
function renderFullDealerHand() {
    const holeCardEl = document.getElementById('dealer-hole-card');
    if (holeCardEl && dealersHand[0]) {
        const card = dealersHand[0];
        holeCardEl.classList.remove('back');
        
        if (isRed(card)) holeCardEl.classList.add('red');
        else holeCardEl.classList.add('black');

        let sSymbol = '';
        if (card.suit === 'H') sSymbol = '♥';
        if (card.suit === 'D') sSymbol = '♦';
        if (card.suit === 'C') sSymbol = '♣';
        if (card.suit === 'S') sSymbol = '♠';

        holeCardEl.innerHTML = `${card.value}<br>${sSymbol}`;
    }
}

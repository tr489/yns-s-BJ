/* ==========================================
   1. VARIABLEN & STATE
   ========================================== */
const suits = ['H', 'D', 'C', 'S'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

let deck = [];
let playersHand = [];
let dealersHand = [];
let playerMoney = 1000;
let currentSelectedChip = 5;

// FIX: Diese Variable steuert, ob Buttons klickbar sind
let isGameActive = false; 

let bets = {
    main: 0,
    pairs: 0,
    '213': 0
};

// HTML Elemente
const dealerCardsEl = document.getElementById('dealer-cards');
const playerCardsEl = document.getElementById('player-cards');
const dealerScoreEl = document.getElementById('dealer-score');
const playerScoreEl = document.getElementById('player-score');
const messageEl = document.getElementById('message-area');
const playerMoneyEl = document.getElementById('player-money');

const chipRack = document.getElementById('chip-rack');
const actionPanel = document.getElementById('action-panel');
const resetPanel = document.getElementById('reset-panel');

/* ==========================================
   2. INITIALISIERUNG
   ========================================== */

document.getElementById('btn-deal').addEventListener('click', startRound);
document.getElementById('btn-hit').addEventListener('click', onHit);
document.getElementById('btn-stand').addEventListener('click', onStand);
document.getElementById('btn-next-round').addEventListener('click', resetGame);

createDeck();
shuffleDeck();
updateMoneyDisplay();

/* ==========================================
   3. CHIP & WETT LOGIK
   ========================================== */

function selectChip(value, el) {
    currentSelectedChip = value;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
}

function placeBet(type) {
    if (chipRack.classList.contains('hidden')) return;

    if (playerMoney < currentSelectedChip) {
        messageEl.innerText = "Nicht genug Guthaben!";
        return;
    }

    playerMoney -= currentSelectedChip;
    bets[type] += currentSelectedChip;

    updateMoneyDisplay();
    updateBetSpotUI(type);
}

function updateBetSpotUI(type) {
    const valEl = document.getElementById(`val-${type}`);
    const stackEl = document.getElementById(`stack-${type}`);
    valEl.innerText = bets[type];

    const miniChip = document.createElement('div');
    miniChip.className = `chip chip-${currentSelectedChip} chip-mini`;
    const randomRot = Math.floor(Math.random() * 360);
    miniChip.style.transform = `translate(-50%, -50%) rotate(${randomRot}deg)`;
    stackEl.appendChild(miniChip);
}

function clearBets() {
    playerMoney += bets.main + bets.pairs + bets['213'];
    bets.main = 0; bets.pairs = 0; bets['213'] = 0;
    
    ['main', 'pairs', '213'].forEach(type => {
        document.getElementById(`val-${type}`).innerText = "0";
        document.getElementById(`stack-${type}`).innerHTML = "";
    });
    updateMoneyDisplay();
    messageEl.innerText = "Einsätze gelöscht.";
}

/* ==========================================
   4. SPIEL ABLAUF
   ========================================== */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startRound() {
    if (bets.main < 10) {
        messageEl.innerText = "Mindesteinsatz Hauptwette: 10 €";
        return;
    }

    // FIX: Spiel sperren während ausgeteilt wird
    isGameActive = false;

    chipRack.classList.add('hidden');
    messageEl.innerText = "Karten werden ausgegeben...";
    
    if (deck.length < 20) {
        createDeck();
        shuffleDeck();
    }

    playersHand = [];
    dealersHand = [];
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';

    // Austeilen
    await sleep(400);
    const p1 = deck.pop(); playersHand.push(p1); addCardToUI(p1, playerCardsEl);

    await sleep(400);
    const d1 = deck.pop(); dealersHand.push(d1); addCardToUI(d1, dealerCardsEl, true);

    await sleep(400);
    const p2 = deck.pop(); playersHand.push(p2); addCardToUI(p2, playerCardsEl);
    playerScoreEl.innerText = calculateHandValue(playersHand);

    await sleep(400);
    const d2 = deck.pop(); dealersHand.push(d2); addCardToUI(d2, dealerCardsEl);
    dealerScoreEl.innerText = d2.weight;

    // Sidebets
    await sleep(500);
    checkSideBets();

    // Blackjack Check
    const pScore = calculateHandValue(playersHand);
    if (pScore === 21) {
        renderFullDealerHand();
        const dScore = calculateHandValue(dealersHand);
        await sleep(500);
        if (dScore === 21) endRound("PUSH");
        else endRound("BLACKJACK");
    } else {
        // Spiel geht weiter
        actionPanel.classList.remove('hidden');
        messageEl.innerText = "Du bist dran: Hit oder Stand?";
        
        // FIX: HIER wird das Spiel freigegeben! Das fehlte vielleicht vorher.
        isGameActive = true; 
    }
}

async function onHit() {
    // FIX: Wenn Spiel nicht aktiv (oder Animation läuft), Abbruch
    if (!isGameActive) return;

    // FIX: Sofort sperren, damit man nicht doppelklickt
    isGameActive = false;

    const card = deck.pop();
    playersHand.push(card);
    addCardToUI(card, playerCardsEl);
    
    const score = calculateHandValue(playersHand);
    playerScoreEl.innerText = score;

    if (score > 21) {
        await sleep(500);
        endRound("BUST");
    } else {
        // FIX: Spiel wieder freigeben, da man noch nicht verloren hat
        // Kleines Delay damit man nicht zu hektisch klickt
        await sleep(300); 
        isGameActive = true;
    }
}

async function onStand() {
    if (!isGameActive) return;
    isGameActive = false; // Spielzug vorbei, sofort sperren

    actionPanel.classList.add('hidden');
    messageEl.innerText = "Dealer ist am Zug...";

    renderFullDealerHand();
    let dScore = calculateHandValue(dealersHand);
    dealerScoreEl.innerText = dScore;
    await sleep(800);

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
   5. LOGIK & HELPER
   ========================================== */

function checkSideBets() {
    let winnings = 0;
    let messages = [];

    // Pairs
    if (bets.pairs > 0) {
        const c1 = playersHand[0]; const c2 = playersHand[1];
        if (c1.value === c2.value) {
            let mult = 6;
            if (c1.suit === c2.suit) mult = 25;
            else if (isRed(c1) === isRed(c2)) mult = 12;
            winnings += bets.pairs * mult;
            messages.push(`Perfect Pair! (+${bets.pairs * mult}€)`);
        }
    }

    // 21+3
    if (bets['213'] > 0) {
        const win = checkPokerLogic(playersHand[0], playersHand[1], dealersHand[1], bets['213']);
        if (win > 0) {
            winnings += win;
            messages.push(`21+3 Gewonnen! (+${win}€)`);
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
    const ranks = hand.map(c => {
        if (c.value === 'J') return 11; if (c.value === 'Q') return 12;
        if (c.value === 'K') return 13; if (c.value === 'A') return 14;
        return parseInt(c.value);
    }).sort((a,b) => a-b);
    const suitsArr = hand.map(c => c.suit);
    
    const isFlush = (suitsArr[0] === suitsArr[1] && suitsArr[1] === suitsArr[2]);
    const isStraight = (ranks[0]+1 === ranks[1] && ranks[1]+1 === ranks[2]);
    const isTrips = (ranks[0] === ranks[1] && ranks[1] === ranks[2]);

    if (isFlush && isStraight) return bet * 40;
    if (isTrips) return bet * 30;
    if (isStraight) return bet * 10;
    if (isFlush) return bet * 5;
    return 0;
}

function determineWinner() {
    const pScore = calculateHandValue(playersHand);
    const dScore = calculateHandValue(dealersHand);
    let result = "PUSH";

    if (dScore > 21) result = "DEALER_BUST";
    else if (pScore > dScore) result = "WIN";
    else if (pScore < dScore) result = "LOSE";
    
    endRound(result);
}

function endRound(result) {
    isGameActive = false; // Sicherstellen dass alles gesperrt ist
    let win = 0;
    let msg = "";

    switch(result) {
        case "BLACKJACK": win = bets.main * 2.5; msg = "BLACKJACK!"; break;
        case "WIN": 
        case "DEALER_BUST": win = bets.main * 2; msg = "GEWONNEN!"; break;
        case "PUSH": win = bets.main; msg = "UNENTSCHIEDEN"; break;
        default: msg = "VERLOREN."; break;
    }

    if (win > 0) playerMoney += win;
    updateMoneyDisplay();
    messageEl.innerText = msg;
    resetPanel.classList.remove('hidden');
}

function resetGame() {
    clearBets();
    resetPanel.classList.add('hidden');
    chipRack.classList.remove('hidden');
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';
    dealerScoreEl.innerText = '';
    playerScoreEl.innerText = '';
    messageEl.innerText = "Plaziere deine Wetten!";
}

// Helper
function createDeck() {
    deck = [];
    for(let i=0; i<6; i++) {
        for(let s of suits) {
            for(let v of values) {
                let w = parseInt(v);
                if(['J','Q','K'].includes(v)) w = 10;
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
    let sum = 0; let aces = 0;
    for (let c of hand) { sum += c.weight; if (c.value === 'A') aces++; }
    while (sum > 21 && aces > 0) { sum -= 10; aces--; }
    return sum;
}
function isRed(card) { return (card.suit === 'H' || card.suit === 'D'); }
function updateMoneyDisplay() { playerMoneyEl.innerText = `Guthaben: ${playerMoney} €`; }

function addCardToUI(card, container, isHidden = false) {
    const el = document.createElement('div');
    el.className = 'card';
    if (isHidden) {
        el.classList.add('back');
        el.id = 'dealer-hole-card';
    } else {
        if (isRed(card)) el.classList.add('red');
        else el.classList.add('black');
        let s = '';
        if (card.suit === 'H') s = '♥'; if (card.suit === 'D') s = '♦';
        if (card.suit === 'C') s = '♣'; if (card.suit === 'S') s = '♠';
        el.innerHTML = `${card.value}<br>${s}`;
    }
    container.appendChild(el);
}

function renderFullDealerHand() {
    const holeCardEl = document.getElementById('dealer-hole-card');
    if (holeCardEl && dealersHand[0]) {
        const card = dealersHand[0];
        holeCardEl.classList.remove('back');
        if (isRed(card)) holeCardEl.classList.add('red');
        else holeCardEl.classList.add('black');
        let s = '';
        if (card.suit === 'H') s = '♥'; if (card.suit === 'D') s = '♦';
        if (card.suit === 'C') s = '♣'; if (card.suit === 'S') s = '♠';
        holeCardEl.innerHTML = `${card.value}<br>${s}`;
    }
}

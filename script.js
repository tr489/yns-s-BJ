/* --- Variablen & Konstanten --- */
const suits = ['H', 'D', 'C', 'S']; // Hearts, Diamonds, Clubs, Spades
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Wir spielen mit 6 Decks, damit "Perfect Pairs" möglich sind
let deck = [];
let playersHand = [];
let dealersHand = [];
let playerMoney = 1000;

// UI Elemente referenzieren
const dealerCardsEl = document.getElementById('dealer-cards');
const playerCardsEl = document.getElementById('player-cards');
const dealerScoreEl = document.getElementById('dealer-score');
const playerScoreEl = document.getElementById('player-score');
const messageEl = document.getElementById('message-area');
const playerMoneyEl = document.getElementById('player-money');

const bettingPanel = document.getElementById('betting-panel');
const actionPanel = document.getElementById('action-panel');
const resetPanel = document.getElementById('reset-panel');

const inputMain = document.getElementById('bet-main');
const inputPairs = document.getElementById('bet-pairs');
const input21Plus3 = document.getElementById('bet-21plus3');

/* --- Event Listeners --- */
document.getElementById('btn-deal').addEventListener('click', startRound);
document.getElementById('btn-next-round').addEventListener('click', resetGameUI);
document.getElementById('btn-hit').addEventListener('click', onHit);
document.getElementById('btn-stand').addEventListener('click', onStand);


/* --- Deck Funktionen --- */

function createDeck() {
    deck = [];
    // 6 Decks zusammenmischen
    for (let i = 0; i < 6; i++) {
        for (let suit of suits) {
            for (let value of values) {
                // Gewichtung: Bildkarten = 10, Ass = 11
                let weight = parseInt(value);
                if (value === 'J' || value === 'Q' || value === 'K') weight = 10;
                if (value === 'A') weight = 11;
                
                // Karte erstellen
                deck.push({ value, suit, weight });
            }
        }
    }
}

function shuffleDeck() {
    // Fisher-Yates Shuffle Algorithmus
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

/* --- Kern-Spiellogik --- */

function startRound() {
    // 1. Einsätze validieren
    const betMain = parseInt(inputMain.value) || 0;
    const betPairs = parseInt(inputPairs.value) || 0;
    const bet213 = parseInt(input21Plus3.value) || 0;
    const totalBet = betMain + betPairs + bet213;

    if (totalBet > playerMoney) {
        messageEl.innerText = "Nicht genug Guthaben!";
        return;
    }
    
    if (betMain < 10) {
        messageEl.innerText = "Mindesteinsatz Hauptwette ist 10 €";
        return;
    }

    // Geld abziehen
    playerMoney -= totalBet;
    updateMoneyDisplay();

    // 2. Deck vorbereiten (Wenn leer, neu mischen)
    if (deck.length < 20) {
        createDeck();
        shuffleDeck();
        messageEl.innerText = "Deck wird neu gemischt...";
    }

    // 3. Karten austeilen
    playersHand = [deck.pop(), deck.pop()];
    dealersHand = [deck.pop(), deck.pop()];

    // 4. UI aktualisieren
    renderTable(false); // false = Dealer Karte noch verdeckt

    // 5. SIDEBETS Auswerten
    let winnings = 0;
    let messages = [];

    // Check Perfect Pairs
    if (betPairs > 0) {
        const winPairs = checkPerfectPairs(playersHand[0], playersHand[1], betPairs);
        if (winPairs > 0) {
            winnings += winPairs;
            messages.push(`Perfect Pairs Gewinn: +${winPairs}€`);
        }
    }

    // Check 21+3
    if (bet213 > 0) {
        const win213 = check21Plus3(playersHand[0], playersHand[1], dealersHand[1], bet213);
        if (win213 > 0) {
            winnings += win213;
            messages.push(`21+3 Gewinn: +${win213}€`);
        }
    }

    // Sidebet Gewinne auszahlen
    if (winnings > 0) {
        playerMoney += winnings;
        updateMoneyDisplay();
        setTimeout(() => alert(messages.join("\n")), 500);
    }

    // Interface umschalten
    bettingPanel.classList.add('hidden');
    
    // -- NEU: Check auf sofortiges Blackjack (21) --
    const startScore = calculateHandValue(playersHand);
    if (startScore === 21) {
        // Sofort gewonnen (Blackjack Pays 3:2)
        // Wir simulieren hier, dass der Dealer KEIN Blackjack hat.
        renderTable(true); // Dealer aufdecken
        endRound("BLACKJACK");
    } else {
        // Normal weiterspielen
        actionPanel.classList.remove('hidden');
        messageEl.innerText = "Wähle: Karte (Hit) oder Keine Karte (Stand)?";
    }
}

/* --- Sidebet Logik --- */

function checkPerfectPairs(card1, card2, bet) {
    if (card1.value !== card2.value) return 0;

    // 1. Perfect Pair (Identischer Suit)
    if (card1.suit === card2.suit) return bet * 25;

    // 2. Coloured Pair (Gleiche Farbe rot/schwarz)
    const isRed1 = (card1.suit === 'H' || card1.suit === 'D');
    const isRed2 = (card2.suit === 'H' || card2.suit === 'D');
    
    if (isRed1 === isRed2) return bet * 12;

    // 3. Mixed Pair
    return bet * 6;
}

function check21Plus3(p1, p2, d1, bet) {
    const hand = [p1, p2, d1];
    
    const getRank = (c) => {
        if (c.value === 'J') return 11;
        if (c.value === 'Q') return 12;
        if (c.value === 'K') return 13;
        if (c.value === 'A') return 14;
        return parseInt(c.value);
    };

    const ranks = hand.map(getRank).sort((a, b) => a - b);
    const suits = hand.map(c => c.suit);

    // 1. Suited Trips
    if (ranks[0] === ranks[2] && suits[0] === suits[1] && suits[1] === suits[2]) return bet * 100;

    // 2. Straight Flush
    const isFlush = (suits[0] === suits[1] && suits[1] === suits[2]);
    const isStraight = (ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2]);
    
    if (isFlush && isStraight) return bet * 40;

    // 3. Three of a Kind
    if (ranks[0] === ranks[2]) return bet * 30;

    // 4. Straight
    if (isStraight) return bet * 10;

    // 5. Flush
    if (isFlush) return bet * 5;

    return 0;
}

/* --- UI Funktionen --- */

function renderCard(card, isHidden = false) {
    const el = document.createElement('div');
    el.className = 'card';
    
    if (isHidden) {
        el.classList.add('back');
        return el;
    }

    if (card.suit === 'H' || card.suit === 'D') {
        el.classList.add('red');
    } else {
        el.classList.add('black');
    }

    let suitSymbol = '';
    if (card.suit === 'H') suitSymbol = '♥';
    if (card.suit === 'D') suitSymbol = '♦';
    if (card.suit === 'C') suitSymbol = '♣';
    if (card.suit === 'S') suitSymbol = '♠';

    el.innerHTML = `${card.value}<br>${suitSymbol}`;
    return el;
}

function renderTable(showDealerFull) {
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';

    playersHand.forEach(card => playerCardsEl.appendChild(renderCard(card)));

    dealersHand.forEach((card, index) => {
        if (index === 0 && !showDealerFull) {
            dealerCardsEl.appendChild(renderCard(card, true));
        } else {
            dealerCardsEl.appendChild(renderCard(card));
        }
    });

    updateScores(showDealerFull);
}

function calculateHandValue(hand) {
    let sum = 0;
    let aces = 0;

    for (let card of hand) {
        sum += card.weight;
        if (card.value === 'A') aces++;
    }

    while (sum > 21 && aces > 0) {
        sum -= 10;
        aces--;
    }
    return sum;
}

function updateScores(showDealerFull) {
    const pScore = calculateHandValue(playersHand);
    playerScoreEl.innerText = pScore;

    if (showDealerFull) {
        const dScore = calculateHandValue(dealersHand);
        dealerScoreEl.innerText = dScore;
    } else {
        dealerScoreEl.innerText = dealersHand[1].weight; 
    }
}

function updateMoneyDisplay() {
    playerMoneyEl.innerText = `Guthaben: ${playerMoney} €`;
}

function resetGameUI() {
    bettingPanel.classList.remove('hidden');
    actionPanel.classList.add('hidden');
    resetPanel.classList.add('hidden');
    
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';
    dealerScoreEl.innerText = '0';
    playerScoreEl.innerText = '0';
    messageEl.innerText = "Plaziere neue Wetten!";
}

/* --- Spiel-Aktionen (Hit & Stand) --- */

function onHit() {
    const newCard = deck.pop();
    playersHand.push(newCard);
    renderTable(false);

    const score = calculateHandValue(playersHand);
    if (score > 21) {
        endRound("BUST");
    }
}

function onStand() {
    let dealerScore = calculateHandValue(dealersHand);

    while (dealerScore < 17) {
        dealersHand.push(deck.pop());
        dealerScore = calculateHandValue(dealersHand);
    }

    renderTable(true);
    determineWinner();
}

/* --- Gewinner Ermittlung --- */

function determineWinner() {
    const pScore = calculateHandValue(playersHand);
    const dScore = calculateHandValue(dealersHand);
    let result = "";

    if (dScore > 21) {
        result = "DEALER_BUST";
    } else if (pScore > dScore) {
        result = "WIN";
    } else if (pScore < dScore) {
        result = "LOSE";
    } else {
        result = "PUSH";
    }

    endRound(result);
}

function endRound(result) {
    actionPanel.classList.add('hidden');
    resetPanel.classList.remove('hidden');

    const betMain = parseInt(inputMain.value);
    let msg = "";

    switch (result) {
        case "BLACKJACK": // NEU: Blackjack Payout 3:2
            const winAmount = betMain * 1.5; // 3:2
            msg = `BLACKJACK! Du gewinnst ${winAmount} €.`;
            playerMoney += (betMain + winAmount);
            break;

        case "BUST":
            msg = `Überkauft! Du verlierst ${betMain} €.`;
            break;
        
        case "DEALER_BUST":
            msg = `Dealer überkauft! Du gewinnst ${betMain} €.`;
            playerMoney += (betMain * 2);
            break;

        case "WIN":
            msg = `Gewonnen! Du erhältst ${betMain} €.`;
            playerMoney += (betMain * 2);
            break;

        case "LOSE":
            msg = `Verloren. Der Dealer hat gewonnen.`;
            break;

        case "PUSH":
            msg = `Unentschieden (Push). Einsatz zurück.`;
            playerMoney += betMain;
            break;
    }

    messageEl.innerText = msg;
    updateMoneyDisplay();
}

// Initialer Aufruf
createDeck();
shuffleDeck();

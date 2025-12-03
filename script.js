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

// (Hit und Stand fügen wir im nächsten Schritt hinzu, 
// aber die Listener bereiten wir schon vor, damit keine Fehler kommen)
document.getElementById('btn-hit').addEventListener('click', () => alert("Hit kommt gleich!"));
document.getElementById('btn-stand').addEventListener('click', () => alert("Stand kommt gleich!"));


/* --- Deck Funktionen --- */

function createDeck() {
    deck = [];
    // 6 Decks zusammenmischen
    for (let i = 0; i < 6; i++) {
        for (let suit of suits) {
            for (let value of values) {
                // Gewichtung: Bildkarten = 10, Ass = 11 (erstmal)
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

    // 5. SIDEBETS Auswerten (Das Herzstück!)
    let winnings = 0;
    let messages = [];

    // Check Perfect Pairs (Nur Spielerkarten)
    if (betPairs > 0) {
        const winPairs = checkPerfectPairs(playersHand[0], playersHand[1], betPairs);
        if (winPairs > 0) {
            winnings += winPairs;
            messages.push(`Perfect Pairs Gewinn: +${winPairs}€`);
        }
    }

    // Check 21+3 (Spieler Karten + Dealer offene Karte)
    if (bet213 > 0) {
        // Dealer offene Karte ist die zweite (Index 1) in unserem Array,
        // oder die erste, je nachdem wie man dealt. Wir nehmen hier dealersHand[1] als offene.
        const win213 = check21Plus3(playersHand[0], playersHand[1], dealersHand[1], bet213);
        if (win213 > 0) {
            winnings += win213;
            messages.push(`21+3 Gewinn: +${win213}€`);
        }
    }

    // Gewinne auszahlen
    if (winnings > 0) {
        playerMoney += winnings;
        updateMoneyDisplay();
        setTimeout(() => alert(messages.join("\n")), 500); // Kleines Delay für Effekt
    }

    // Interface umschalten
    bettingPanel.classList.add('hidden');
    actionPanel.classList.remove('hidden');
    messageEl.innerText = "Wähle: Karte (Hit) oder Keine Karte (Stand)?";
}

/* --- Sidebet Logik --- */

function checkPerfectPairs(card1, card2, bet) {
    // Wenn Werte nicht gleich sind, verloren
    if (card1.value !== card2.value) return 0;

    // Werte sind gleich. Jetzt Farbe und Suit prüfen.
    
    // 1. Perfect Pair (Identischer Suit, z.B. Herz Ass & Herz Ass)
    if (card1.suit === card2.suit) {
        return bet * 25; // Auszahlung 25:1
    }

    // 2. Coloured Pair (Gleiche Farbe, aber diff Suit, z.B. Herz & Karo)
    const isRed1 = (card1.suit === 'H' || card1.suit === 'D');
    const isRed2 = (card2.suit === 'H' || card2.suit === 'D');
    
    if (isRed1 === isRed2) {
        return bet * 12; // Auszahlung 12:1
    }

    // 3. Mixed Pair (Verschiedene Farben, z.B. Herz & Pik)
    return bet * 6; // Auszahlung 6:1 (oft auch 5:1)
}

function check21Plus3(p1, p2, d1, bet) {
    // Wir brauchen 3 Karten für Poker-Logik
    const hand = [p1, p2, d1];
    
    // Hilfsfunktion: Sortiere nach Wert für Straße
    // Wir müssen J,Q,K,A in Zahlen umwandeln für den Vergleich
    const getRank = (c) => {
        if (c.value === 'J') return 11;
        if (c.value === 'Q') return 12;
        if (c.value === 'K') return 13;
        if (c.value === 'A') return 14;
        return parseInt(c.value);
    };

    const ranks = hand.map(getRank).sort((a, b) => a - b);
    const suits = hand.map(c => c.suit);

    // Prüfungen (Reihenfolge wichtig: Höchster Gewinn zuerst!)

    // 1. Suited Trips (3 gleiche Karten, gleicher Suit) - Geht nur bei 6 Decks!
    if (ranks[0] === ranks[2] && suits[0] === suits[1] && suits[1] === suits[2]) {
        return bet * 100;
    }

    // 2. Straight Flush (Straße in einer Farbe)
    const isFlush = (suits[0] === suits[1] && suits[1] === suits[2]);
    const isStraight = (ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2]);
    // Sonderfall Ass-2-3? (Hier vereinfacht: A ist 14, also nur Q-K-A Straight)
    
    if (isFlush && isStraight) {
        return bet * 40;
    }

    // 3. Three of a Kind (Drilling)
    if (ranks[0] === ranks[2]) {
        return bet * 30;
    }

    // 4. Straight (Straße)
    if (isStraight) {
        return bet * 10;
    }

    // 5. Flush (Gleiche Farbe)
    if (isFlush) {
        return bet * 5;
    }

    return 0; // Verloren
}

/* --- UI Funktionen --- */

function renderCard(card, isHidden = false) {
    const el = document.createElement('div');
    el.className = 'card';
    
    if (isHidden) {
        el.classList.add('back');
        return el;
    }

    // Farbe setzen
    if (card.suit === 'H' || card.suit === 'D') {
        el.classList.add('red');
    } else {
        el.classList.add('black');
    }

    // Symbol bestimmen
    let suitSymbol = '';
    if (card.suit === 'H') suitSymbol = '♥';
    if (card.suit === 'D') suitSymbol = '♦';
    if (card.suit === 'C') suitSymbol = '♣';
    if (card.suit === 'S') suitSymbol = '♠';

    el.innerHTML = `${card.value}<br>${suitSymbol}`;
    return el;
}

function renderTable(showDealerFull) {
    // Bereiche leeren
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';

    // Spieler Karten rendern
    playersHand.forEach(card => {
        playerCardsEl.appendChild(renderCard(card));
    });

    // Dealer Karten rendern
    dealersHand.forEach((card, index) => {
        if (index === 0 && !showDealerFull) {
            // Erste Karte verdeckt
            dealerCardsEl.appendChild(renderCard(card, true));
        } else {
            dealerCardsEl.appendChild(renderCard(card));
        }
    });

    // Score berechnen (Einfache Version für Anzeige)
    updateScores(showDealerFull);
}

function calculateHandValue(hand) {
    let sum = 0;
    let aces = 0;

    for (let card of hand) {
        sum += card.weight;
        if (card.value === 'A') aces++;
    }

    // Asse behandeln (von 11 auf 1 reduzieren wenn über 21)
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
        // Zeige nur Wert der offenen Karte
        // Achtung: Wir haben oben dealersHand[1] als offen definiert
        // Muss zur Logik passen: weight der 2. Karte
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

// Initialer Aufruf um Deck zu haben
createDeck();
shuffleDeck();

/* ============================================================
   COMPLETE SCRIPT.JS (Timer + Server Sync Fixed)
   ============================================================ */

// ----- Firebase Setup (Same) -----
const firebaseConfig = {
  apiKey: "AIzaSyCE-bz-QbLpAF4qLqejGHtE3qS8zdQjmAY",
  authDomain: "aviator-b8af3.firebaseapp.com",
  databaseURL: "https://aviator-b8af3-default-rtdb.firebaseio.com",
  projectId: "aviator-b8af3",
  storageBucket: "aviator-b8af3.firebasestorage.app",
  messagingSenderId: "648803806312",
  appId: "1:648803806312:web:ef81c50e3be36016ae9fdd",
  measurementId: "G-2294PJHNHZ"
};

let db = null;
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// ----- DOM Elements -----
const timerLine = document.getElementById("timerLine");
const gameElements = document.querySelectorAll(".game-element");
const graphArea = document.getElementById("graphArea");
const counter = document.getElementById("counter");
const flewAwayLabel = document.getElementById("flewAwayLabel");
const planeContainer = document.getElementById("planeContainer");
const planeVideo = document.getElementById("planeVideo");
const planeCanvas = document.getElementById("planeCanvas");
const ctx = planeCanvas ? planeCanvas.getContext("2d", { willReadFrequently: true }) : null;
const trailPath = document.getElementById("trailPath");
const glowAreaPath = document.getElementById("glowAreaPath");
const raysBg = document.getElementById("raysBg");
const lightBeam = document.getElementById("lightBeam");
const multiBar = document.querySelector(".multi-bar");
const historyDropdownTrigger = document.getElementById("historyDropdownTrigger");
const dropdownPanel = document.getElementById("roundHistoryDropdownPanel");
const dropdownCloseBtn = document.getElementById("dropdownCloseTrigger");
const dropdownGridContainer = document.getElementById("historyMatrixGrid");

// ----- Game Variables -----
let crashTarget = 2.00;
let currentMultiplier = 1.00;
let isCrashed = false;
let animationFrameId = null;
let isGameStartedYet = false;
let serverRoundActive = false;
let serverStartTime = null; // Server se aaya future timestamp
let isGamePlayActive = false; // Timer khatam hone ke baad true hoga
let timerTimeoutId = null;

// ----- Geometry (Same) -----
const width = 460;
const height = 250;
const startX = 35;
const startY = height - 25;
const endX = width * 0.52;
const endY = height * 0.42;
const tailOffsetX = 4;
const tailOffsetY = 42;
const cpX = startX + (endX - startX) * 0.45;
const cpY = startY;

// ----- Helpers (Same) -----
function getProgressFromMultiplier(multiplier, crash) {
    if (crash <= 1.0) return 0;
    const ratio = (multiplier - 1) / (crash - 1);
    if (ratio <= 0) return 0;
    if (ratio >= 1) return 1;
    return Math.pow(ratio, 1 / 1.8);
}

function getPlanePosition(progress) {
    const smooth = Math.sin(progress * Math.PI / 2);
    let x = (1 - smooth) * (1 - smooth) * startX + 2 * (1 - smooth) * smooth * cpX + smooth * smooth * endX;
    let y = (1 - smooth) * (1 - smooth) * startY + 2 * (1 - smooth) * smooth * cpY + smooth * smooth * endY;
    const takeoffFloat = Math.sin(Date.now() * 0.005) * 1.2 * progress;
    y += takeoffFloat;
    return { x, y };
}

// ----- History (Unchanged) -----
function updateHistoryUI(historyArray) {
    if (!multiBar) return;
    multiBar.innerHTML = "";
    const recentHistory = historyArray.slice(-15);
    recentHistory.reverse().forEach(val => {
        const multiDiv = document.createElement("div");
        multiDiv.className = "multi";
        let num = parseFloat(val);
        if (num >= 1.00 && num <= 1.99) multiDiv.classList.add("low");
        else if (num >= 2.00 && num <= 9.99) multiDiv.classList.add("mid");
        else if (num >= 10.00) multiDiv.classList.add("high");
        else multiDiv.classList.add("low");
        multiDiv.innerText = `${num.toFixed(2)}x`;
        multiBar.appendChild(multiDiv);
    });
    if (dropdownGridContainer) {
        dropdownGridContainer.innerHTML = "";
        const detailedHistory = historyArray.slice(-32);
        detailedHistory.reverse().forEach(val => {
            const gridDiv = document.createElement("div");
            gridDiv.className = "multi";
            let num = parseFloat(val);
            if (num >= 1.00 && num <= 1.99) gridDiv.classList.add("low");
            else if (num >= 2.00 && num <= 9.99) gridDiv.classList.add("mid");
            else if (num >= 10.00) gridDiv.classList.add("high");
            else gridDiv.classList.add("low");
            gridDiv.innerText = `${num.toFixed(2)}x`;
            dropdownGridContainer.appendChild(gridDiv);
        });
    }
}

if (db) {
    db.ref('history').limitToLast(35).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const historyList = Object.values(data);
            updateHistoryUI(historyList);
        }
    });
}

// ----- Dropdown (Unchanged) -----
if (historyDropdownTrigger && dropdownPanel) {
    historyDropdownTrigger.onclick = (e) => {
        e.stopPropagation();
        dropdownPanel.classList.toggle("show");
    };
}
if (dropdownCloseBtn && dropdownPanel) {
    dropdownCloseBtn.onclick = (e) => {
        e.stopPropagation();
        dropdownPanel.classList.remove("show");
    };
}
document.addEventListener("click", (e) => {
    if (dropdownPanel && !dropdownPanel.contains(e.target) && e.target !== historyDropdownTrigger) {
        dropdownPanel.classList.remove("show");
    }
});

// ----- Video Filter (Unchanged) -----
function removeBlackFromVideo() {
    if (planeVideo && planeCanvas && ctx && planeVideo.readyState >= 2) {
        try {
            if (planeVideo.videoWidth > 0 && planeCanvas.width !== planeVideo.videoWidth) {
                planeCanvas.width = planeVideo.videoWidth;
                planeCanvas.height = planeVideo.videoHeight;
            }
            ctx.drawImage(planeVideo, 0, 0, planeCanvas.width, planeCanvas.height);
            const imageData = ctx.getImageData(0, 0, planeCanvas.width, planeCanvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] < 15 && data[i + 1] < 15 && data[i + 2] < 15) {
                    data[i + 3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
        } catch(e) {}
    }
    requestAnimationFrame(removeBlackFromVideo);
}

if (planeVideo) {
    planeVideo.muted = true;
    planeVideo.setAttribute('playsinline', '');
    planeVideo.crossOrigin = "anonymous";
    planeVideo.addEventListener('loadeddata', () => {
        planeVideo.play().catch(() => {});
    });
}

// ----- Color Update (Same) -----
function updateCounterColor(multiplier) {
    if (isCrashed || !counter || !graphArea || !lightBeam || !raysBg) return;
    counter.style.color = "#ffffff";
    if (multiplier >= 1.00 && multiplier < 2.00) {
        graphArea.style.setProperty('background', '#000000', 'important');
        counter.style.textShadow = "0px 0px 25px rgba(2, 119, 253, 0.9)";
        lightBeam.style.background = "radial-gradient(ellipse 70% 100% at 50% 40%, rgba(2, 119, 253, 0.28) 0%, rgba(0,0,0,0) 85%)";
        lightBeam.classList.add("show");
        raysBg.style.filter = "drop-shadow(0px 0px 8px rgba(2, 119, 253, 0.3))";
    } else if (multiplier >= 2.00 && multiplier < 10.00) {
        counter.style.textShadow = "0px 0px 25px rgba(149, 17, 240, 0.9)";
        lightBeam.style.background = "radial-gradient(ellipse 70% 100% at 50% 40%, rgba(149, 17, 240, 0.32) 0%, rgba(0,0,0,0) 85%)";
        lightBeam.classList.add("show");
        raysBg.style.filter = "drop-shadow(0px 0px 8px rgba(149, 17, 240, 0.35))";
    } else if (multiplier >= 10.00) {
        graphArea.style.setProperty('background', 'radial-gradient(circle at 50% 50%, #0c0208 0%, #050003 100%)', 'important');
        lightBeam.style.background = "radial-gradient(ellipse 70% 100% at 50% 40%, rgba(225, 5, 110, 0.35) 0%, rgba(0,0,0,0) 85%)";
        lightBeam.classList.add("show");
        raysBg.style.filter = "drop-shadow(0px 0px 8px rgba(225, 5, 110, 0.4))";
    }
}

// ===================== GAME FUNCTIONS (FIXED) =====================

function resetGameUI() {
    isCrashed = false;
    serverRoundActive = false;
    isGamePlayActive = false;
    if (timerTimeoutId) { clearTimeout(timerTimeoutId); timerTimeoutId = null; }
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    if (planeContainer) {
        planeContainer.style.transition = "none";
        planeContainer.style.display = "block";
        planeContainer.style.left = `${startX - tailOffsetX}px`;
        planeContainer.style.top = `${startY - tailOffsetY}px`;
    }
    if (counter) {
        counter.innerText = "1.00x";
        counter.style.color = "#ffffff";
        counter.style.textShadow = "none";
        counter.style.display = "block"; // Ensure it's visible later
    }
    if (flewAwayLabel) flewAwayLabel.classList.remove("show");
    if (trailPath) { trailPath.setAttribute("d", ""); trailPath.style.opacity = "1"; }
    if (glowAreaPath) { glowAreaPath.setAttribute("d", ""); glowAreaPath.style.opacity = "1"; }
    if (lightBeam) lightBeam.classList.remove("show");
    if (raysBg) { raysBg.classList.remove("rays-paused"); raysBg.style.filter = "none"; }
    if (graphArea) graphArea.style.display = "block";
    gameElements.forEach(el => { if (el) el.style.display = ""; });
    if (timerLine) timerLine.classList.remove("timer-active");
}

function startMasterLoop() {
    // Timer UI dikhao
    if (graphArea) graphArea.style.display = "block";
    gameElements.forEach(el => { if (el) el.style.display = ""; });
    if (counter) counter.style.display = "none";
    if (flewAwayLabel) flewAwayLabel.classList.remove("show");
    if (trailPath) { trailPath.removeAttribute("d"); trailPath.style.opacity = "0"; }
    if (glowAreaPath) { glowAreaPath.removeAttribute("d"); glowAreaPath.style.opacity = "0"; }
    if (raysBg) { raysBg.classList.add("rays-paused"); raysBg.style.filter = "none"; }
    if (planeContainer) {
        planeContainer.style.transition = "none";
        planeContainer.style.display = "block";
        planeContainer.style.left = `${startX - tailOffsetX}px`;
        planeContainer.style.top = `${startY - tailOffsetY}px`;
    }
    if (timerLine) {
        timerLine.classList.remove("timer-active");
        void timerLine.offsetWidth;
        timerLine.classList.add("timer-active");
    }

    // 🔥 Timer khatam hone par game activate karo
    const now = Date.now();
    const delay = Math.max(0, serverStartTime - now); // serverStartTime future mein hai

    if (timerTimeoutId) clearTimeout(timerTimeoutId);
    timerTimeoutId = setTimeout(() => {
        // Timer khatam -> Game shuru
        activateGamePlay();
    }, delay);
}

function activateGamePlay() {
    if (isCrashed) return;
    isGamePlayActive = true;
    // Timer elements hide karo, Counter dikhao
    gameElements.forEach(el => { if (el) el.style.display = "none"; });
    if (counter) counter.style.display = "block";
    if (graphArea) graphArea.style.setProperty('background', '#000000', 'important');
    
    // Jo multiplier server ne bheja hai (1.00 se start hoga), usko apply karo
    updatePlaneAndCounter(currentMultiplier);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent("gameRoundStarted", { detail: { multiplier: currentMultiplier } }));
}

function updatePlaneAndCounter(multiplier) {
    // Sirf tabhi chalega jab game active hai aur crash nahi hua
    if (isCrashed || !isGamePlayActive) return;
    
    currentMultiplier = multiplier;
    if (counter) {
        counter.innerText = `${multiplier.toFixed(2)}x`;
        updateCounterColor(multiplier);
    }
    const progress = getProgressFromMultiplier(multiplier, crashTarget);
    const pos = getPlanePosition(progress);
    if (planeContainer) {
        planeContainer.style.left = `${pos.x - tailOffsetX}px`;
        planeContainer.style.top = `${pos.y - tailOffsetY}px`;
    }
    let pathData = "";
    if (progress > 0.015) {
        pathData = `M ${startX} ${startY} Q ${cpX} ${cpY} ${pos.x} ${pos.y}`;
    }
    if (trailPath) trailPath.setAttribute("d", pathData);
    let glowData = pathData ? `${pathData} L ${pos.x} ${startY} Z` : "";
    if (glowAreaPath) glowAreaPath.setAttribute("d", glowData);
    if (db) {
        db.ref("currentRound/multiplier").set(parseFloat(multiplier.toFixed(2)));
    }
}

function triggerCrashSequence(crashMultiplier) {
    if (isCrashed) return;
    isCrashed = true;
    isGamePlayActive = false;
    serverRoundActive = false;
    if (timerTimeoutId) { clearTimeout(timerTimeoutId); timerTimeoutId = null; }
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    if (counter) {
        counter.innerText = `${crashMultiplier.toFixed(2)}x`;
        counter.style.color = "#cb1624";
        counter.style.textShadow = "none";
    }
    if (flewAwayLabel) flewAwayLabel.classList.add("show");
    if (lightBeam) lightBeam.classList.remove("show");
    if (raysBg) raysBg.classList.add("rays-paused");
    if (trailPath) trailPath.style.opacity = "0";
    if (glowAreaPath) glowAreaPath.style.opacity = "0";

    const lastX = parseFloat(planeContainer?.style.left) || startX;
    const lastY = parseFloat(planeContainer?.style.top) || startY;
    if (planeContainer) {
        planeContainer.style.transition = "left 0.7s cubic-bezier(0.4, 0.0, 0.2, 1), top 0.7s cubic-bezier(0.4, 0.0, 0.2, 1)";
        planeContainer.style.left = `${width + 180}px`;
        planeContainer.style.top = `${lastY - 150}px`;
    }

    if (db) {
        try {
            db.ref('history').push(parseFloat(crashMultiplier.toFixed(2)));
            db.ref("currentRound/adminOverride").set({
                active: false,
                target: "2.00",
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        } catch(e) {}
    }

    window.dispatchEvent(new CustomEvent("gameCrashed", { detail: { multiplier: crashMultiplier } }));

    // 3 sec baad reset (server naya round bhejega)
    setTimeout(() => {
        resetGameUI();
    }, 3000);
}

// ===================== SOCKET.IO =====================
let socket = null;

function connectSocket() {
    const SERVER_URL = 'https://spribe-aviator.onrender.com'; // Apna Render URL
    socket = io(SERVER_URL);

    socket.on('connect', () => {
        console.log('✅ Connected to game server');
    });

    socket.on('round-start', (data) => {
        console.log('🛫 New round scheduled:', data);
        resetGameUI();
        crashTarget = data.crashTarget;
        serverStartTime = data.startTime; // Future timestamp
        serverRoundActive = true;
        currentMultiplier = 1.00;
        isGamePlayActive = false;
        
        // Timer shuru karo
        startMasterLoop();
        
        // Firebase update (optional)
        if (db) {
            db.ref("currentRound/period").transaction((current) => {
                return current ? parseInt(current) + 1 : 11111111;
            });
            db.ref("currentRound/crashTarget").set(parseFloat(crashTarget.toFixed(2)));
        }
        window.dispatchEvent(new CustomEvent("gameRoundStarted", { detail: data }));
    });

    socket.on('multiplier-update', (data) => {
        // Update store karo, par apply sirf tab hoga jab game active hai (timer khatam)
        currentMultiplier = data.multiplier;
        if (!isCrashed && isGamePlayActive) {
            updatePlaneAndCounter(data.multiplier);
        }
    });

    socket.on('round-crash', (data) => {
        console.log('💥 Crash from server:', data);
        if (!isCrashed) {
            triggerCrashSequence(data.crashMultiplier);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected, reconnecting...');
        setTimeout(connectSocket, 2000);
    });
}

// ----- Start Game -----
window.onload = () => {
    removeBlackFromVideo();
    connectSocket();
    resetGameUI();
};

// ========== BET & TABS (Bilkul Pehle Jaisa, Kuch Nahi Badala) ==========
// [Yahan tera original bet cards aur tabs ka code aayega]
// Main neeche sirf reference ke liye daal raha hoon, lekin tu apna wala copy kar sakta hai.

document.querySelectorAll(".switch").forEach(sw => {
    const buttons = sw.querySelectorAll(".switch-btn");
    buttons.forEach(btn => {
        btn.onclick = () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
        };
    });
});

document.querySelectorAll(".bet-card").forEach(card => {
    const input = card.querySelector(".amount-input");
    const circles = card.querySelectorAll(".circle");
    const minus = circles[0];
    const plus = circles[1];
    const quickBtns = card.querySelectorAll(".quick button");
    const betBtn = card.querySelector(".bet-btn");
    const betAmount = card.querySelector(".bet-amount");
    const betMain = card.querySelector(".bet-main");
    let lastQuick = null;

    function updateDisplay() {
        if (!input) return;
        let val = parseInt(input.value) || 10;
        if (val < 10) val = 10;
        if (val > 8000) val = 8000;
        input.value = val;
        if (betAmount) betAmount.innerHTML = val.toLocaleString() + ".00 INR";
    }
    if (input) updateDisplay();

    function setLocked(state) {
        if (!input) return;
        input.disabled = state;
        if (state) {
            card.classList.add("card-locked");
            if (plus) plus.classList.add("locked");
            if (minus) minus.classList.add("locked");
        } else {
            card.classList.remove("card-locked");
            if (plus) plus.classList.remove("locked");
            if (minus) minus.classList.remove("locked");
        }
        quickBtns.forEach(btn => { btn.disabled = state; });
    }

    quickBtns.forEach(btn => {
        btn.onclick = () => {
            if (!input || input.disabled) return;
            const clicked = parseInt(btn.innerText.replace(/[+,]/g, ''));
            let current = parseInt(input.value);
            if (lastQuick === clicked) { current += clicked; } else { current = clicked; }
            if (current > 8000) current = 8000;
            input.value = current;
            updateDisplay();
            quickBtns.forEach(b => b.classList.remove("active-quick"));
            btn.classList.add("active-quick");
            lastQuick = clicked;
        };
    });

    if (plus) {
        plus.onclick = () => {
            if (!input || input.disabled) return;
            let val = parseInt(input.value);
            val += 10;
            if (val > 8000) val = 8000;
            input.value = val;
            updateDisplay();
        };
    }
    if (minus) {
        minus.onclick = () => {
            if (!input || input.disabled) return;
            let val = parseInt(input.value);
            val -= 10;
            if (val < 10) val = 10;
            input.value = val;
            updateDisplay();
        };
    }
    if (input) {
        input.oninput = () => {
            let val = parseInt(input.value) || 10;
            if (val > 8000) val = 8000;
            if (val < 10) val = 10;
            input.value = val;
            updateDisplay();
        };
    }
    if (betBtn) {
        betBtn.onclick = () => {
            if (betBtn.classList.contains("active-cashout") || betBtn.classList.contains("successfully-cashedout")) return;
            if (betBtn.classList.contains("active-bet")) {
                betBtn.classList.remove("active-bet");
                card.classList.remove("active-card");
                if (betMain) betMain.innerHTML = "BET";
                setLocked(false);
            } else {
                betBtn.classList.add("active-bet");
                card.classList.add("active-card");
                if (betMain) betMain.innerHTML = "CANCEL";
                setLocked(true);
            }
        };
    }
});

const tabs = document.querySelectorAll(".tab");
tabs.forEach(tab => {
    tab.onclick = () => {
        tabs.forEach(t => t.classList.remove("active-tab"));
        tab.classList.add("active-tab");
    };
});

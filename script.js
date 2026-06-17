/* ============================================================
   BRIDGE INITIALIZATION & CORE CONTROL (Firebase + Socket.IO)
   ============================================================ */

// ----- Firebase Setup (Same as before) -----
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

// ----- DOM References (Unchanged) -----
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

// ----- Game State Variables (Now controlled by Server) -----
let startTime = null;          // Server timestamp (ms) when round started
let crashTarget = 2.00;        // Received from server
let currentMultiplier = 1.00;  // Updated by server
let isCrashed = false;
let animationFrameId = null;
let isGameStartedYet = false;

// ----- Screen Geometry (Same as before) -----
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

// ----- Helper: Compute plane position from multiplier -----
// The curve: multiplier = 1 + progress^1.8 * (crashTarget - 1)
// => progress = ((multiplier - 1) / (crashTarget - 1)) ^ (1/1.8)
function getProgressFromMultiplier(multiplier, crash) {
    if (crash <= 1.0) return 0;
    const ratio = (multiplier - 1) / (crash - 1);
    if (ratio <= 0) return 0;
    if (ratio >= 1) return 1;
    return Math.pow(ratio, 1 / 1.8);
}

function getPlanePosition(progress) {
    // Smooth step (same as original)
    const smooth = Math.sin(progress * Math.PI / 2);
    let x = (1 - smooth) * (1 - smooth) * startX + 2 * (1 - smooth) * smooth * cpX + smooth * smooth * endX;
    let y = (1 - smooth) * (1 - smooth) * startY + 2 * (1 - smooth) * smooth * cpY + smooth * smooth * endY;
    // Add small floating effect during takeoff
    const takeoffFloat = Math.sin(Date.now() * 0.005) * 1.2 * progress;
    y += takeoffFloat;
    return { x, y };
}

// ----- History & Dropdown (Unchanged) -----
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

// ----- Video Chroma Filter (Unchanged) -----
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
        } catch(e) {
            // fallback
        }
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

// ----- UI Updates (Same color logic) -----
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

// ----- Game Loop (Synchronized via Socket.IO) -----
function resetGameUI() {
    // Reset plane position
    if (planeContainer) {
        planeContainer.style.transition = "none";
        planeContainer.style.display = "block";
        planeContainer.style.left = `${startX - tailOffsetX}px`;
        planeContainer.style.top = `${startY - tailOffsetY}px`;
    }
    // Reset counter
    if (counter) {
        counter.innerText = "1.00x";
        counter.style.color = "#ffffff";
        counter.style.textShadow = "none";
    }
    // Hide crash label
    if (flewAwayLabel) flewAwayLabel.classList.remove("show");
    // Clear trail
    if (trailPath) { trailPath.setAttribute("d", ""); trailPath.style.opacity = "1"; }
    if (glowAreaPath) { glowAreaPath.setAttribute("d", ""); glowAreaPath.style.opacity = "1"; }
    if (lightBeam) lightBeam.classList.remove("show");
    if (raysBg) { raysBg.classList.remove("rays-paused"); raysBg.style.filter = "none"; }
    // Show graph area
    if (graphArea) graphArea.style.display = "block";
    gameElements.forEach(el => { if (el) el.style.display = ""; });
    // Hide timer line (we'll not use it for sync)
    if (timerLine) timerLine.classList.remove("timer-active");
}

function updatePlaneAndCounter(multiplier) {
    if (isCrashed) return;
    currentMultiplier = multiplier;
    // Update counter
    if (counter) {
        counter.innerText = `${multiplier.toFixed(2)}x`;
        updateCounterColor(multiplier);
    }
    // Update plane position based on progress
    const progress = getProgressFromMultiplier(multiplier, crashTarget);
    const pos = getPlanePosition(progress);
    if (planeContainer) {
        planeContainer.style.left = `${pos.x - tailOffsetX}px`;
        planeContainer.style.top = `${pos.y - tailOffsetY}px`;
    }
    // Update trail
    let pathData = "";
    if (progress > 0.015) {
        // Simple quadratic from start to current
        pathData = `M ${startX} ${startY} Q ${cpX} ${cpY} ${pos.x} ${pos.y}`;
    }
    if (trailPath) trailPath.setAttribute("d", pathData);
    let glowData = pathData ? `${pathData} L ${pos.x} ${startY} Z` : "";
    if (glowAreaPath) glowAreaPath.setAttribute("d", glowData);

    // Update Firebase (optional)
    if (db) {
        db.ref("currentRound/multiplier").set(parseFloat(multiplier.toFixed(2)));
    }
}

function triggerCrashSequence(crashMultiplier) {
    if (isCrashed) return;
    isCrashed = true;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    // Final multiplier
    if (counter) {
        counter.innerText = `${crashMultiplier.toFixed(2)}x`;
        counter.style.color = "#cb1624";
        counter.style.textShadow = "none";
    }
    // Show flew away label
    if (flewAwayLabel) flewAwayLabel.classList.add("show");
    if (lightBeam) lightBeam.classList.remove("show");
    if (raysBg) raysBg.classList.add("rays-paused");
    if (trailPath) trailPath.style.opacity = "0";
    if (glowAreaPath) glowAreaPath.style.opacity = "0";

    // Animate plane flying away (same as before)
    const lastX = parseFloat(planeContainer?.style.left) || startX;
    const lastY = parseFloat(planeContainer?.style.top) || startY;
    if (planeContainer) {
        planeContainer.style.transition = "left 0.7s cubic-bezier(0.4, 0.0, 0.2, 1), top 0.7s cubic-bezier(0.4, 0.0, 0.2, 1)";
        planeContainer.style.left = `${width + 180}px`;
        planeContainer.style.top = `${lastY - 150}px`;
    }

    // Save history to Firebase (optional)
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

    // Dispatch events (for other parts)
    window.dispatchEvent(new CustomEvent("gameCrashed", { detail: { multiplier: crashMultiplier } }));
}

// ===================== SOCKET.IO INTEGRATION =====================
let socket = null;

function connectSocket() {
    // Replace with your actual Render URL
    const SERVER_URL = 'https://spribe-aviator.onrender.com'; // Change if different
    socket = io(SERVER_URL);

    socket.on('connect', () => {
        console.log('✅ Connected to game server');
    });

    socket.on('round-start', (data) => {
        console.log('🛫 Round started:', data);
        // Reset game state
        isCrashed = false;
        crashTarget = data.crashTarget;
        startTime = data.startTime; // Server timestamp
        // Reset UI
        resetGameUI();
        // Start the animation loop (we'll use multiplier updates for position)
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        // We don't need a continuous loop; we'll rely on multiplier-update events.
        // But we still need to run a loop for the floating effect (optional).
        // We'll just use the multiplier updates.
        // However, the plane position updates are driven by multiplier updates.
        // We'll also keep a fallback loop to ensure smoothness if updates lag.
        // We'll start a lightweight loop that reads currentMultiplier.
        function animationLoop() {
            if (isCrashed) return;
            // If multiplier is still 1.00, we can update plane at start.
            updatePlaneAndCounter(currentMultiplier);
            requestAnimationFrame(animationLoop);
        }
        animationLoop();
        // Also dispatch event for other parts
        window.dispatchEvent(new CustomEvent("gameRoundStarted", { detail: data }));
        // Firebase period increment (optional)
        if (db) {
            db.ref("currentRound/period").transaction((current) => {
                return current ? parseInt(current) + 1 : 11111111;
            });
            db.ref("currentRound/crashTarget").set(parseFloat(crashTarget.toFixed(2)));
        }
    });

    socket.on('multiplier-update', (data) => {
        // Immediately update game visuals
        if (!isCrashed) {
            updatePlaneAndCounter(data.multiplier);
            // Also update currentMultiplier for fallback loop
            currentMultiplier = data.multiplier;
        }
    });

    socket.on('round-crash', (data) => {
        console.log('💥 Round crashed:', data);
        triggerCrashSequence(data.crashMultiplier);
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected, reconnecting...');
        setTimeout(connectSocket, 2000);
    });
}

// ----- Start the Game -----
window.onload = () => {
    // Start video filter
    removeBlackFromVideo();
    // Connect to socket server
    connectSocket();
    // Show initial UI
    resetGameUI();
    // If the game hasn't started yet, the server will send round-start soon.
};

// ----- Keep the existing bet/tabs logic (unchanged) -----
// (Your bet cards, tabs, etc. remain exactly as before)
// ... (paste the rest of your original code below for bet cards, tabs, etc.)
// I'll include it for completeness, but it's the same as your original.

/* ========== BET & TAB LOGIC (Unchanged from your original) ========== */
document.querySelectorAll(".switch").forEach(sw=>{
    const buttons = sw.querySelectorAll(".switch-btn");
    buttons.forEach(btn=>{
        btn.onclick = ()=>{
            buttons.forEach(b=>{ b.classList.remove("active"); });
            btn.classList.add("active");
        };
    });
});

document.querySelectorAll(".bet-card").forEach(card=>{
    const input = card.querySelector(".amount-input");
    const circles = card.querySelectorAll(".circle");
    const minus = circles[0]; 
    const plus = circles[1];  
    
    const quickBtns = card.querySelectorAll(".quick button");
    const betBtn = card.querySelector(".bet-btn");
    const betAmount = card.querySelector(".bet-amount");
    const betMain = card.querySelector(".bet-main");
    let lastQuick = null;
    
    function updateDisplay(){
        if (!input) return;
        let val = parseInt(input.value) || 10;
        if(val < 10) val = 10;
        if(val > 8000) val = 8000;
        input.value = val;
        if (betAmount) betAmount.innerHTML = val.toLocaleString() + ".00 INR";
    }
    if (input) updateDisplay();
    
    function setLocked(state){
        if (!input) return;
        input.disabled = state;
        if(state){
            card.classList.add("card-locked");
            if (plus) plus.classList.add("locked");
            if (minus) minus.classList.add("locked");
        } else {
            card.classList.remove("card-locked");
            if (plus) plus.classList.remove("locked");
            if (minus) minus.classList.remove("locked");
        }
        quickBtns.forEach(btn=>{ btn.disabled = state; });
    }
    
    quickBtns.forEach(btn=>{
        btn.onclick = ()=>{
            if(!input || input.disabled) return;
            const clicked = parseInt(btn.innerText.replace(/[+,]/g, '')); 
            let current = parseInt(input.value);
            if(lastQuick === clicked){ current += clicked; }else{ current = clicked; }
            if(current > 8000) current = 8000;
            input.value = current;
            updateDisplay();
            quickBtns.forEach(b=>{ b.classList.remove("active-quick"); });
            btn.classList.add("active-quick");
            lastQuick = clicked;
        };
    });
    
    if (plus) {
        plus.onclick = ()=>{
            if(!input || input.disabled) return;
            let val = parseInt(input.value);
            val += 10;
            if(val > 8000) val = 8000;
            input.value = val;
            updateDisplay();
        };
    }
    
    if (minus) {
        minus.onclick = ()=>{
            if(!input || input.disabled) return;
            let val = parseInt(input.value);
            val -= 10;
            if(val < 10) val = 10;
            input.value = val;
            updateDisplay();
        };
    }
    
    if (input) {
        input.oninput = () => {
            let val = parseInt(input.value) || 10;
            if(val > 8000) val = 8000;
            if(val < 10) val = 10;
            input.value = val;
            updateDisplay();
        };
    }
    
    if (betBtn) {
        betBtn.onclick = ()=>{
            if(betBtn.classList.contains("active-cashout") || betBtn.classList.contains("successfully-cashedout")) return;
            if(betBtn.classList.contains("active-bet")){
                betBtn.classList.remove("active-bet");
                card.classList.remove("active-card");
                if (betMain) betMain.innerHTML = "BET";
                setLocked(false);
            }else{
                betBtn.classList.add("active-bet");
                card.classList.add("active-card");
                if (betMain) betMain.innerHTML = "CANCEL";
                setLocked(true);
            }
        };
    }
});

const tabs = document.querySelectorAll(".tab");
tabs.forEach(tab=>{
    tab.onclick = ()=>{
        tabs.forEach(t=>{ t.classList.remove("active-tab"); });
        tab.classList.add("active-tab");
    };
});

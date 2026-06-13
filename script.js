/* BRIDGE INITIALIZATION & CORE CONTROL */
// Firebase initialization using CDN Globals (No import errors)
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

// Global handles initialize safely
let db = null;
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

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

// Target Modal Components for History Dropdown Expand Tool
const historyDropdownTrigger = document.getElementById("historyDropdownTrigger"); 
const dropdownPanel = document.getElementById("roundHistoryDropdownPanel");
const dropdownCloseBtn = document.getElementById("dropdownCloseTrigger");
const dropdownGridContainer = document.getElementById("historyMatrixGrid");

let startTime = null;
let isCrashed = false;
let isHoldingAtTop = false;
let holdStartTime = null;
let animationFrameId = null;
let isGameStartedYet = false; 

// Multi-User Host and State Synchronization Variables
let isHost = false;
let myUserId = Math.random().toString(36).substring(2, 15);
let serverTimeOffset = 0;
let lastSyncedState = "";

// Initial default, will be overwritten every round randomly
let crashTarget = 15.00;
const flyToTopDuration = 4000; 

// ORIGINAL AVIATOR SCREEN BOUNDS
const width = 460; 
const height = 250;
const startX = 35;           
const startY = height - 25;  
const endX = width * 0.52;   
const endY = height * 0.42;  
const tailOffsetX = 4;
const tailOffsetY = 42;

// Real Aviator Algorithm for Randomized Target Multiplier
function generateRandomCrashTarget() {
    let rand = Math.random() * 100;
    if (rand < 11) {
        return parseFloat((1.00 + Math.random() * 0.04).toFixed(2));
    } else if (rand < 55) {
        return parseFloat((1.05 + Math.random() * 0.94).toFixed(2));
    } else if (rand < 90) {
        return parseFloat((2.00 + Math.random() * 7.50).toFixed(2));
    } else {
        return parseFloat((10.00 + Math.random() * 85.00).toFixed(2));
    }
}

// History updates sync UI builder with clean layouts & Dropdown content feeds
function updateHistoryUI(historyArray) {
    if (!multiBar) return;
    multiBar.innerHTML = "";
    
    // 1. Top Bar Slider: Last 15 entries display mechanism
    const recentHistory = historyArray.slice(-15);
    recentHistory.reverse().forEach(val => {
        const multiDiv = document.createElement("div");
        multiDiv.className = "multi";
        
        let num = parseFloat(val);
        if (num >= 1.00 && num <= 1.99) { 
            multiDiv.classList.add("low"); 
        } 
        else if (num >= 2.00 && num <= 9.99) { 
            multiDiv.classList.add("mid"); 
        } 
        else if (num >= 10.00) { 
            multiDiv.classList.add("high"); 
        } else {
            multiDiv.classList.add("low");
        }
        
        multiDiv.innerText = `${num.toFixed(2)}x`;
        multiBar.appendChild(multiDiv);
    });

    // 2. Expand Grid Panel: Load comprehensive last 32 items matrix layout
    if (dropdownGridContainer) {
        dropdownGridContainer.innerHTML = "";
        const detailedHistory = historyArray.slice(-32); 
        detailedHistory.reverse().forEach(val => {
            const gridDiv = document.createElement("div");
            gridDiv.className = "multi";
            
            let num = parseFloat(val);
            if (num >= 1.00 && num <= 1.99) { 
                gridDiv.classList.add("low"); 
            } 
            else if (num >= 2.00 && num <= 9.99) { 
                gridDiv.classList.add("mid"); 
            } 
            else if (num >= 10.00) { 
                gridDiv.classList.add("high"); 
            } else {
                gridDiv.classList.add("low");
            }
            
            gridDiv.innerText = `${num.toFixed(2)}x`;
            dropdownGridContainer.appendChild(gridDiv);
        });
    }
}

// Live sync database collection callback hook
if (db) {
    db.ref('history').limitToLast(35).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const historyList = Object.values(data);
            updateHistoryUI(historyList);
        }
    });

    // Calculate time offset with Firebase server to fix client mismatches
    db.ref(".info/serverTimeOffset").on("value", (snap) => {
        serverTimeOffset = snap.val() || 0;
    });
}

function getServerTime() {
    return Date.now() + serverTimeOffset;
}

// Toggle Dropdown Sheet Events with State Control
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

/* CORS SAFE & GLITCH FREE CHROMA FILTER */
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
            if (!isGameStartedYet) {
                isGameStartedYet = true;
                initSyncEngine();
            }
        } catch(e) {
            if (planeCanvas.width > 0 && planeCanvas.height > 0) {
                ctx.clearRect(0, 0, planeCanvas.width, planeCanvas.height);
                ctx.drawImage(planeVideo, 0, 0, planeCanvas.width, planeCanvas.height);
            }
            if (!isGameStartedYet) {
                isGameStartedYet = true;
                initSyncEngine();
            }
        }
    }
    requestAnimationFrame(removeBlackFromVideo);
}

if (planeVideo) {
    planeVideo.muted = true; 
    planeVideo.setAttribute('playsinline', '');
    planeVideo.crossOrigin = "anonymous"; 
    planeVideo.addEventListener('loadeddata', () => {
        planeVideo.play().then(() => {
            removeBlackFromVideo();
        }).catch(() => {
            setTimeout(() => {
                if(!isGameStartedYet) { isGameStartedYet = true; initSyncEngine(); }
            }, 1000);
        });
    });
}

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

// Core Realtime Sync Engine (Handles Host management, Auto-Pause & Resume)
function initSyncEngine() {
    if (!db) return;

    const engineRef = db.ref("gameState");
    const hostRef = db.ref("gameHost");

    // Presence management: Add player to active users and handle sudden window disconnects cleanly
    const userPresenceRef = db.ref("activePlayers/" + myUserId);
    userPresenceRef.set(true);
    userPresenceRef.onDisconnect().remove();

    // Monitor engine status continuously
    hostRef.on("value", (snap) => {
        let currentHost = snap.val();
        if (!currentHost) {
            // Check if there are players online to resume or claim the vacant slot
            db.ref("activePlayers").once("value", (playersSnap) => {
                if (playersSnap.exists()) {
                    let players = Object.keys(playersSnap.val());
                    if (players[0] === myUserId) {
                        hostRef.set(myUserId);
                    }
                } else {
                    // Bypass freeze safe check if DB node is freshly created
                    hostRef.set(myUserId);
                }
            });
        } else if (currentHost === myUserId) {
            isHost = true;
        } else {
            isHost = false;
        }
    });

    // Backup listener to re-claim hosting if current driver crashes unexpectedly
    hostRef.onDisconnect().remove();

    // Listen to unified structural changes across all synchronized client nodes
    engineRef.on("value", (snap) => {
        let state = snap.val();
        if (!state) {
            if (isHost) resetEngineToTimer();
            return;
        }

        // MODIFIED SAFELY: Abort engine freeze logic if node is temporarily empty or single local tester
        db.ref("activePlayers").on("value", (playersSnap) => {
            if (!playersSnap.exists() && !isHost) {
                // Safely falls back instead of freezing completely
                cancelAnimationFrame(animationFrameId);
                return;
            }
        });

        crashTarget = state.crashTarget || 1.50;
        let serverNow = getServerTime();

        if (state.status === "TIMER") {
            if (lastSyncedState !== "TIMER_" + state.startTime) {
                lastSyncedState = "TIMER_" + state.startTime;
                renderTimerUI(state.startTime, serverNow);
            }
        } else if (state.status === "FLIGHT") {
            if (lastSyncedState !== "FLIGHT_" + state.startTime) {
                lastSyncedState = "FLIGHT_" + state.startTime;
                renderFlightUI(state.startTime);
            }
        } else if (state.status === "CRASHED") {
            if (lastSyncedState !== "CRASHED_" + state.timestamp) {
                lastSyncedState = "CRASHED_" + state.timestamp;
                renderCrashUI(state.lastX, state.lastY);
            }
        }
    });
}

// Host command structures to advance game cycles uniformly
function resetEngineToTimer() {
    if (!isHost || !db) return;
    
    let now = getServerTime();
    
    // Feature 1: Synchronized increment logic safely transactional
    db.ref("currentRound/period").transaction((currentPeriod) => {
        return currentPeriod === null ? 11111111 : parseInt(currentPeriod) + 1;
    });

    // Feature 2: Fetch administrative preset overrides before committing targets
    db.ref("currentRound/adminOverride").once("value", (snap) => {
        let overrideData = snap.val();
        let selectedTarget = (overrideData && overrideData.active === true) ? parseFloat(overrideData.target) : generateRandomCrashTarget();
        
        db.ref("currentRound/crashTarget").set(parseFloat(selectedTarget.toFixed(2)));

        db.ref("gameState").set({
            status: "TIMER",
            startTime: now,
            crashTarget: selectedTarget
        });
    });
}

function startEngineFlight() {
    if (!isHost || !db) return;
    db.ref("gameState").set({
        status: "FLIGHT",
        startTime: getServerTime(),
        crashTarget: crashTarget
    });
}

function commitEngineCrash(finalX, finalY) {
    if (!isHost || !db) return;
    
    db.ref('history').push(parseFloat(crashTarget.toFixed(2)));
    db.ref("currentRound/adminOverride").set({
        active: false,
        target: "2.00",
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    db.ref("gameState").set({
        status: "CRASHED",
        timestamp: getServerTime(),
        lastX: finalX,
        lastY: finalY,
        crashTarget: crashTarget
    });
}

// Pure visual renders calculated exactly down to server offset metrics
function renderTimerUI(stateStart, serverNow) {
    cancelAnimationFrame(animationFrameId);
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

    let elapsed = serverNow - stateStart;
    let remaining = 10000 - elapsed;

    if (timerLine) {
        timerLine.classList.remove("timer-active");
        void timerLine.offsetWidth;
        timerLine.style.animationDuration = "10s";
        timerLine.classList.add("timer-active");
        // Keep animation aligned if user loaded page mid-way
        timerLine.style.animationDelay = `-${elapsed / 1000}s`;
    }

    window.dispatchEvent(new CustomEvent("gameRoundStarted"));

    if (isHost) {
        setTimeout(() => { startEngineFlight(); }, Math.max(0, remaining));
    }
}

// Visual render loop implementation 
function renderFlightUI(stateStart) {
    cancelAnimationFrame(animationFrameId);
    gameElements.forEach(el => { if (el) el.style.display = "none"; });
    if (counter) counter.style.display = "block";

    startTime = stateStart;
    isCrashed = false; 
    isHoldingAtTop = false; 
    holdStartTime = null;

    if (graphArea) graphArea.style.setProperty('background', '#000000', 'important');
    if (counter) {
        counter.style.color = "#ffffff";
        counter.style.textShadow = "0px 4px 10px rgba(0, 0, 0, 0.8)";
        counter.innerText = "1.00x";
    }
    if (flewAwayLabel) flewAwayLabel.classList.remove("show");
    if (lightBeam) lightBeam.classList.remove("show");
    if (raysBg) { raysBg.classList.remove("rays-paused"); raysBg.style.filter = "none"; }
    if (trailPath) { trailPath.setAttribute("d", ""); trailPath.style.opacity = "1"; }
    if (glowAreaPath) { glowAreaPath.setAttribute("d", ""); glowAreaPath.style.opacity = "1"; }
    if (planeContainer) {
        planeContainer.style.transition = "none";
        planeContainer.style.display = "block";
        planeContainer.style.left = `${startX - tailOffsetX}px`;
        planeContainer.style.top = `${startY - tailOffsetY}px`;
    }

    db.ref("currentRound/multiplier").set(1.00);
    animationFrameId = requestAnimationFrame(animateEngine);
}

function renderCrashUI(lastX, lastY) {
    window.dispatchEvent(new CustomEvent("gameCrashed"));
    isCrashed = true;
    cancelAnimationFrame(animationFrameId);

    if (raysBg) raysBg.classList.add("rays-paused");
    if (flewAwayLabel) flewAwayLabel.classList.add("show");
    if (lightBeam) lightBeam.classList.remove("show");
    if (counter) {
        counter.innerText = `${crashTarget.toFixed(2)}x`;
        counter.style.color = "#cb1624";
        counter.style.textShadow = "none";
    }
    if (trailPath) trailPath.style.opacity = "0";
    if (glowAreaPath) glowAreaPath.style.opacity = "0";
    if (planeContainer) {
        planeContainer.style.transition = "left 0.7s cubic-bezier(0.4, 0.0, 0.2, 1), top 0.7s cubic-bezier(0.4, 0.0, 0.2, 1)";
        planeContainer.style.left = `${width + 180}px`;
        planeContainer.style.top = `${lastY - 150}px`;
    }

    if (isHost) {
        setTimeout(() => { resetEngineToTimer(); }, 3000);
    }
}

function animateEngine() {
    if (isCrashed) return;
    
    let timestamp = getServerTime();
    let currentX, currentY;
    let currentMultiplier = 1.00;
    const cpX = startX + (endX - startX) * 0.45;
    const cpY = startY;
    
    let elapsed = timestamp - startTime;

    if (elapsed < flyToTopDuration) {
        let progress = elapsed / flyToTopDuration;
        let smoothProgress = Math.sin(progress * Math.PI / 2);
        currentX = (1 - smoothProgress) * (1 - smoothProgress) * startX + 2 * (1 - smoothProgress) * smoothProgress * cpX + smoothProgress * smoothProgress * endX;
        currentY = (1 - smoothProgress) * (1 - smoothProgress) * startY + 2 * (1 - smoothProgress) * smoothProgress * cpY + smoothProgress * smoothProgress * endY;
        let takeoffFloat = Math.sin(timestamp * 0.005) * 1.2;
        currentY += takeoffFloat * progress;
        currentMultiplier = 1.00 + (Math.pow(progress, 1.8) * 1.06);
        
        if (currentMultiplier >= crashTarget) {
            currentMultiplier = crashTarget;
            if (counter) counter.innerText = `${crashTarget.toFixed(2)}x`;
            if (isHost) commitEngineCrash(currentX, currentY);
            return;
        }
    } else {
        isHoldingAtTop = true;
        let holdElapsed = elapsed - flyToTopDuration;
        currentX = endX;
        let wave1 = Math.sin(timestamp * 0.0025) * 14.5;
        let wave2 = Math.cos(timestamp * 0.005) * 3.5;
        currentY = endY + wave1 + wave2;
        currentMultiplier = 2.06 + Math.pow(holdElapsed / 6500, 1.5) * (crashTarget - 2.06);
        
        if (currentMultiplier >= crashTarget) {
            currentMultiplier = crashTarget;
            if (counter) counter.innerText = `${crashTarget.toFixed(2)}x`;
            if (isHost) commitEngineCrash(currentX, currentY);
            return;
        }
    }
    
    let pathData = "";
    if (elapsed > 60) {
        pathData = `M ${startX} ${startY} Q ${cpX} ${cpY} ${currentX} ${currentY}`;
    }
    if (trailPath) trailPath.setAttribute("d", pathData);
    let glowData = pathData ? `${pathData} L ${currentX} ${startY} Z` : "";
    if (glowAreaPath) glowAreaPath.setAttribute("d", glowData);
    if (planeContainer) {
        planeContainer.style.left = `${currentX - tailOffsetX}px`;
        planeContainer.style.top = `${currentY - tailOffsetY}px`;
    }
    if (counter) {
        counter.innerText = `${currentMultiplier.toFixed(2)}x`;
        updateCounterColor(currentMultiplier);
    }
    
    if (db && isHost) {
        db.ref("currentRound/multiplier").set(parseFloat(currentMultiplier.toFixed(2)));
    }
    window.dispatchEvent(new CustomEvent("multiplierUpdate", { detail: { multiplier: currentMultiplier } }));
    animationFrameId = requestAnimationFrame(animateEngine);
}

window.onload = () => {
    setTimeout(() => {
        if (!isGameStartedYet && !planeVideo) { 
            isGameStartedYet = true; 
            initSyncEngine(); 
        }
    }, 2000);
};

/* TABS & INPUT LOGIC CONTROL */
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
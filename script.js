/* BRIDGE INITIALIZATION & CORE CONTROL */

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

const myUserId = "User_" + Math.floor(Math.random() * 100000);
let isHost = false; 
let remoteRoundState = "IDLE"; 

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

let startTime = null;
let isCrashed = false;
let isHoldingAtTop = false;
let holdStartTime = null;
let animationFrameId = null;
let isGameStartedYet = false; 

// BACKGROUND DETONATION PROTECTION VARIABLES
let isTabPaused = false;
let totalPausedDuration = 0;
let lastPauseTimestamp = 0;

let crashTarget = 15.00;
const flyToTopDuration = 4000; 

const width = 460; 
const height = 250;
const startX = 35;           
const startY = height - 25;  
const endX = width * 0.52;   
const endY = height * 0.42;  
const tailOffsetX = 4;
const tailOffsetY = 42;

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

function updateHistoryUI(historyArray) {
    if (!multiBar) return;
    multiBar.innerHTML = "";
    
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

if (db) {
    db.ref('history').limitToLast(35).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const historyList = Object.values(data);
            updateHistoryUI(historyList);
        }
    });

    function claimHostSeat() {
        db.ref("currentRound/hostId").transaction((currentHost) => {
            if (currentHost === null || currentHost === "") {
                return myUserId; 
            }
            return currentHost; 
        }, (error, committed, snapshot) => {
            if (committed && snapshot.val() === myUserId) {
                isHost = true;
                db.ref("currentRound/hostId").onDisconnect().remove();
            } else {
                isHost = false;
            }
        });
    }

    db.ref("currentRound/hostId").on("value", (snap) => {
        const val = snap.val();
        if (!val) {
            claimHostSeat();
        } else {
            isHost = (val === myUserId);
        }
    });

    db.ref("currentRound/state").on("value", (snap) => {
        const state = snap.val() || "IDLE";
        remoteRoundState = state;
        if (!isHost) {
            if (state === "TIMER") {
                executeLocalTimerUI();
            } else if (state === "FLIGHT") {
                executeLocalFlightUI();
            } else if (state === "CRASHED") {
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                isCrashed = true;
                if (flewAwayLabel) flewAwayLabel.classList.add("show");
                if (planeContainer) {
                    planeContainer.style.transition = "left 0.7s cubic-bezier(0.4, 0.0, 0.2, 1), top 0.7s cubic-bezier(0.4, 0.0, 0.2, 1)";
                    planeContainer.style.left = `${width + 180}px`; 
                }
            }
        }
    });

    db.ref("currentRound/multiplier").on("value", (snap) => {
        if (!isHost && remoteRoundState === "FLIGHT" && !isTabPaused) {
            const remoteMultiplier = parseFloat(snap.val() || 1.00);
            renderClientFrame(remoteMultiplier);
        }
    });

    db.ref("currentRound/crashTarget").on("value", (snap) => {
        if (!isHost) {
            crashTarget = parseFloat(snap.val() || 1.00);
        }
    });
} else {
    let localHistory = JSON.parse(localStorage.getItem("game_history")) || [1.32, 4.50, 11.20, 1.02];
    updateHistoryUI(localHistory);
}

/* ANTI-PAUSE: BACKGROUND SYNC & AUTO CONTINUATION ENGINE */
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        // Jab tum lock karke jaoge - Time record karo aur engine pause karo
        isTabPaused = true;
        lastPauseTimestamp = performance.now();
        if (planeVideo) planeVideo.pause();
    } else if (document.visibilityState === "visible") {
        // Jab tum wapas aagaye - Pause duration nikal kar system ko offset do
        isTabPaused = false;
        if (planeVideo) planeVideo.play().catch(()=>{});
        
        if (lastPauseTimestamp > 0) {
            let currentRecoveryTime = performance.now();
            let dynamicDiff = currentRecoveryTime - lastPauseTimestamp;
            totalPausedDuration += dynamicDiff; 
        }

        console.log("Welcome back! Recovered pause drift of: " + totalPausedDuration + "ms");

        if (!db) {
            // Offline Mode (Bina Firebase ke loop automatically safely continue hoga)
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(animateEngine);
        } else {
            // Online Mode (Firebase state se re-sync)
            db.ref("currentRound/state").once("value", (snap) => {
                const liveState = snap.val() || "IDLE";
                if (liveState === "FLIGHT") {
                    if (animationFrameId) cancelAnimationFrame(animationFrameId);
                    animationFrameId = requestAnimationFrame(animateEngine);
                } else if (liveState === "TIMER" || liveState === "CRASHED") {
                    totalPausedDuration = 0;
                    startTime = null;
                    if (isHost) startMasterLoop();
                }
            });
        }
    }
});

/* RECOVERY FORCE LOCKS */
setInterval(() => {
    if ((isCrashed || remoteRoundState === "CRASHED") && !isTabPaused) {
        isCrashed = false;
        remoteRoundState = "IDLE";
        totalPausedDuration = 0;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (isHost || !db) startMasterLoop();
    }
}, 7000);

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

/* CHROMATIC TAINT-FREE RENDERER */
let chromaInterval = null;
function removeBlackFromVideo() {
    if (!planeVideo || !planeCanvas || !ctx || planeVideo.paused || planeVideo.ended || isTabPaused) return;
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

if (planeVideo) {
    planeVideo.muted = true; 
    planeVideo.setAttribute('playsinline', '');
    planeVideo.crossOrigin = "anonymous"; 
    
    planeVideo.addEventListener('play', () => {
        if(chromaInterval) clearInterval(chromaInterval);
        chromaInterval = setInterval(removeBlackFromVideo, 1000 / 30); 
        triggerSafeStart();
    });
    
    planeVideo.addEventListener('loadeddata', () => {
        planeVideo.play().catch(() => triggerSafeStart());
    });
}

function triggerSafeStart() {
    if (!isGameStartedYet) {
        isGameStartedYet = true;
        startMasterLoop();
    }
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

function executeLocalTimerUI() {
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
        planeContainer.style.opacity = "1";
        planeContainer.style.left = `${startX - tailOffsetX}px`;
        planeContainer.style.top = `${startY - tailOffsetY}px`;
    }
    
    if (timerLine) {
        timerLine.classList.remove("timer-active");
        void timerLine.offsetWidth; 
        timerLine.classList.add("timer-active");
    }
}

function startMasterLoop() {
    if (db && !isHost) return; 
    if (db) db.ref("currentRound/state").set("TIMER");

    executeLocalTimerUI();
    setTimeout(() => {
        if (db && !isHost) return; 
        initGraphEngine();
    }, 10000); 
}

function executeLocalFlightUI() {
    gameElements.forEach(el => { if (el) el.style.display = "none"; }); 
    if (counter) counter.style.display = "block"; 
    
    startTime = null; 
    isCrashed = false; 
    isHoldingAtTop = false; 
    holdStartTime = null;
    totalPausedDuration = 0; // Fresh reset for loop metrics
    
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
        planeContainer.style.opacity = "1";
        planeContainer.style.left = `${startX - tailOffsetX}px`;
        planeContainer.style.top = `${startY - tailOffsetY}px`;
    }
    window.dispatchEvent(new CustomEvent("gameRoundStarted"));
}

function initGraphEngine() {
    executeLocalFlightUI();
    if (db && isHost) {
        db.ref("currentRound/state").set("FLIGHT");
        
        db.ref("currentRound/period").transaction((currentPeriod) => {
            if (currentPeriod === null) return 11111111;
            return parseInt(currentPeriod) + 1;
        });
        
        db.ref("currentRound/adminOverride").once("value", (snap) => {
            let overrideData = snap.val();
            if (overrideData && overrideData.active === true) {
                crashTarget = parseFloat(overrideData.target);
            } else {
                crashTarget = generateRandomCrashTarget();
            }
            db.ref("currentRound/crashTarget").set(parseFloat(crashTarget.toFixed(2)));
        });
        
        db.ref("currentRound/multiplier").set(1.00);
    } else if (!db) {
        crashTarget = generateRandomCrashTarget();
    }
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(animateEngine);
}

function renderClientFrame(currentMultiplier) {
    if (isHost || isCrashed || isTabPaused) return; 
    let currentX, currentY;
    const cpX = startX + (endX - startX) * 0.45;
    const cpY = startY;

    if (currentMultiplier < 2.06) {
        let progress = Math.pow((currentMultiplier - 1.00) / 1.06, 1 / 1.8);
        if (progress > 1) progress = 1;
        let smoothProgress = Math.sin(progress * Math.PI / 2);
        currentX = (1 - smoothProgress) * (1 - smoothProgress) * startX + 2 * (1 - smoothProgress) * smoothProgress * cpX + smoothProgress * smoothProgress * endX;
        currentY = (1 - smoothProgress) * (1 - smoothProgress) * startY + 2 * (1 - smoothProgress) * smoothProgress * cpY + smoothProgress * smoothProgress * endY;
        let takeoffFloat = Math.sin(performance.now() * 0.005) * 1.2;
        currentY += takeoffFloat * progress;
    } else {
        currentX = endX;
        let wave1 = Math.sin(performance.now() * 0.0025) * 14.5;
        let wave2 = Math.cos(performance.now() * 0.005) * 3.5;
        currentY = endY + wave1 + wave2;
    }

    if (currentMultiplier >= crashTarget) {
        executeLocalCrashSequence(currentX, currentY);
        return;
    }
    renderPathsAndPlane(currentX, currentY, currentMultiplier);
}

function renderPathsAndPlane(cX, cY, cMultiplier) {
    const cpX = startX + (endX - startX) * 0.45;
    const cpY = startY;
    let pathData = `M ${startX} ${startY} Q ${cpX} ${cpY} ${cX} ${cY}`;
    
    if (trailPath) trailPath.setAttribute("d", pathData);
    let glowData = `${pathData} L ${cX} ${startY} Z`;
    if (glowAreaPath) glowAreaPath.setAttribute("d", glowData);
    if (planeContainer) {
        planeContainer.style.left = `${cX - tailOffsetX}px`;
        planeContainer.style.top = `${cY - tailOffsetY}px`;
    }
    if (counter) {
        counter.innerText = `${cMultiplier.toFixed(2)}x`;
        updateCounterColor(cMultiplier);
    }
    window.dispatchEvent(new CustomEvent("multiplierUpdate", { detail: { multiplier: cMultiplier } }));
}

function animateEngine(timestamp) {
    if (isCrashed || isTabPaused) return;
    if (!isHost && db) return; 
    
    if (!startTime) startTime = timestamp;

    // Core Calculation with dynamic subtracted totalPausedDuration offset
    let elapsed = timestamp - startTime - totalPausedDuration;
    if (elapsed < 0) elapsed = 0; 

    let currentX, currentY;
    let currentMultiplier = 1.00;
    const cpX = startX + (endX - startX) * 0.45;
    const cpY = startY;
    
    if (!isHoldingAtTop) {
        let progress = elapsed / flyToTopDuration;
        if (progress > 1) progress = 1;
        let smoothProgress = Math.sin(progress * Math.PI / 2);
        currentX = (1 - smoothProgress) * (1 - smoothProgress) * startX + 2 * (1 - smoothProgress) * smoothProgress * cpX + smoothProgress * smoothProgress * endX;
        currentY = (1 - smoothProgress) * (1 - smoothProgress) * startY + 2 * (1 - smoothProgress) * smoothProgress * cpY + smoothProgress * smoothProgress * endY;
        let takeoffFloat = Math.sin(timestamp * 0.005) * 1.2;
        currentY += takeoffFloat * progress;
        currentMultiplier = 1.00 + (Math.pow(progress, 1.8) * 1.06);
        
        if (currentMultiplier >= crashTarget) {
            currentMultiplier = crashTarget;
            executeLocalCrashSequence(currentX, currentY);
            return;
        }
        if (progress >= 1) { isHoldingAtTop = true; holdStartTime = timestamp; }
    } else {
        let holdElapsed = timestamp - holdStartTime - totalPausedDuration;
        if (holdElapsed < 0) holdElapsed = 0;

        currentX = endX;
        let wave1 = Math.sin(timestamp * 0.0025) * 14.5;
        let wave2 = Math.cos(timestamp * 0.005) * 3.5;
        currentY = endY + wave1 + wave2;
        currentMultiplier = 2.06 + Math.pow(holdElapsed / 6500, 1.5) * (crashTarget - 2.06);
        if (currentMultiplier >= crashTarget) {
            currentMultiplier = crashTarget;
            executeLocalCrashSequence(currentX, currentY);
            return;
        }
    }
    
    renderPathsAndPlane(currentX, currentY, currentMultiplier);
    
    if (db && isHost) {
        db.ref("currentRound/multiplier").set(parseFloat(currentMultiplier.toFixed(2)));
    }
    animationFrameId = requestAnimationFrame(animateEngine);
}

function executeLocalCrashSequence(lastX, lastY) {
    if(isCrashed) return; 
    window.dispatchEvent(new CustomEvent("gameCrashed"));
    isCrashed = true;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    if (db && isHost) {
        try {
            db.ref('history').push(parseFloat(crashTarget.toFixed(2)));
            db.ref("currentRound/state").set("CRASHED");
            db.ref("currentRound/adminOverride").set({
                active: false,
                target: "2.00",
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (e) {
            console.error("Database connection recovery dynamic fault:", e);
        }
    } else if (!db) {
        let localHistory = JSON.parse(localStorage.getItem("game_history")) || [];
        localHistory.push(parseFloat(crashTarget.toFixed(2)));
        if (localHistory.length > 40) localHistory.shift();
        localStorage.setItem("game_history", JSON.stringify(localHistory));
        updateHistoryUI(localHistory);
    }

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
        planeContainer.style.transition = "left 0.5s ease-in, top 0.5s ease-in";
        planeContainer.style.left = `${width + 180}px`; 
        planeContainer.style.top = `${lastY - 150}px`; 
    }
    setTimeout(() => { 
        if ((isHost || !db) && !isTabPaused) startMasterLoop(); 
    }, 3000);
}

window.onload = () => {
    setTimeout(triggerSafeStart, 1000);
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

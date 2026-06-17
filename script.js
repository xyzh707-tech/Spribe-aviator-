/* ============================================================
   FRONTEND - SIRF DISPLAY (TV SCREEN)
   Game logic (Plane udana, crash, timer) ab TERMUX (Node.js) karega.
   ============================================================ */

// 1. FIREBASE INITIALIZATION
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

// 2. DOM ELEMENTS (Screen Components)
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

// Screen Boundaries (Sirf starting position fallback ke liye)
const startX = 35;
const startY = 225; // height - 25
const tailOffsetX = 4;
const tailOffsetY = 42;

// 3. HISTORY UI UPDATE (Waise ka waisa)
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

// History Listener
if (db) {
    db.ref('history').limitToLast(35).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) updateHistoryUI(Object.values(data));
    });
}

// 4. DROPDOWN TOGGLE (Waise ka waisa)
if (historyDropdownTrigger && dropdownPanel) {
    historyDropdownTrigger.onclick = (e) => { e.stopPropagation(); dropdownPanel.classList.toggle("show"); };
}
if (dropdownCloseBtn && dropdownPanel) {
    dropdownCloseBtn.onclick = (e) => { e.stopPropagation(); dropdownPanel.classList.remove("show"); };
}
document.addEventListener("click", (e) => {
    if (dropdownPanel && !dropdownPanel.contains(e.target) && e.target !== historyDropdownTrigger) {
        dropdownPanel.classList.remove("show");
    }
});

// 5. PLANE VIDEO CHROMA FILTER (Sirf plane ki video clean karne ke liye, game start nahi karega)
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
            // Ignore errors
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
        removeBlackFromVideo();
    });
}

// 6. COUNTER COLOR UPDATE (Sirf UI styling ke liye)
function updateCounterColor(multiplier) {
    if (!counter || !graphArea || !lightBeam || !raysBg) return;
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
        counter.style.textShadow = "0px 0px 25px rgba(225, 5, 110, 0.9)";
        lightBeam.style.background = "radial-gradient(ellipse 70% 100% at 50% 40%, rgba(225, 5, 110, 0.35) 0%, rgba(0,0,0,0) 85%)";
        lightBeam.classList.add("show");
        raysBg.style.filter = "drop-shadow(0px 0px 8px rgba(225, 5, 110, 0.4))";
    }
}

// 7. ============================================================
//    📺 LIVE DISPLAY ENGINE (YEH SABSE IMPORTANT HAI)
//    Ye Firebase se data read karega aur screen update karega.
//    Jaise hi Termux DB me kuch likhega, ye turant dikhayega.
// ============================================================
if (db) {
    db.ref('currentRound').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // A. Data Read Karo (Jo Termux ne bheja)
        const multiplier = data.multiplier || 1.00;
        const isCrashed = data.isCrashed || false;
        const planeX = data.planeX || startX;
        const planeY = data.planeY || startY;
        const crashTarget = data.crashTarget || 1.00;

        // B. Counter Update
        if (counter) {
            counter.style.display = 'block';
            counter.innerText = multiplier.toFixed(2) + 'x';
            if (!isCrashed) {
                updateCounterColor(multiplier);
            } else {
                // Crash hua toh red color
                counter.style.color = "#cb1624";
                counter.style.textShadow = "none";
                if (lightBeam) lightBeam.classList.remove('show');
                if (raysBg) raysBg.style.filter = "none";
            }
        }

        // C. Plane ki Position Update (Smooth instant move)
        if (planeContainer) {
            planeContainer.style.transition = 'none';
            planeContainer.style.display = 'block';
            planeContainer.style.left = (planeX - tailOffsetX) + 'px';
            planeContainer.style.top = (planeY - tailOffsetY) + 'px';
        }

        // D. Trail / Glow Path (Simple curve)
        // Agar Termux path bhejta hai toh use karo, warna simple line
        if (trailPath) {
            let pathD = `M ${startX} ${startY} Q ${startX + 100} ${startY - 50} ${planeX} ${planeY}`;
            trailPath.setAttribute('d', pathD);
            trailPath.style.opacity = (isCrashed ? '0' : '1');
        }
        if (glowAreaPath) {
            let glowD = `M ${startX} ${startY} Q ${startX + 100} ${startY - 50} ${planeX} ${planeY} L ${planeX} ${startY} Z`;
            glowAreaPath.setAttribute('d', glowD);
            glowAreaPath.style.opacity = (isCrashed ? '0' : '1');
        }

        // E. "Flew Away" Label
        if (flewAwayLabel) {
            if (isCrashed) flewAwayLabel.classList.add('show');
            else flewAwayLabel.classList.remove('show');
        }

        // F. Timer Line (Bar) - Active rahega jab tak crash na ho
        if (timerLine) {
            if (isCrashed) timerLine.classList.remove('timer-active');
            else timerLine.classList.add('timer-active');
        }

        // G. Rays & Light Beam
        if (raysBg) {
            if (isCrashed) raysBg.classList.add('rays-paused');
            else raysBg.classList.remove('rays-paused');
        }
        if (lightBeam) {
            if (isCrashed) lightBeam.classList.remove('show');
            else lightBeam.classList.add('show');
        }

        // H. GraphArea background default
        if (graphArea && !isCrashed) {
            graphArea.style.setProperty('background', '#000000', 'important');
        }
    });
} else {
    console.warn("Firebase not initialized. Display will not work.");
}

// 8. BETTING CARDS & TABS LOGIC (Bilkul waise ka waisa, koi change nahi)
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

// 9. WINDOW LOAD - Ab bas display ready hai, koi timer nahi chlega
console.log("✅ Frontend Display Ready. Waiting for Termux Engine data...");

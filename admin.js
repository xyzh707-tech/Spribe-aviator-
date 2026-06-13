// --- ADMIN CORE CONTROL & REALTIME MONITOR PANEL ---
(function injectAdminPanel() {
    // 1. Admin Panel ka HTML structure create karna
    const adminDiv = document.createElement("div");
    adminDiv.id = "adminPanelPopup";
    adminDiv.innerHTML = `
        <div id="adminHeader">
            <span>⚙️ Aviator Control</span>
            <button id="closeAdminBtn">×</button>
        </div>
        <div class="admin-body">
            <label>Next Crash Target (Multiplier):</label>
            <input type="number" id="nextTargetInput" step="0.01" value="2.00" min="1.00">
            <button id="saveTargetBtn">SET TARGET</button>
            <div id="adminStatus">Panel Connected!</div>

            <div id="adminMonitorBox" style="margin-top: 14px; font-size: 12px; color: #aaa; border-top: 1px solid #333; padding-top: 10px; font-family: sans-serif;">
                <div style="margin-bottom: 4px;">Live Period: <span id="livePeriodText" style="color: #00bcd4; font-weight: bold;">11111111</span></div>
                <div style="margin-bottom: 4px;">Live Multiplier: <span id="liveMultiText" style="color: #ffeb3b; font-weight: bold;">1.00x</span></div>
                <div>Next Crash: <span id="nextCrashText" style="color: #e10514; font-weight: bold;">--</span></div>
            </div>
        </div>
    `;
    document.body.appendChild(adminDiv);

    // 2. CSS Styling - Chota sa professional popup panel layout
    const style = document.createElement("style");
    style.innerHTML = `
        #adminPanelPopup {
            position: fixed;
            top: 25px;
            left: 25px;
            width: 240px;
            background: #1c1d21;
            border: 2px solid #e10514;
            border-radius: 10px;
            color: white;
            font-family: Arial, sans-serif;
            box-shadow: 0px 10px 30px rgba(0,0,0,0.7);
            z-index: 100000;
            display: none;
            user-select: none;
        }
        #adminHeader {
            background: #2c2d32;
            padding: 8px 12px;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
            font-size: 13px;
            border-bottom: 1px solid #3a3b40;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
        }
        #closeAdminBtn {
            background: none;
            border: none;
            color: #888;
            font-size: 18px;
            cursor: pointer;
        }
        #closeAdminBtn:hover { color: #fff; }
        .admin-body { padding: 12px; }
        .admin-body label { display: block; font-size: 12px; margin-bottom: 6px; color: #aaa; }
        #nextTargetInput {
            width: 100%;
            padding: 8px;
            background: #101114;
            border: 1px solid #444;
            border-radius: 5px;
            color: #fff;
            font-size: 16px;
            font-weight: bold;
            box-sizing: border-box;
            margin-bottom: 10px;
            text-align: center;
        }
        #saveTargetBtn {
            width: 100%;
            padding: 8px;
            background: #e10514;
            border: none;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s;
        }
        #saveTargetBtn:hover { background: #b8030f; }
        #adminStatus {
            font-size: 11px;
            color: #4caf50;
            margin-top: 8px;
            text-align: center;
        }
    `;
    document.head.appendChild(style);

    // --- FEATURE 1: 10 BAAR TAP KARNE PE POPUP KHULEGA ---
    let clickCount = 0;
    let clickTimer = null;
    document.addEventListener("click", () => {
        clickCount++;
        if (!clickTimer) {
            clickTimer = setTimeout(() => {
                clickCount = 0;
                clickTimer = null;
            }, 3000);
        }
        if (clickCount >= 10) {
            adminDiv.style.display = "block";
            clickCount = 0;
            clearTimeout(clickTimer);
            clickTimer = null;
        }
    });

    document.getElementById("closeAdminBtn").onclick = () => {
        adminDiv.style.display = "none";
    };

    // --- FEATURE 2: SMOOTH DRAGGING LOGIC ---
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    const adminHeader = document.getElementById("adminHeader");
    adminHeader.addEventListener("mousedown", dragStart);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);
    adminHeader.addEventListener("touchstart", dragStart);
    document.addEventListener("touchmove", drag);
    document.addEventListener("touchend", dragEnd);

    function dragStart(e) {
        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }
        if (e.target === adminHeader || adminHeader.contains(e.target)) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }
            xOffset = currentX;
            yOffset = currentY;
            adminDiv.style.transform = `translate3d(${currentX}px, ${currentY}px, 0px)`;
        }
    }

    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    // --- FEATURE 3: FIREBASE INTERACTION & REALTIME SYNC ---
    const saveBtn = document.getElementById("saveTargetBtn");
    const targetInput = document.getElementById("nextTargetInput");
    const statusDiv = document.getElementById("adminStatus");

    const database = window.dbRef ? window.dbRef : (window.firebase ? firebase.database() : null);

    if (database) {
        // A. Multiplier Set Karne ka Operation - Admin override
        saveBtn.onclick = () => {
            let val = parseFloat(targetInput.value);
            if (isNaN(val) || val < 1.00) {
                val = 1.00;
                targetInput.value = "1.00";
            }

            // Database ke administrative path par target update karna
            database.ref("currentRound/adminOverride").set({
                active: true,
                target: val.toFixed(2),
                timestamp: firebase.database.ServerValue.TIMESTAMP
            })
            .then(() => {
                statusDiv.innerText = `Target: ${val.toFixed(2)}x Set!`;
                statusDiv.style.color = "#4caf50";
                setTimeout(() => { statusDiv.innerText = "Panel Connected!"; }, 2000);
            })
            .catch((err) => {
                statusDiv.innerText = "Firebase Error!";
                statusDiv.style.color = "#f44336";
            });
        };

        // B. Realtime Period Tracker - Automatic Increments From 11111111 Without Resets
        database.ref("currentRound/period").on("value", (snap) => {
            if (snap.exists()) {
                document.getElementById("livePeriodText").innerText = snap.val();
            } else {
                // Initialize standard baseline index configuration if empty
                document.getElementById("livePeriodText").innerText = "11111111";
                database.ref("currentRound/period").set(11111111);
            }
        });

        // C. Live Running Multiplier Update
        database.ref("currentRound/multiplier").on("value", (snap) => {
            if (snap.exists()) {
                document.getElementById("liveMultiText").innerText = parseFloat(snap.val()).toFixed(2) + "x";
            } else {
                document.getElementById("liveMultiText").innerText = "1.00x";
            }
        });

        // D. Next Crash Target Realtime Monitor Display
        database.ref("currentRound/crashTarget").on("value", (snap) => {
            if (snap.exists()) {
                document.getElementById("nextCrashText").innerText = parseFloat(snap.val()).toFixed(2) + "x";
            } else {
                document.getElementById("nextCrashText").innerText = "--";
            }
        });
    } else {
        statusDiv.innerText = "Firebase Reference Missing!";
        statusDiv.style.color = "#ff9800";
        document.getElementById("livePeriodText").innerText = "Database Error";
        document.getElementById("liveMultiText").innerText = "Database Error";
    }
})();
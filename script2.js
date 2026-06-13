/**
 * script2.js - Core Cashout & Yellow Box Controller (BORDER REMOVED & LOCK RETAINED)
 */
document.querySelectorAll(".bet-card").forEach((card) => {
    const betBtn = card.querySelector(".bet-btn");
    const betMain = card.querySelector(".bet-main");
    const betAmount = card.querySelector(".bet-amount");
    const input = card.querySelector(".amount-input");
    const waitingLabel = card.querySelector(".waiting"); // Target waiting text row
    
    if (!betBtn) return;

    // Is function ko tab trigger kiya jata hai jab main engine me plane udna shuru karta hai
    window.addEventListener("gameRoundStarted", () => {
        // Agar user ne BET lagayi hui thi (yaani card active tha)
        if (card.classList.contains("active-card") || betBtn.classList.contains("active-bet") || betBtn.classList.contains("btn-active")) {
            
            // 1. Button ko locked rakhna hai, par classes saaf karke yellow banana hai
            betBtn.classList.remove("active-bet", "btn-active", "bet-green"); 
            betBtn.classList.add("active-cashout");
            
            // Yellow/Orange background color apply karna
            betBtn.style.setProperty("background-color", "#d47f00", "important"); 
            betBtn.style.setProperty("background", "linear-gradient(145deg, #e68a00, #cc7a00)", "important");

            // --- RED BORDER REMOVAL LOGIC ---
            // Square box (card) se red border hatane ke liye border ko normal ya none kar dete hain
            card.style.setProperty("border", "none", "important");
            card.style.setProperty("box-shadow", "none", "important");
            
            // Agar border kisi specific inner container par hai, toh use bhi saaf karein
            const innerBorder = card.querySelector(".bet-borders, .border-box");
            if (innerBorder) {
                innerBorder.style.setProperty("display", "none", "important");
            }

            // Text ko "Cash Out" set karna
            if (betMain) betMain.innerHTML = "Cash Out";
            
            // "WAITING FOR NEXT ROUND" text ko hide rakhna
            if (waitingLabel) {
                waitingLabel.style.setProperty("display", "none", "important");
            }
        }
    });

    // Har frame par live multiplier calculation show karne ke liye handler
    window.addEventListener("multiplierUpdate", (e) => {
        if (betBtn.classList.contains("active-cashout") || betBtn.style.backgroundColor === "rgb(212, 127, 0)") {
            const currentMultiplier = e.detail.multiplier;
            const betValue = parseInt(input.value) || 10;
            const liveWin = (betValue * currentMultiplier).toFixed(2);
            
            // Live cashout amount ko button par realtime dikhana
            if (betAmount) {
                betAmount.style.setProperty("display", "block", "important"); 
                betAmount.innerHTML = liveWin + " INR";
            }
            
            if (waitingLabel) {
                waitingLabel.style.setProperty("display", "none", "important");
            }
        }
    });

    // Plane Crash hone par sab reset karne ke liye handler
    window.addEventListener("gameCrashed", () => {
        if (betBtn.classList.contains("active-cashout") || betBtn.classList.contains("successfully-cashedout")) {
            resetButtonToDefault();
        }
    });

    // CASHOUT Button click karne ka logic
    betBtn.addEventListener("click", (e) => {
        if (betBtn.classList.contains("active-cashout") || betBtn.style.backgroundColor === "rgb(212, 127, 0)") {
            e.stopImmediatePropagation(); 
            
            betBtn.classList.remove("active-cashout");
            betBtn.classList.add("successfully-cashedout");
            
            betBtn.style.setProperty("background", "#ccc", "important");
            betBtn.style.setProperty("background-color", "#ccc", "important");

            if (betMain) betMain.innerHTML = "CASHED OUT";
            
            const finalMultiplier = parseFloat(document.getElementById("counter") ? document.getElementById("counter").innerText : 1.00) || 1.00;
            const finalWin = (parseInt(input.value) * finalMultiplier).toFixed(2);
            
            if (betAmount) betAmount.innerHTML = "+" + finalWin + " INR";
        }
    });

    // Button aur borders ko wapas original state me laane ka function
    function resetButtonToDefault() {
        betBtn.className = "bet-btn"; // Sab extra classes clear
        betBtn.removeAttribute("style"); // Inline yellow styles saaf
        
        // Card reset aur lock borders ko original design par lana
        card.classList.remove("active-card");
        card.classList.remove("card-locked"); 
        card.removeAttribute("style"); // Square box ka red border reset
        
        // Agar koi hidden custom border container tha, toh use wapas show karna
        const innerBorder = card.querySelector(".bet-borders, .border-box");
        if (innerBorder) {
            innerBorder.style.removeAttribute("display");
        }

        if (betMain) betMain.innerHTML = "BET";
        
        if (waitingLabel) {
            waitingLabel.style.display = ""; 
        }
        
        if (input) {
            input.disabled = false;
            let val = parseInt(input.value) || 10;
            if (betAmount) {
                betAmount.style.setProperty("display", "block", "important");
                betAmount.innerHTML = val.toLocaleString() + ".00 INR";
            }
        }
        
        card.querySelectorAll(".circle").forEach(c => c.classList.remove("locked"));
        card.querySelectorAll(".quick button").forEach(b => b.disabled = false);
    }
});
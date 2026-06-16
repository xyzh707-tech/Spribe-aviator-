const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// PUBLIC FOLDER (Jahan tera HTML, CSS, JS hai) - Render isko serve karega
app.use(express.static(path.join(__dirname, './'))); 

// Game State
let crashTarget = 2.00;
let currentMultiplier = 1.00;
let isCrashed = false;
let startTime = null;
let timerInterval = null;

function generateRandomCrashTarget() {
    let rand = Math.random() * 100;
    if (rand < 11) return parseFloat((1.00 + Math.random() * 0.04).toFixed(2));
    else if (rand < 55) return parseFloat((1.05 + Math.random() * 0.94).toFixed(2));
    else if (rand < 90) return parseFloat((2.00 + Math.random() * 7.50).toFixed(2));
    else return parseFloat((10.00 + Math.random() * 85.00).toFixed(2));
}

function startNewRound() {
    crashTarget = generateRandomCrashTarget();
    currentMultiplier = 1.00;
    isCrashed = false;
    startTime = Date.now();
    
    console.log(`Round Started! Target: ${crashTarget}`);
    io.emit('round-start', { crashTarget: crashTarget, startTime: startTime });

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (isCrashed) return;
        const elapsed = (Date.now() - startTime) / 1000;
        let progress = Math.min(elapsed / 10, 1);
        let multiplier = 1.00 + Math.pow(progress, 1.8) * (crashTarget - 1.00);
        
        if (multiplier >= crashTarget) {
            multiplier = crashTarget;
            isCrashed = true;
            clearInterval(timerInterval);
            console.log(`Crashed at: ${crashTarget}`);
            io.emit('round-crash', { crashMultiplier: crashTarget });
            setTimeout(startNewRound, 3000);
        }
        io.emit('multiplier-update', { multiplier: multiplier });
    }, 50);
}

io.on('connection', (socket) => {
    console.log('User Connected');
    // Naye user ko current state bhejo
    if (!isCrashed && startTime) {
        socket.emit('round-start', { crashTarget, startTime });
    }
});

// Server Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startNewRound(); // Pehla round shuru karo
});

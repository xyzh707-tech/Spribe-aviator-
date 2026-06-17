const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(__dirname)); // Root folder serve karo

// Root route handle karo
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// ----- Game State -----
let currentRound = {
  period: 11111111,
  crashTarget: 2.00,
  multiplier: 1.00,
  isActive: false,
  startTime: null
};

let roundInterval = null;
let startTimeout = null;

// ----- Generate Crash Target -----
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

// ----- Crash Function -----
function crashRound() {
  if (!currentRound.isActive) return;
  currentRound.isActive = false;
  clearInterval(roundInterval);
  clearTimeout(startTimeout);
  
  console.log(`💥 Round ${currentRound.period} crashed at ${currentRound.crashTarget}x`);
  io.emit('round-crash', { 
    period: currentRound.period, 
    crashMultiplier: currentRound.crashTarget 
  });
  
  setTimeout(() => {
    startNewRound();
  }, 3000);
}

// ----- Start New Round (WITH 10 SECOND DELAY) -----
function startNewRound() {
  clearInterval(roundInterval);
  clearTimeout(startTimeout);

  currentRound.period += 1;
  currentRound.crashTarget = generateRandomCrashTarget();
  currentRound.multiplier = 1.00;
  currentRound.isActive = true;
  
  const startTime = Date.now() + 10000; 
  currentRound.startTime = startTime;

  console.log(`🛫 Round ${currentRound.period} scheduled. Target: ${currentRound.crashTarget}. Plane will take off in 10s`);

  io.emit('round-start', {
    period: currentRound.period,
    crashTarget: currentRound.crashTarget,
    startTime: startTime
  });

  startTimeout = setTimeout(() => {
    if (!currentRound.isActive) return;
    
    console.log(`✈️ Round ${currentRound.period} takeoff!`);
    io.emit('multiplier-update', { multiplier: 1.00 });

    roundInterval = setInterval(() => {
      if (!currentRound.isActive) return;
      
      const now = Date.now();
      const elapsed = (now - currentRound.startTime) / 1000;
      
      if (elapsed < 0) return;
      
      let progress = Math.min(elapsed / 10, 1);
      let multiplier = 1.00 + Math.pow(progress, 1.8) * (currentRound.crashTarget - 1.00);
      
      if (multiplier >= currentRound.crashTarget) {
        multiplier = currentRound.crashTarget;
        currentRound.multiplier = multiplier;
        io.emit('multiplier-update', { multiplier: multiplier });
        crashRound();
        return;
      }
      
      currentRound.multiplier = multiplier;
      io.emit('multiplier-update', { multiplier: multiplier });
    }, 50);
    
  }, 10000);
}

// ----- Socket Connection -----
io.on('connection', (socket) => {
  console.log('🟢 User connected');
  
  if (currentRound.isActive) {
    socket.emit('round-start', {
      period: currentRound.period,
      crashTarget: currentRound.crashTarget,
      startTime: currentRound.startTime
    });
    socket.emit('multiplier-update', { multiplier: currentRound.multiplier });
  } else {
    socket.emit('round-crash', { 
      period: currentRound.period, 
      crashMultiplier: currentRound.crashTarget 
    });
  }
});

// ----- Server Start -----
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startNewRound();
});

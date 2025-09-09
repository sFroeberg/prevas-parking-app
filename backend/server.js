const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files from frontend directory
app.use(express.static('backend/frontend'));

// Serve Socket.IO client files
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(require.resolve('socket.io/client-dist/socket.io.js'));
});

// In-memory storage for parking spots
let parkingSpots = [];

// Initialize with some default parking spots
function initializeParkingSpots() {
    const spotCount = 1; // Number of parking spots
    parkingSpots = Array.from({ length: spotCount }, (_, i) => ({
        id: `spot-${i + 1}`,
        number: i + 1,
        isOccupied: false,
        occupiedBy: null,
        lastUpdated: new Date().toISOString(),
        endTime: null,
        durationHours: null
    }));
}

// Initialize parking spots
initializeParkingSpots();

// Get all parking spots
app.get('/api/spots', (req, res) => {
    res.json(parkingSpots);
});

// Update parking spot status
app.put('/api/spots/:id', (req, res) => {
    const { id } = req.params;
    const { isOccupied, occupiedBy, durationHours } = req.body;
    
    const spotIndex = parkingSpots.findIndex(spot => spot.id === id);
    
    if (spotIndex === -1) {
        return res.status(404).json({ error: 'Parking spot not found' });
    }
    
    const endTime = isOccupied && durationHours ? 
        new Date(Date.now() + (durationHours * 60 * 60 * 1000)).toISOString() : null;
    
    parkingSpots[spotIndex] = {
        ...parkingSpots[spotIndex],
        isOccupied,
        occupiedBy: isOccupied ? (occupiedBy || 'Anonymous') : null,
        lastUpdated: new Date().toISOString(),
        endTime: endTime,
        durationHours: isOccupied ? durationHours : null
    };
    
    // Emit real-time update to all connected clients
    io.emit('spotUpdated', parkingSpots[spotIndex]);
    
    res.json(parkingSpots[spotIndex]);
});

// Reset all parking spots
app.post('/api/reset', (req, res) => {
    initializeParkingSpots();
    // Emit reset to all connected clients
    io.emit('spotsReset', parkingSpots);
    res.json({ message: 'All parking spots have been reset' });
});

// Timer function to check expired spots
function checkExpiredSpots() {
    const now = new Date();
    let spotsChanged = false;
    
    parkingSpots.forEach(spot => {
        if (spot.isOccupied && spot.endTime && new Date(spot.endTime) <= now) {
            spot.isOccupied = false;
            spot.occupiedBy = null;
            spot.endTime = null;
            spot.durationHours = null;
            spot.lastUpdated = now.toISOString();
            spotsChanged = true;
            
            // Emit real-time update for expired spot
            io.emit('spotUpdated', spot);
        }
    });
    
    return spotsChanged;
}

// Check for expired spots every minute
setInterval(checkExpiredSpots, 60000);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Send current parking spots to newly connected client
    socket.emit('initialData', parkingSpots);
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    console.log(`Access from other devices: http://[YOUR-IP]:${PORT}`);
});

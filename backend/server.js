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
let bookingHistory = []; // Store last 10 bookings
let upcomingBookings = []; // Store future bookings

// Initialize with some default parking spots
function initializeParkingSpots() {
    const spotCount = 1; // Number of parking spots
    parkingSpots = Array.from({ length: spotCount }, (_, i) => ({
        id: `spot-${i + 1}`,
        number: i + 1,
        isOccupied: false,
        occupiedBy: null,
        lastUpdated: new Date().toLocaleString("en-US", {timeZone: "Europe/Stockholm"}),
        endTime: null,
        durationHours: null,
        startTime: null,
        bookingDate: null
    }));
}

// Initialize parking spots
initializeParkingSpots();

// Get all parking spots
app.get('/api/spots', (req, res) => {
    res.json(parkingSpots);
});

// Get booking history
app.get('/api/history', (req, res) => {
    res.json(bookingHistory);
});

// Get upcoming bookings
app.get('/api/upcoming', (req, res) => {
    res.json(upcomingBookings);
});

// Delete upcoming booking
app.delete('/api/upcoming/:id', (req, res) => {
    const { id } = req.params;
    const bookingIndex = upcomingBookings.findIndex(booking => booking.id === id);
    
    if (bookingIndex === -1) {
        return res.status(404).json({ error: 'Upcoming booking not found' });
    }
    
    upcomingBookings.splice(bookingIndex, 1);
    res.json({ message: 'Upcoming booking deleted successfully' });
});

// Update parking spot status
app.put('/api/spots/:id', (req, res) => {
    const { id } = req.params;
    const { isOccupied, occupiedBy, durationHours, startTime, bookingDate } = req.body;
    
    const spotIndex = parkingSpots.findIndex(spot => spot.id === id);
    
    if (spotIndex === -1) {
        return res.status(404).json({ error: 'Parking spot not found' });
    }
    
    // Get current time in Stockholm timezone (Europe/Stockholm)
    const now = new Date();
    let bookingStartTime;
    
    if (startTime) {
        // Parse the time string for Stockholm timezone
        const [date, time] = startTime.split('T');
        const [hours, minutes] = time.split(':');
        const [year, month, day] = date.split('-');
        
        // Create date object as Stockholm local time
        bookingStartTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), 0, 0);
    } else {
        bookingStartTime = now;
    }
    
    const endTime = isOccupied && durationHours ? 
        new Date(bookingStartTime.getTime() + (durationHours * 60 * 60 * 1000)).toISOString() : null;
    
    // Get today's date in Stockholm timezone
    const stockholmToday = new Date().toLocaleDateString('sv-SE', {timeZone: 'Europe/Stockholm'});
    const today = stockholmToday;
    const selectedDate = bookingDate || today;
    const isFutureBooking = selectedDate > today;
    
    if (isOccupied && occupiedBy) {
        if (isFutureBooking) {
            // Add to upcoming bookings instead of occupying spot now
            const upcomingEntry = {
                id: uuidv4(),
                spotNumber: parkingSpots[spotIndex].number,
                occupiedBy,
                startTime: bookingStartTime.toLocaleString("en-US", {timeZone: "Europe/Stockholm"}),
                endTime,
                durationHours,
                bookingDate: selectedDate,
                timestamp: now.toLocaleString("en-US", {timeZone: "Europe/Stockholm"})
            };
            
            upcomingBookings.unshift(upcomingEntry);
            if (upcomingBookings.length > 10) {
                upcomingBookings = upcomingBookings.slice(0, 10);
            }
            
            // Don't occupy the spot for future bookings
            res.json({ message: 'Future booking created', booking: upcomingEntry });
            return;
        } else {
            // Current day booking - add to history and occupy spot
            const historyEntry = {
                id: uuidv4(),
                spotNumber: parkingSpots[spotIndex].number,
                occupiedBy,
                startTime: bookingStartTime.toLocaleString("en-US", {timeZone: "Europe/Stockholm"}),
                endTime,
                durationHours,
                bookingDate: selectedDate,
                timestamp: now.toLocaleString("en-US", {timeZone: "Europe/Stockholm"})
            };
            
            bookingHistory.unshift(historyEntry);
            if (bookingHistory.length > 10) {
                bookingHistory = bookingHistory.slice(0, 10);
            }
        }
    }
    
    // Only update spot occupancy for current day bookings
    if (!isFutureBooking || !isOccupied) {
        parkingSpots[spotIndex] = {
            ...parkingSpots[spotIndex],
            isOccupied,
            occupiedBy: isOccupied ? occupiedBy : null,
            lastUpdated: now.toLocaleString("en-US", {timeZone: "Europe/Stockholm"}),
            endTime,
            durationHours: isOccupied ? durationHours : null,
            startTime: isOccupied ? bookingStartTime.toLocaleString("en-US", {timeZone: "Europe/Stockholm"}) : null,
            bookingDate: isOccupied ? selectedDate : null
        };
    }
    
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
            spot.lastUpdated = now.toLocaleString("en-US", {timeZone: "Europe/Stockholm"});
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

// DOM Elements
const parkingGrid = document.getElementById('parkingGrid');
const resetAllBtn = document.getElementById('resetAll');
const spotModal = document.getElementById('spotModal');
const spotNumberSpan = document.getElementById('spotNumber');
const occupantNameInput = document.getElementById('occupantName');
const parkingDurationSelect = document.getElementById('parkingDuration');
const spotStatusSelect = document.getElementById('spotStatus');
const cancelUpdateBtn = document.getElementById('cancelUpdate');
const confirmUpdateBtn = document.getElementById('confirmUpdate');

// State
let spots = [];
let selectedSpot = null;
let socket = null;
let timerInterval = null;
let bookingHistory = [];
let upcomingBookings = [];

// API Configuration
const API_BASE = window.location.origin;

// Initialize the app
function init() {
    loadSpots(); // Load initial data
    loadBookingHistory(); // Load booking history
    loadUpcomingBookings(); // Load upcoming bookings
    setupEventListeners();
    startTimerUpdates();
    
    // Poll for updates every 5 seconds for near real-time updates
    setInterval(() => {
        loadSpots();
    }, 5000);
}

// Load parking spots from API
async function loadSpots() {
    try {
        const response = await fetch(`${API_BASE}/api/spots`);
        if (response.ok) {
            spots = await response.json();
            renderParkingSpots();
        } else {
            console.error('Failed to load parking spots');
        }
    } catch (error) {
        console.error('Error loading parking spots:', error);
    }
}

// Load booking history from API
async function loadBookingHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/history`);
        if (response.ok) {
            bookingHistory = await response.json();
            renderBookingHistory();
        } else {
            console.error('Failed to load booking history');
        }
    } catch (error) {
        console.error('Error loading booking history:', error);
    }
}

// Load upcoming bookings from API
async function loadUpcomingBookings() {
    try {
        const response = await fetch(`${API_BASE}/api/upcoming`);
        if (response.ok) {
            upcomingBookings = await response.json();
            renderUpcomingBookings();
        } else {
            console.error('Failed to load upcoming bookings');
        }
    } catch (error) {
        console.error('Error loading upcoming bookings:', error);
    }
}

// Update a parking spot via API
async function updateParkingSpot(spotId, isOccupied, occupiedBy, durationHours = null, startTime = null, bookingDate = null) {
    try {
        const response = await fetch(`${API_BASE}/api/spots/${spotId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                isOccupied,
                occupiedBy,
                durationHours,
                startTime,
                bookingDate
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update parking spot');
        }
        
        return true;
    } catch (error) {
        console.error('Error updating parking spot:', error);
        alert('Failed to update parking spot. Please try again.');
        return false;
    }
}

// Render parking spots in the grid
function renderParkingSpots() {
    const parkingGrid = document.getElementById('parkingGrid');
    parkingGrid.innerHTML = '';
    
    // Update quick release button visibility
    const quickReleaseBtn = document.getElementById('quickReleaseBtn');
    const hasOccupiedSpot = spots.some(spot => spot.isOccupied);
    if (quickReleaseBtn) {
        quickReleaseBtn.style.display = hasOccupiedSpot ? 'block' : 'none';
    }
    
    if (spots.length === 0) {
        parkingGrid.innerHTML = '<p>Loading parking spots...</p>';
        return;
    }
    
    spots.forEach(spot => {
        const spotElement = document.createElement('div');
        spotElement.className = `parking-spot ${spot.isOccupied ? 'occupied' : 'available'}`;
        spotElement.dataset.id = spot.id;
        
        const timeRemaining = spot.isOccupied && spot.endTime ? getTimeRemaining(spot.endTime) : null;
        const progressPercentage = spot.isOccupied && spot.endTime && spot.durationHours ? 
            getProgressPercentage(spot.endTime, spot.durationHours) : 0;
        
        const durationSelect = document.createElement('select');
        durationSelect.id = 'duration';
        durationSelect.innerHTML = `
            <option value="1">1 hour</option>
            <option value="2">2 hours</option>
            <option value="4">4 hours</option>
            <option value="8" selected>8 hours (Full day)</option>
        `;
        
        spotElement.innerHTML = `
            <div class="spot-number">${spot.number}</div>
            <div class="spot-status">${spot.isOccupied ? 'Occupied' : 'Available'}</div>
            ${spot.isOccupied ? `<div class="occupied-by">by ${spot.occupiedBy || 'Someone'}</div>` : ''}
            ${timeRemaining ? `<div class="time-remaining">${timeRemaining}</div>` : ''}
            ${spot.isOccupied ? `<div class="progress-bar"><div class="progress-fill" style="width: ${progressPercentage}%"></div></div>` : ''}
        `;
        
        parkingGrid.appendChild(spotElement);
    });
}

// Show the update modal
function showUpdateModal(spot) {
    selectedSpot = spot;
    spotNumberSpan.textContent = spot.number;
    occupantNameInput.value = '';
    
    // Set dropdown based on current status - opposite of what it currently is for easier booking/unbooking
    spotStatusSelect.value = spot.isOccupied ? 'available' : 'occupied';
    
    if (spot.isOccupied) {
        occupantNameInput.value = spot.occupiedBy || '';
    }
    
    // Show/hide duration field based on status
    const durationGroup = document.getElementById('durationGroup');
    durationGroup.style.display = spotStatusSelect.value === 'occupied' ? 'block' : 'none';
    
    spotModal.style.display = 'flex';
    
    // Focus on the name input if marking as occupied
    if (spotStatusSelect.value === 'occupied') {
        setTimeout(() => {
            occupantNameInput.focus();
        }, 100);
    }
}

// Hide the update modal
function hideUpdateModal() {
    spotModal.style.display = 'none';
    selectedSpot = null;
}


// Reset all parking spots
async function resetAllSpots() {
    if (!confirm('Are you sure you want to reset the parking spot to available?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/reset`, {
            method: 'POST',
        });
        
        if (!response.ok) {
            throw new Error('Failed to reset parking spots');
        }
        
        alert('Parking spot has been reset to available.');
    } catch (error) {
        console.error('Error resetting parking spots:', error);
        alert('Failed to reset parking spot. Please try again.');
    }
}

// Set up event listeners
function setupEventListeners() {
    // Parking spot click
    parkingGrid.addEventListener('click', (e) => {
        const spotElement = e.target.closest('.parking-spot');
        if (!spotElement) return;
        
        const spotId = spotElement.dataset.id;
        const spot = spots.find(s => s.id === spotId);
        if (spot) {
            showUpdateModal(spot);
        }
    });
    
    // Cancel update
    cancelUpdateBtn.addEventListener('click', hideUpdateModal);
    
    // Quick release button
    const quickReleaseBtn = document.getElementById('quickReleaseBtn');
    quickReleaseBtn.addEventListener('click', async () => {
        const occupiedSpot = spots.find(spot => spot.isOccupied);
        if (occupiedSpot) {
            const success = await updateParkingSpot(occupiedSpot.id, false, '', 0);
            if (success) {
                await loadSpots();
                await loadBookingHistory();
                await loadUpcomingBookings();
            }
        }
    });
    
    // Set default booking date to today
    const bookingDateInput = document.getElementById('bookingDate');
    const startTimeInput = document.getElementById('startTime');
    const today = new Date().toISOString().split('T')[0];
    bookingDateInput.value = today;
    
    // Confirm update
    confirmUpdateBtn.addEventListener('click', async () => {
        if (!selectedSpot) return;
        
        const isOccupied = spotStatusSelect.value === 'occupied';
        const occupantName = isOccupied ? (occupantNameInput.value.trim() || 'Anonymous') : '';
        const durationHours = isOccupied ? parseInt(parkingDurationSelect.value) : null;
        const bookingDate = isOccupied ? bookingDateInput.value : null;
        const startTime = isOccupied ? `${bookingDate}T${startTimeInput.value}:00` : null;
        
        if (isOccupied && !occupantName) {
            alert('Please enter your name or use "Anonymous"');
            return;
        }
        
        const success = await updateParkingSpot(
            selectedSpot.id,
            isOccupied,
            isOccupied ? occupantName : '',
            durationHours,
            startTime,
            bookingDate
        );
        
        if (success) {
            await loadSpots();
            await loadBookingHistory();
            await loadUpcomingBookings();
            hideUpdateModal();
        }
    });
    
    // Reset all button
    resetAllBtn.addEventListener('click', resetAllSpots);
    
    // Update occupant name input visibility based on status
    spotStatusSelect.addEventListener('change', (e) => {
        const isOccupied = e.target.value === 'occupied';
        document.querySelector('.form-group:first-child').style.display = isOccupied ? 'block' : 'none';
        document.getElementById('durationGroup').style.display = isOccupied ? 'block' : 'none';
        
        if (isOccupied) {
            setTimeout(() => {
                occupantNameInput.focus();
            }, 100);
        }
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === spotModal) {
            hideUpdateModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && spotModal.style.display === 'flex') {
            hideUpdateModal();
        }
    });
}

// Timer utility functions
function getTimeRemaining(endTime) {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m left`;
    } else {
        return `${minutes}m left`;
    }
}

function getProgressPercentage(endTime, durationHours) {
    const now = new Date();
    const end = new Date(endTime);
    const start = new Date(end.getTime() - (durationHours * 60 * 60 * 1000));
    
    const totalDuration = end - start;
    const elapsed = now - start;
    
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

function startTimerUpdates() {
    // Update timers every minute
    timerInterval = setInterval(() => {
        renderParkingSpots(); // Just update the display, server handles expiration
    }, 60000); // 60 seconds
}

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Render booking history
function renderBookingHistory() {
    const historyContainer = document.getElementById('bookingHistory');
    
    if (bookingHistory.length === 0) {
        historyContainer.innerHTML = '<div class="no-history">No recent bookings</div>';
        return;
    }
    
    historyContainer.innerHTML = bookingHistory.map(entry => {
        const startDate = new Date(entry.startTime);
        const endDate = new Date(entry.endTime);
        const isToday = entry.bookingDate === new Date().toISOString().split('T')[0];
        const dateLabel = isToday ? 'Today' : startDate.toLocaleDateString();
        
        return `
            <div class="history-item">
                <div>
                    <div class="history-user">${entry.occupiedBy}</div>
                    <div class="history-details">
                        ${startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                        ${endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                        (${entry.durationHours}h)
                    </div>
                </div>
                <div class="history-date">${dateLabel}</div>
            </div>
        `;
    }).join('');
}

// Render upcoming bookings
function renderUpcomingBookings() {
    const upcomingContainer = document.getElementById('upcomingBookings');
    
    if (upcomingBookings.length === 0) {
        upcomingContainer.innerHTML = '<div class="no-history">No upcoming bookings</div>';
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];
    
    upcomingContainer.innerHTML = upcomingBookings.map(entry => {
        const startDate = new Date(entry.startTime);
        const endDate = new Date(entry.endTime);
        
        let dateLabel;
        if (entry.bookingDate === tomorrowString) {
            dateLabel = 'Tomorrow';
        } else {
            dateLabel = startDate.toLocaleDateString();
        }
        
        return `
            <div class="history-item">
                <div>
                    <div class="history-user">${entry.occupiedBy}</div>
                    <div class="history-details">
                        ${startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                        ${endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                        (${entry.durationHours}h)
                    </div>
                </div>
                <div class="history-date">${dateLabel}</div>
            </div>
        `;
    }).join('');
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

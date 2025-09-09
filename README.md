# Office Parking App

A simple client-side web application to track parking spot availability at the office.

## Features

- View all parking spots and their current status (available/occupied)
- Mark a parking spot as occupied with your name
- Free up a parking spot when it becomes available
- Responsive design that works on desktop and mobile devices
- Simple and intuitive interface
- Data persists in browser localStorage (no server required!)

## Prerequisites

- Any modern web browser
- No Node.js or server setup required!

## Getting Started

### Simple Setup (Recommended)

1. Navigate to the `frontend` directory
2. Simply open `index.html` in your web browser by double-clicking it

That's it! The app will work immediately.

### Alternative: Using a Local Server

If you prefer to serve the files through a local server:

1. Install dependencies: `npm install`
2. Start server: `npm start`
3. Open: `http://localhost:3001`

## Features

- Single parking slot management
- 8-hour default booking duration
- Auto-release when timer expires
- Real-time updates via Socket.IO
- Mobile-optimized PWA
- Quick release button

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JavaScript, CSS
- **Storage**: In-memory (RAM)
- **Real-time**: WebSocket connections

## Usage

1. **Book slot**: Tap parking spot → Enter name → Select duration
2. **Quick release**: Tap red "Make Available" button
3. **Auto-release**: Slot becomes available when timer reaches zero
4. **Install as app**: Add to home screen on mobile devices

## How to Use

1. **View Parking Spots**:
   - Available spots are shown in green
   - Occupied spots are shown in red with the name of the person who took the spot

2. **Update a Parking Spot**:
   - Click on any parking spot to update its status
   - In the modal, select whether the spot is available or occupied
   - If marking as occupied, enter your name (or leave as "Anonymous")
   - Click "Update" to save your changes

3. **Reset All Spots**:
   - Click the "Reset All Spots" button to mark all spots as available
   - This is useful at the start of each day

## Architecture

- **Frontend**: Vanilla JavaScript, HTML, and CSS
- **Data Storage**: Browser localStorage (persists between sessions)
- **No Backend Required**: Fully client-side application

## Data Persistence

The app uses your browser's localStorage to save parking spot data. This means:
- Data persists even when you close and reopen the browser
- Each browser/device maintains its own data
- To share data between colleagues, you'll need to deploy the app to a shared location

## Future Enhancements

- User authentication
- Shared database for real-time collaboration
- Real-time updates using WebSockets
- Parking spot reservations
- Admin dashboard for managing parking spots
- Mobile app version

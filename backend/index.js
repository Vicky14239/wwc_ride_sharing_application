// --------------------------------------------------------
// Import necessary libraries
// --------------------------------------------------------

const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config.js');
const Pusher = require('pusher');
const PushNotifications = require('pusher-push-notifications-node');

const app = express();
const pusher = new Pusher(config.pusher);
const pushNotifications = new PushNotifications(config['pusher-notifications']);

// --------------------------------------------------------
// Simulated in-memory database
// --------------------------------------------------------

let rider = null;
let driver = null;
let userId = null;
let currentStatus = "Neutral";

// --------------------------------------------------------
// Middleware setup
// --------------------------------------------------------

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// --------------------------------------------------------
// Utility functions
// --------------------------------------------------------

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
        const random = Math.random() * 16 | 0;
        const value = char === 'x' ? random : (random & 0x3 | 0x8);
        return value.toString(16);
    });
}

function sendRiderNotificationFor(status) {
    let alert;
    switch (status) {
        case "Neutral":
            alert = {
                title: "Driver Cancelled :(",
                body: "Sorry, your driver had to cancel. Open the app to request again.",
            };
            break;
        case "FoundRide":
            alert = {
                title: "\ud83d\ude95 Ride Found",
                body: "The driver is on the way."
            };
            break;
        case "Arrived":
            alert = {
                title: "\ud83d\ude95 Driver Waiting",
                body: "The driver is outside. Please meet him."
            };
            break;
        case "OnTrip":
            alert = {
                title: "\ud83d\ude95 On Your Way",
                body: "The trip has started. Enjoy your ride."
            };
            break;
        case "EndedTrip":
            alert = {
                title: "\ud83c\udf1f Ride Complete",
                body: "Your ride cost $15. Open the app to rate the driver."
            };
            break;
    }

    if (alert) {
        pushNotifications.publish(['rider'], { apns: { aps: { alert, sound: "default" } } })
            .then(response => console.log('Notification sent:', response.publishId))
            .catch(error => console.error('Notification error:', error));
    }
}

function notifyDriver() {
    pushNotifications.publish(['ride_requests'], {
        apns: {
            aps: {
                alert: {
                    title: "\ud83d\ude97 New Ride Request",
                    body: `New pickup request from ${rider.name}.`,
                },
                category: "DriverActions",
                'mutable-content': 1,
                sound: 'default'
            },
            data: {
                'attachment-url': "https://maps.google.com/maps/api/staticmap?markers=color:red|37.388064,-122.088426&zoom=13&size=500x300&sensor=true"
            }
        }
    })
    .then(response => console.log('Notification sent:', response.publishId))
    .catch(error => console.error('Notification error:', error));
}

// --------------------------------------------------------
// API routes
// --------------------------------------------------------

// Rider endpoints
app.get('/status', (req, res) => res.json({ status: currentStatus }));

app.get('/request', (req, res) => res.json(driver));

app.post('/request', (req, res) => {
    userId = req.body.user_id;
    currentStatus = "Searching";
    rider = { name: "Jane Doe", number: "+18001234567", longitude: -122.088426, latitude: 37.388064 };

    notifyDriver();

    pusher.trigger('cabs', 'status-update', { status: currentStatus, rider });
    res.json({ success: true });
});

app.delete('/request', (req, res) => {
    driver = null;
    currentStatus = "Neutral";
    pusher.trigger('cabs', 'status-update', { status: currentStatus });
    res.json({ success: true });
});

// Driver endpoints
app.get('/pending-rider', (req, res) => res.json(rider));

app.post('/status', (req, res) => {
    currentStatus = req.body.status;

    if (currentStatus === "EndedTrip" || currentStatus === "Neutral") {
        rider = driver = null;
    } else {
        driver = { name: "John Doe" };
    }

    sendRiderNotificationFor(currentStatus);

    pusher.trigger('cabs', 'status-update', { status: currentStatus, driver });
    res.json({ success: true });
});

// Default endpoint
app.get('/', (req, res) => res.json({ status: "success" }));

// --------------------------------------------------------
// Start the server
// --------------------------------------------------------

app.listen(4000, () => console.log('Server running on port 4000!'));

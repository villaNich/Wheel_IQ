/*
CSC3916 HW2
File: Server.js
Description: Web API scaffolding for Movie API
 */

var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var cors = require('cors');
var path = require('path');
var WebSocket = require('ws');

var app = express();
var server = http.createServer(app);
var wss = new WebSocket.Server({ server });

// Store connected users and messages
const users = new Map();
const messages = [];

// Add default user for testing
const defaultUser = {
    id: 'default',
    username: 'TestUser',
    avatar: 'default-avatar.png'
};

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

var router = express.Router();

// Welcome page route
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add a route to get default user info
router.get('/api/default-user', (req, res) => {
    res.json(defaultUser);
});

app.use('/', router);

// WebSocket connection handling
wss.on('connection', (ws) => {
    let userId = defaultUser.id;
    let username = defaultUser.username;
    let avatar = defaultUser.avatar;

    // Automatically join with default user
    users.set(userId, { ws, username, avatar });
    
    // Send message history to new user
    ws.send(JSON.stringify({
        type: 'history',
        messages: messages.slice(-50)
    }));

    // Broadcast user joined message
    broadcast({
        type: 'system',
        content: `${username} joined the chat`
    });

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'message':
                const messageData = {
                    type: 'message',
                    userId,
                    username,
                    avatar,
                    content: data.content,
                    timestamp: new Date().toISOString()
                };
                messages.push(messageData);
                broadcast(messageData);
                break;

            case 'typing':
                broadcast({
                    type: 'typing',
                    userId,
                    username,
                    isTyping: data.isTyping
                });
                break;
        }
    });

    ws.on('close', () => {
        if (userId) {
            users.delete(userId);
            broadcast({
                type: 'system',
                content: `${username} left the chat`
            });
        }
    });
});

function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Update the server listen call
server.listen(process.env.PORT || 8080, () => {
    console.log(`Server is running on port ${process.env.PORT || 8080}`);
});

module.exports = app; // for testing only



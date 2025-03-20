/*
CSC3916 HW2
File: Server.js
Description: Web API scaffolding for Movie API
 */

var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
db = require('./db')(); //hack
var jwt = require('jsonwebtoken');
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

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', (req, res) => {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var newUser = {
            username: req.body.username,
            password: req.body.password
        };

        db.save(newUser); //no duplicate checking
        res.json({success: true, msg: 'Successfully created new user.'})
    }
});

router.post('/signin', (req, res) => {
    var user = db.findOne(req.body.username);

    if (!user) {
        res.status(401).send({success: false, msg: 'Authentication failed. User not found.'});
    } else {
        if (req.body.password == user.password) {
            var userToken = { id: user.id, username: user.username };
            var token = jwt.sign(userToken, process.env.SECRET_KEY);
            res.json ({success: true, token: 'JWT ' + token});
        }
        else {
            res.status(401).send({success: false, msg: 'Authentication failed.'});
        }
    }
});

router.route('/testcollection')
    .delete(authController.isAuthenticated, (req, res) => {
        console.log(req.body);
        res = res.status(200);
        if (req.get('Content-Type')) {
            res = res.type(req.get('Content-Type'));
        }
        var o = getJSONObjectForMovieRequirement(req);
        res.json(o);
    }
    )
    .put(authJwtController.isAuthenticated, (req, res) => {
        console.log(req.body);
        res = res.status(200);
        if (req.get('Content-Type')) {
            res = res.type(req.get('Content-Type'));
        }
        var o = getJSONObjectForMovieRequirement(req);
        res.json(o);
    }
    );
    
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



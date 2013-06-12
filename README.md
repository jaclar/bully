# Bully

node.js module to elect a master peer in a distributed system. This module uses the
[Bully Algorithm](http://en.wikipedia.org/wiki/Bully_algorithm) for the election
process. Unresponsive/offline peers will be recognized through heartbeat timeouts.

## Usage

Install via ```npm```:
```bash
npm install bully
```

Include in your project
```javascript
var Bully = require('bully');

var opts = { id: "id", /* unique identifier of this peer */
             peers: [], /* event emitter instances of other peers */
             me: me /* event emitter instance of local peer */
           }

var bully = new Bully(opts);

bully.on("master", function () {
    console.dir('I am now the master');
});
bully.on("stepped_down", function () {
    console.dir('Unfortunately I had to step down from my responsibilities');
});

```

### Adding a new peer

```javascript
var EventEmitter = require('events').EventEmitter;

var peer = new EventEmitter();
peer.id = 'anoter_unique_id';

bully.addPeer(peer);
```

### Remove peer

```javascript
bully.removePeer("peers_unique_id");
```

### Error handling

```javascript
bully.on("error", function (err) {
    // handle error here
});
```

**Erros:**

-  ```Unknown Peer```: triggered once a message is received from an unknown

## Example

```javascript
var Bully = require('bully');

var EventEmitter = require("events").EventEmitter;

var peers = [],
    bullies = [],
    identifiers = [];

// generating identifiers
var i = 0;
for (i = 0;i < 10; i+= 1) {
    identifiers.push(i);
}

// generating peers
identifiers.forEach(function (n) {
    var peer = new EventEmitter();
    peer.id = n;
    peers.push(peer);
});

// setting up bully instances for each peer
identifiers.forEach(function (b) {
    var opts = {
        id: b,
        timeout: 500
    },
    bully;

    opts.peers = peers.filter(function (p) {
        if (p.id === b) {
            opts.me = p;
            return false;
        } else {
            return true;
        }
    });

    bully = new Bully(opts);

    bully.on("master", function () {
        console.dir(b + ": is now master");
    });

    bully.on("stepped_down", function () {
        console.dir(b + ": stepped down");
    });
    bullies.push(bully);
});

// removing peer 9
setTimeout(function () {
    console.log("\nDelete bully 9");
    bullies[9].stepDown();
    peers[9].removeAllListeners();

}, 8000);

// adding new peer (10)
setTimeout(function () {
    console.log("\nAdd bully 10");
    var peer = new EventEmitter();
    peer.id = 10;
    peers.push(peer);

    var opts = {
        id: 10,
        timeout: 500
    },
        bully;

    opts.peers = peers.filter(function (p) {
        if (p.id === 10) {
            opts.me = p;
            return false;
        } else {
            return true;
        }
    });

    bullies.forEach(function (b) {
        b.addPeer(peer);
    });
    bully = new Bully(opts);

    bully.on("master", function () {
        console.dir(10 + ": is now master");
    });

    bully.on("stepped_down", function () {
        console.dir(10 + ": stepped down");
    });
    bullies.push(bully);


}, 10000);var EventEmitter = require("events").EventEmitter;

var peers = [],
    bullies = [],
    identifiers = [];

// generating identifiers
var i = 0;
for (i = 0;i < 10; i+= 1) {
    identifiers.push(i);
}

// generating peers
identifiers.forEach(function (n) {
    var peer = new EventEmitter();
    peer.id = n;
    peers.push(peer);
});

// setting up bully instances for each peer
identifiers.forEach(function (b) {
    var opts = {
        id: b,
        timeout: 500
    },
    bully;

    opts.peers = peers.filter(function (p) {
        if (p.id === b) {
            opts.me = p;
            return false;
        } else {
            return true;
        }
    });

    bully = new Bully(opts);

    bully.on("master", function () {
        console.dir(b + ": is now master");
    });

    bully.on("stepped_down", function () {
        console.dir(b + ": stepped down");
    });
    bullies.push(bully);
});

// removing peer 9
setTimeout(function () {
    console.log("\nDelete bully 9");
    bullies[9].stepDown();
    peers[9].removeAllListeners();

}, 3000);

// adding new peer (10)
setTimeout(function () {
    console.log("\nAdd bully 10");
    var peer = new EventEmitter();
    peer.id = 10;
    peers.push(peer);

    var opts = {
        id: 10,
        timeout: 500
    },
        bully;

    opts.peers = peers.filter(function (p) {
        if (p.id === 10) {
            opts.me = p;
            return false;
        } else {
            return true;
        }
    });

    bullies.forEach(function (b) {
        b.addPeer(peer);
    });
    bully = new Bully(opts);

    bully.on("master", function () {
        console.dir(10 + ": is now master");
    });

    bully.on("stepped_down", function () {
        console.dir(10 + ": stepped down");
    });
    bullies.push(bully);


}, 5000);

setTimeout(function () {
    console.log("\nSend faked victory message");

    bullies[3].on("error", function (err) {
        if (err.message === "Unknown Peer") {
            console.dir("Peer 3 ignored malicious victory claim form unknown peer " + err.id);
        }
    });
    // send malicious peer victory
    peers[3].emit("victory", {id: 99});
}, 6000);
```

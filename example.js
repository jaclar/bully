var Bully = require("./index");

var EventEmitter = require("events").EventEmitter;

var peers = [],
    bullies = [],
    identifiers = [];

// generating identifiers
var i = 0;
for (i = 0;i < 10; i+= 1) {
    identifiers.push("0" + i);
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
    bullies[9].destroy();

}, 3000);

// adding new peer (10)
setTimeout(function () {
    console.log("\nAdd bully 10");
    var peer = new EventEmitter();
    peer.id = "10";
    peers.push(peer);

    var opts = {
        id: "10",
        timeout: 500
    },
        bully;

    opts.peers = peers.filter(function (p) {
        if (p.id === "10") {
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
        console.dir("10" + ": is now master");
    });

    bully.on("stepped_down", function () {
        console.dir("10" + ": stepped down");
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
}, 7000);

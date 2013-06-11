/**
 * Author: Lars Jacob (lars@iamat.com)
 * implementation of bully algorithm (https://en.Wikipedia.org/wiki/Bully_algorithm)
 */

var EventEmitter = require('events').EventEmitter,
    inherits = require('inherits'),
    debug = require('debug')('bully');

inherits(Bully, EventEmitter);

/**
 * Contractor for Bully object
 * The opts object needs at least a unique id (id) and a peer (me)
 * as member. Bully manages the notion of peers which have the only
 * requirement to have an unique id and be an instance of an EventEmitter.
 *
 * @constructor
 * @param {Object} opts Options to configure Bully instance
 */
function Bully (opts) {
    var self = this;

    self.id = opts.id;
    self.me = opts.me;
    self.peers = opts.peers || [];
    self.timeout = opts.timeout || 1000;

    self.master = { failed: 0 };

    self.peers.forEach(function (peer) {
        if (peer.id === self.id) {
            self.emit("error", new Error("Cant have same ids (%s)", self.id));
        }
    });

    self._listenElectionInquiry();
    self._listenVictory();

    self._electNewMaster();

    self.me.on("ping", function (data) {
        debug("%s: received ping from master %s", self.id, data.id);
        if (self.master.peer && data.id === self.master.peer.id) {
            self.master.lastSeen = Date.now();
        } else {
            self._electNewMaster();
        }
    });

};

/**
 * Add a new peer to the Bully object.
 */
Bully.prototype.addPeer = function (peer) {
    var self = this;
    self.peers.push(peer);
};

Bully.prototype.removePeer = function (id) {
    var self = this;
    if (self.master.peer && id === self.master.peer.id) {
        clearInterval(self.master.interval);
    }
    self.peers = self.peers.filter(function (peer) {
        return peer.id !== id;
    });
    self._electNewMaster();
};


Bully.prototype._electNewMaster = function () {
    var self = this;
    var answers = {};
    debug("%s: elect new master", self.id);

    self.me.on("alive", function (data) {
        debug("%s -> %s: alive", data.id, self.id);
        answers[data.id] = true;
    });

    self.peers.forEach(function (peer) {
        if (peer.id > self.id) {
            answers[peer.id] = false;
            debug("%s -> %s: vote_inquiry", self.id, peer.id);
            peer.emit("vote_inquiry", {id: self.id});
        }
    });


    setTimeout(function () {
        var victory = Object.keys(answers).every(function (peer) { return !answers[peer]; });
        debug("%s: evaluating poll results", self.id);
        self.me.removeAllListeners("alive");
        if (victory) {
            self._broadcastVictory();
            self._assumePower();
        } else if (Object.keys(answers) > 0) {
            // if the server answered but didn't assume power'
            self._electNewMaster();
        }
    }, self.timeout);
};

Bully.prototype._broadcastVictory = function () {
    var self = this;
    self.peers.forEach(function (peer) {
        debug("%s -> %s: victory", self.id, peer.id);
        peer.emit("victory", {id: self.id});
    });
};

Bully.prototype._assumePower = function () {
    var self = this;
    if (self.master.self) {
        // nothing to do here
        return;
    }
    self.master.self = true;
    self.emit("master");

    self.victoryInterval = setInterval(function () {
        self.peers.forEach(function (peer) {
            debug("%s -> %s: master ping", self.id, peer.id);
            peer.emit("ping", {id: self.id});
        });
    }, self.timeout);

};

Bully.prototype._listenElectionInquiry = function () {
    var self = this;
    self.me.on("vote_inquiry", function (data) {
        debug("%s -> %s: alive", self.id, data.id);
        self.getPeer(data.id).emit("alive", {id: self.id});
    });
};

Bully.prototype.getPeer = function (id) {
    var self = this;
    var ret;

    self.peers.forEach(function (peer) {
        if (peer.id === id) {
            ret = peer;
        }
    });
    return ret;
};

Bully.prototype._listenVictory = function () {
    var self = this;
    self.me.on("victory", function (data) {
        if (data.id < self.id) {
            debug("%s: call for new elections (%s)", self.id, data.id);
            self._electNewMaster();
        } else {
            debug("%s: new master %s", self.id, data.id);
            self._newMaster(self.getPeer(data.id));
        }
    });
};

Bully.prototype._newMaster = function (peer) {
    var self = this;

    self.stepDown();
    clearInterval(self.master.interval);

    self.master.lastSeen = Date.now();
    self.master.peer = peer;
    self.master.interval = setInterval(function () {
        var now = Date.now(),
            diff = now - self.master.lastSeen;
        debug("%s: check on master", self.id);
        if (diff - 10 > self.timeout) {
            debug("%s: master ping timeout %s: %dms", self.id, peer.id, diff);
            self._electNewMaster();
            clearInterval(self.master.interval);
        }
    }, self.timeout);
    debug("%s; listening to ping of master %s", self.id, self.master.peer.id);
};

Bully.prototype.stepDown = function () {
    var self = this;
    if (self.master.self) {
        self.master.self = false;
        self.emit("stepped_down");
    }
    clearInterval(self.victoryInterval);
};

module.exports = Bully;

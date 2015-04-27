/**
 * Author: Lars Jacob (lars@iamat.com)
 * implementation of bully algorithm (https://en.Wikipedia.org/wiki/Bully_algorithm)
 */

"use strict";

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

    debug("%s: initializing", opts.id);
    self.id = opts.id;
    self.me = opts.me;
    self.peers = opts.peers || [];
    debug("%s: known peers %s", self.id, JSON.stringify(self.peers.map(function (p){return p.id})));
    self.timeout = opts.timeout || 1000;

    self.heartbeat = opts.heartbeat || self.timeout * 3;

    self.master = { failed: 0 };

    self.peers.forEach(function (peer) {
        if (peer.id === self.id) {
            self.emit("error", new Error("Cant have same ids (%s)", self.id));
        }
    });

    self._listenElectionInquiry();
    self._listenVictory();

    setTimeout(function() {
        //delay master election
        debug("%s: time to elect new master", self.id);
        self._electNewMaster();

        // watch dog if there is no master set
        self._watchdog = setInterval(function () {
            if (self.master.peer || self.master.self || self.electionInProgress) {
                return;
            }
            debug("%s: No master: %s, %s, %s", self.id, JSON.stringify(self.master.peer), self.master.self, self.electionInProgress);
            self.emit("error", new Error("No master exists"));
            self._electNewMaster();
        }, self.heartbeat);
    }, self.timeout);


    self.me.on("ping", function (data) {
        if (self.master.peer && data.id === self.master.peer.id) {
            self.master.lastSeen = Date.now();
        } else {
            debug("%s: received ping from non master peer %s", self.id, data.id);
            self._electNewMaster();
        }
    });
};

/**
 * Add a new peer to the Bully object.
 */
Bully.prototype.addPeer = function (peer) {
    var self = this;

    if (self.getPeerIds().indexOf(peer.id) !== -1) {
        self.emit("error", new Error("Duplicated peer id: " + peer.id));
        return;
    }

    if (self.id === peer.id) {
        self.emit("error", new Error("Can't add myself to peer list: " + peer.id));
        return;
    }

    self.peers.push(peer);
    debug("%s: added new peer %s", self.id, peer.id);
    self._electNewMaster();
};

Bully.prototype.removePeer = function (id) {
    var self = this;
    if (self.master.peer && id === self.master.peer.id) {
        clearInterval(self.master.interval);
    }
    self.peers = self.peers.filter(function (peer) {
        return peer.id !== id;
    });
    debug("%s: removed peer %s", self.id, id);
    self._electNewMaster();
};


Bully.prototype._electNewMaster = function () {
    var self = this;
    var answers = {};
    debug("%s: elect new master", self.id);

    if (this.electionInProgress) {
        return;
    }
    this.electionInProgress = true;
    self.me.on("alive", function (data) {
        debug("%s -> %s: alive received", data.id, self.id);
        answers[data.id] = true;
    });

    self.peers.forEach(function (peer) {
        if (peer.id > self.id) {
            answers[peer.id] = false;
            debug("%s -> %s: vote_inquiry", self.id, peer.id);
            peer.emit("vote_inquiry", {id: self.id});
        }
    });

    // waiting for results coming in
    setTimeout(function () {
        var victory = Object.keys(answers).every(function (peer) { return !answers[peer]; });
        debug("%s: evaluating poll results", self.id);
        debug("%s: %s -> %s", self.id, JSON.stringify(answers), victory);

        self.electionInProgress = false;
        self.me.removeAllListeners("alive");

        if (victory) {
            self._broadcastVictory();
            self._assumePower();
        } else if (Object.keys(answers) > 0) {
            setTimeout(function () {
                if (!self._didNewMasterAsumePower(answers)) {
                    debug("%s: new master did not asumed power", self.id);
                    self._electNewMaster();
                }
            }, self.timeout);
        }
    }, self.timeout);
};

Bully.prototype._didNewMasterAsumePower = function (answers) {
    var self = this,
        peer,
        master = -1,
        ret = false;

    if (!self.master.peer) {
        debug("%s: no master peer", self.id);
        return false;
    }

    for (peer in answers) {
        if (peer > master && answers[peer]) {
            master = peer;
        }
    }

    return self.master.peer.id === master;
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
    delete self.master.peer;
    debug("%s: emiting master", self.id);
    self.emit("master");

    self.victoryInterval = setInterval(function () {
        self.peers.forEach(function (peer) {
            debug("%s -> %s: ping", self.id, peer.id);
            peer.emit("ping", {id: self.id});
        });
    }, self.heartbeat);

};

Bully.prototype._listenElectionInquiry = function () {
    var self = this;
    self.me.on("vote_inquiry", function (data) {
        var peer = self.getPeer(data.id);
        if (peer) {
        debug("%s -> %s: alive sent", self.id, data.id);
            peer.emit("alive", {id: self.id});
        }
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

    if (!ret) {
        var err = new Error("Unknown Peer");
        err.id = id;
        self.emit("error", err);
    }
    return ret;
};

Bully.prototype.getPeerIds = function () {
    var self = this;

    return self.peers.map(function (peer) { return peer.id; });
};

Bully.prototype._listenVictory = function () {
    var self = this;
    self.me.on("victory", function (data) {
        if (data.id < self.id) {
            debug("%s: new master has smaller id %s", self.id, data.id);
            self._electNewMaster();
        } else {
            var peer = self.getPeer(data.id);
            if (peer) {
                self._newMaster(peer);
            } else {
                debug("%s: unknown peer %s", self.id, data.id);
                self._electNewMaster();
            }
        }
    });
};

Bully.prototype._newMaster = function (peer) {
    var self = this;

    self.stepDown();
    clearInterval(self.master.interval);

    self.master.lastSeen = Date.now();
    self.master.peer = peer;
    debug("%s: new master %s", self.id, peer.id);
    self.master.interval = setInterval(function () {
        var now = Date.now(),
            diff = now - self.master.lastSeen;
        if (diff - (self.heartbeat/10) > self.heartbeat) {
            clearInterval(self.master.interval);
            debug("%s: master ping timeout %s: %dms", self.id, peer.id, diff);
            self._electNewMaster();
        }
    }, self.heartbeat);
    debug("%s; listening to ping of master %s", self.id, self.master.peer.id);
};

Bully.prototype.stepDown = function () {
    var self = this;
    if (self.master.self) {
        self.master.self = false;
        debug("%s: emiting stepped_down", self.id);
        self.emit("stepped_down");
    }
    clearInterval(self.victoryInterval);
};

Bully.prototype.destroy = function () {
    var self = this;

    // cleaning all intervals
    self.stepDown();
    clearInterval(self._watchdog);
    clearInterval(self.master.interval);
    self.me.removeAllListeners(["ping", "vote_inquiry", "victory"]);
    self.removeAllListeners();
};

module.exports = Bully;

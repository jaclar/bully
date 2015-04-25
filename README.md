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

**Errors:**

-  ```Unknown Peer```: triggered once a message is received from an unknown

## Example

See ```example.js```. Run with full debug information as follows:

```javascript
DEBUG=bully npm test
```

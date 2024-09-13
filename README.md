## eufy-robovac-js

Yet another NodeJS library to control a Eufy RoboVac.

## Install

    npm install @george.talusan/eufy-robovac-js

## Configuration

See https://github.com/gtalusan/eufy-device-id-js for obtaining your Eufy Robovac's device ID and local key.

## How to use

### Create an instance of RoboVac

```
import { RoboVac } from '@george.talusan/eufy-robovac-js';

const vac = new RoboVac({ ip: 'some ip', deviceId: 'your device id', localKey: 'your local key' });
```

### Wire up event listeners

```
vac.on('error', error => console.log(error)); // listen for errors
vac.on('tuya.connected', fn); // reflected event from TuyAPI
vac.on('tuya.disconnected', fn); // reflected event from TuyAPI
vac.on('tuya.data', data => console.log(data)); // reflected event from TuyAPI
vac.on('tuya.dp-refresh', data => console.log(data)); // reflected event from TuyAPI

vac.on('event', ({ command, value }) => console.log(command, value)); // human readable dp-refresh/data events
vac.on('alert', ({ consumable, duration }) => console.log(consumable, duration)); // alerts when consumables should be replaced
```

### Commands

Refer to the source code for various functionality.  Typical setters/commands are async.  Use await appropriately.

All getters retrieve values from the output of dp-refresh/data events and are hence cached.  Thus, `set(X) == Y` does not mean necessarily `get(X) == Y`.  In other words, do not assume setters are idempotent.

## Other projects using this library

* Homebridge: https://github.com/gtalusan/homebridge-eufy-robovac
* Node-RED: https://github.com/gtalusan/node-red-contrib-eufy-robovac

## Credits

Inspired by various projects.

* https://github.com/apexad/eufy-robovac
* https://github.com/bmccluskey/robovac

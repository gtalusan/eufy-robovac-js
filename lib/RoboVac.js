const debug = require('debug');
const api = require('tuyapi');
const { EventEmitter } = require('events');

const COMMAND = {
  playPause: '2',
  workMode: '5',
  activity: '15',
  goHome: '101',
  findMyRobot: '103',
  battery: '104',
  error: '106',
  cleaningRuntime: '109',
  cleaningCoverage: '110',
  volume: '111',
  consumables: '116',
  multimaps: '117',
  rooms: '124',
  voice: '125',
  hello: '126',
  autoReturn: '135',
  status: '142',
};

const ERRORS = {
  0: 'no error',
  1: 'front bumper stuck',
  2: 'wheel stuck',
  3: 'side brush',
  4: 'rolling brush bar stuck',
  5: 'device trapped',
  6: 'device trapped',
  7: 'wheel suspended',
  8: 'low battery',
  9: 'magnetic boundary',
  12: 'right wall sensor',
  13: 'device tilted',
  14: 'insert dust collector',
  17: 'restricted area detected',
  18: 'laser cover stuck',
  19: 'laser sensor stuck',
  20: 'laser sensor blocked',
  21: 'base blocked',
  S1: 'battery',
  S2: 'wheel module',
  S3: 'side brush',
  S4: 'suction fan',
  S5: 'rolling brush',
  S8: 'path tracking sensor',
  Wheel_stuck: 'wheel stuck',
  R_brush_stuck: 'rolling brush stuck',
  Crash_bar_stuck: 'front bumper stuck',
  sensor_dirty: 'sensor dirty',
  N_enough_pow: 'low battery',
  Stuck_5_min: 'device trapped',
  Fan_stuck: 'fan stuck',
  S_brush_stuck: 'side brush stuck',
};

class RoboVac extends EventEmitter
{
  dps = {};

  constructor({ ip, deviceId, localKey }) {
    super();
    this.ip = ip;
    this.deviceId = deviceId;
    this.localKey = localKey;
    this.dps = {};
    this.connected = false;
  }

  async initialize() {
    this.device = new api({
      id: this.deviceId,
      key: this.localKey,
      ip: this.ip,
      version: '3.3',
      issueRefreshOnConnect: true,
    });

    this.device.on('connected', () => {
      this.connected = true;
      this.emit('tuya.connected');
    });

    this.device.on('disconnected', () => {
      this.connected = false;
      this.emit('tuya.disconnected');
    });

    this.device.on('error', error => {
      this.emit('tuya.error', error);
    });

    this.device.on('data', data => {
      this.dps = { ...this.dps, ...data.dps };
      this.emit('tuya.data', data);
    });

    this.device.on('dp-refresh', data => {
      this.dps = { ...this.dps, ...data.dps };
      this.emit('tuya.dp-refresh', data);

      Object.keys(data.dps).forEach(command => {
        const value = data.dps[command];
        if (command === COMMAND.workMode) {
          this.emit('event', { command: 'playPause', value });
        }
        else if (command === COMMAND.workMode) {
          this.emit('event', { command: 'workMode', value });
        }
        else if (command === COMMAND.activity) {
          this.emit('event', { command: 'activity', value });
        }
        else if (command === COMMAND.goHome) {
          this.emit('event', { command: 'goHome', value });
        }
        else if (command === COMMAND.findMyRobot) {
          this.emit('event', { command: 'locate', value });
        }
        else if (command === COMMAND.battery) {
          this.emit('event', { command: 'battery', value });
        }
        else if (command === COMMAND.error) {
          this.emit('error', this.error());
        }
        else if (command === COMMAND.cleaningRuntime) {
          this.emit('event', { command: 'runtime', value });
        }
        else if (command === COMMAND.cleaningCoverage) {
          this.emit('event', { command: 'coverage', value });
        }
        else if (command === COMMAND.volume) {
          this.emit('event', { command: 'volume', value });
        }
        else if (command === COMMAND.consumables) {
          const consumables = this.consumables();
          this.emit('event', { command: 'consumables', value: consumables });
          if (consumables.consumable?.duration?.SB >= 250) {
            this.emit('alert', { consumable: 'side_brush', duration: consumables.consumable?.duration?.SB });
          }
          if (consumables.consumable?.duration?.RB >= 450) {
            this.emit('alert', { consumable: 'rolling_brush', duration: consumables.consumable?.duration?.RB });
          }
          if (consumables.consumable?.duration?.FM >= 200) {
            this.emit('alert', { consumable: 'filter', duration: consumables.consumable?.duration?.FM });
          }
          if (consumables.consumable?.duration?.SS >= 35) {
            this.emit('alert', { consumable: 'sensors', duration: consumables.consumable?.duration?.SS });
          }
          /* unknown!!!!!!!!
          if (consumables.consumable?.duration?.SP >= 35) {
            this.emit('alert', { consumable: 'sensors', duration: consumables.consumable?.duration?.SP });
          }
          if (consumables.consumable?.duration?.TR >= 35) {
            this.emit('alert', { consumable: 'sensors', duration: consumables.consumable?.duration?.TR });
          }
          */
          if (consumables.consumable?.duration?.BatteryStatus !== 1) {
            this.emit('alert', { consumable: 'battery', duration: consumables.consumable?.duration?.BatteryStatus });
          }
        }
        else if (command === COMMAND.multimaps) {
          this.emit('event', { command: 'multimaps', value: this.multimaps() });
        }
        else if (command === COMMAND.rooms) {
          this.emit('event', { command: 'rooms', this.rooms() });
        }
        else if (command === COMMAND.voice) {
          this.emit('event', { command: 'voice', value: this.voice() });
        }
        else if (command === COMMAND.hello) {
          this.emit('event', { command: 'hello', value: this.hello() });
        }
        else if (command === COMMAND.autoReturn) {
          this.emit('event', { command: 'autoReturn', value });
        }
        else if (command === COMMAND.status) {
          this.emit('event', { command: 'status', value: this.status() });
        }
      });
    });

    return this.connect();
  }

  async clean() {
    if (!this.dps) {
      debug('no data points available yet');
      return 'unknown';
    }
    return this.set({ [COMMAND.workMode]: 'auto' });
  }

  async cleanRooms(rooms) {
    if (!this.dps) {
      debug('no data points available yet');
      return;
    }
    const fn = {
      method: 'selectRoomsClean',
      data: {
        roomIds: rooms || [ 1 ],
        cleanTimes: 1
      },
      timestamp: Date.now()
    };
    const value = Buffer.from(JSON.stringify(fn)).toString('base64');
    return this.set({ [COMMAND.rooms]: value });
  }

  async resume() {
    if (!this.dps) {
      debug('no data points available yet');
      return 'unknown';
    }
    return this.set({ [COMMAND.playPause]: true });
  }

  async pause() {
    if (!this.dps) {
      debug('no data points available yet');
      return 'unknown';
    }
    return this.set({ [COMMAND.playPause]: false });
  }

  workMode() {
    if (!this.dps) {
      debug('no data points available yet');
      return 'unknown';
    }
    if (!this.dps.hasOwnProperty(COMMAND.workMode)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.workMode];
  }

  activity() {
    if (!this.dps) {
      debug('no data points available yet');
      return 'unknown';
    }
    if (!this.dps.hasOwnProperty(COMMAND.activity)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.activity];
  }

  batteryLevel() {
    if (!this.dps) {
      debug('no data points available yet');
      return -1;
    }
    if (!this.dps.hasOwnProperty(COMMAND.battery)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.battery];
  }

  error() {
    if (!this.dps) {
      debug('no data points available yet');
      return ERRORS[0];
    }
    if (this.dps[COMMAND.error] in ERRORS) {
      return ERRORS[this.dps[COMMAND.error]];
    }
    return this.dps[COMMAND.error];
  }

  runtime() {
    if (!this.dps) {
      debug('no data points available yet');
      return -1;
    }
    if (!this.dps.hasOwnProperty(COMMAND.cleaningRuntime)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.cleaningRuntime];
  }

  coverage() {
    if (!this.dps) {
      debug('no data points available yet');
      return -1;
    }
    if (!this.dps.hasOwnProperty(COMMAND.cleaningCoverage)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.cleaningCoverage];
  }

  consumables() {
    if (!this.dps) {
      debug('no data points available yet');
      return ''
    }
    if (!this.dps.hasOwnProperty(COMMAND.consumables)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.consumables], 'base64');
    return JSON.parse(json);
  }

  status() {
    if (!this.dps) {
      debug('no data points available yet');
      return ''
    }
    if (!this.dps.hasOwnProperty(COMMAND.status)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.status], 'base64');
    return JSON.parse(json);
  }

  docked() {
    const activity = this.activity();
    return activity === 'Sleeping' || activity === 'Charging' || activity === 'completed';
  }

  async connect() {
    await this.device.find();
    return this.device.connect();
  }

  async disconnect() {
    return this.device.disconnect();
  }

  async get(data) {
    if (!this.connected) {
      throw new Error('RoboVac is disconnected');
    }
    return this.device.get(data);
  }

  async set(data) {
    if (!this.connected) {
      throw new Error('RoboVac is disconnected');
    }
    return this.device.set({ multiple: true, data });
  }

  async refresh() {
    return this.get({ schema: true });
  }

  async locate(flag) {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!this.dps.hasOwnProperty(COMMAND.findMyRobot)) {
      throw new Error('RoboVac does not support this command');
    }
    if (this.docked()) {
      throw new Error('RoboVac is on the charging base');
    }
    const b = this.dps[COMMAND.findMyRobot];
    if (b === flag) {
      return;
    }
    return this.set({ [COMMAND.findMyRobot]: flag });
  }

  async goHome(flag) {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (this.docked()) {
      throw new Error('RoboVac is already home');
    }
    if (!this.dps.hasOwnProperty(COMMAND.goHome)) {
      throw new Error('RoboVac does not support this command');
    }
    const b = this.dps[COMMAND.goHome];
    if (b === flag) {
      return;
    }
    return this.set({ [COMMAND.goHome]: flag });
  }

  goingHome() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!this.dps.hasOwnProperty(COMMAND.goHome)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.goHome];
  }

  volume() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!this.dps.hasOwnProperty(COMMAND.volume)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.volume];
  }

  async setVolume(value) {
    if (!this.dps.hasOwnProperty(COMMAND.volume)) {
      throw new Error('RoboVac does not support this command');
    }
    if (value < 0 || volume > 100) {
      throw new Error('expecting value between 0 to 100');
    }
    return this.set({ [COMMAND.volume]: value });
  }

  multimaps() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!this.dps.hasOwnProperty(COMMAND.multimaps)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.multimaps], 'base64');
    return JSON.parse(json);
  }

  rooms() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!this.dps.hasOwnProperty(COMMAND.rooms)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.rooms], 'base64');
    return JSON.parse(json);
  }

  voice() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!this.dps.hasOwnProperty(COMMAND.voice)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.voice], 'base64');
    return JSON.parse(json);
  }

  hello() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!this.dps.hasOwnProperty(COMMAND.hello)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.hello], 'base64');
    return JSON.parse(json);
  }

  autoReturn() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!this.dps.hasOwnProperty(COMMAND.autoReturn)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.autoReturn];
  }

  async setAutoReturn(flag) {
    if (!this.dps.hasOwnProperty(COMMAND.autoReturn)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.set({ [COMMAND.autoReturn]: flag });
  }
}

module.exports = { RoboVac };

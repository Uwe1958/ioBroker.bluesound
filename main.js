'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const helper = require(`${__dirname}/lib/utils`);

let ip;
let polling;
let pollingTime;
var commands = [];

const axios = require(`axios`).default;
const { parseString } = require('xml2js');
const apiClient = axios.create();

// Load your modules here, e.g.:
// const fs = require("fs");

class Bluesound extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options] Options defined
     */
    constructor(options) {
        super({
            ...options,
            name: 'bluesound',
        });
        //        this.apiClient = null;
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        this.subscribeStates('*');

        // Reset the connection indicator during startup
        this.setState('info.connection', false, true);
        ip = this.config.IP;
        const promises = [];

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        if (ip) {
            this.log.info(`[Start] Starting adapter bluesound with: ${ip}`);
        } else {
            this.log.warn('[Start] No IP Address set');
            return;
        }
        pollingTime = Number(this.config.PollingTime) * 1000 || 30000;
        if (pollingTime < 120000) {
            this.log.info(`[Start] PollingTime [msec]: ${pollingTime}`);
        } else if (pollingTime >= 120000 && pollingTime <= 300000) {
            this.log.warn('[Start] PollingTime set very high! Status update should be scheduled more often!');
        } else {
            this.log.error(
                '[Stop] PollingTime set to an impractical large number! Reasonable numbers are up to 120 secs',
            );
            return;
        }
        const timeOUT = Number(this.config.TimeOut) * 1000 || 2000;
        if (timeOUT < pollingTime / 10) {
            this.log.info(`[Start] Timeout [msec]: ${timeOUT}`);
        } else {
            this.log.error(
                '[Stop] TimeOut set to an impractical large number! Should be set to less than PollingTime divide by ten',
            );
            return;
        }
        apiClient.defaults.baseURL = `http://${ip}:11000`;
        apiClient.defaults.timeout = timeOUT;
        apiClient.defaults.responseEncoding = 'utf8';

        // set Info

        let sNameTag = 'info.name';
        const sModelNameTag = 'info.modelname';
        try {
            const response = await apiClient.get('/SyncStatus');
            if (response.status === 200) {
                parseString(response.data, { mergeAttrs: true, explicitArray: false }, (err, result) => {
                    if (err) {
                        this.log.error(`Error parsing SyncStatus XML:${err}`);
                        return;
                    }
                    this.setState(sNameTag, result.SyncStatus.name, true);
                    this.setState(sModelNameTag, result.SyncStatus.modelName, true);
                });
            } else {
                this.log.error(`Could not retrieve SyncStatus data, Status code ${response.status}`);
            }
        } catch (e) {
            console.error(`Could not retrieve SyncStatus data: ${e}`);
        }
        // Get Initial Browse Data

        await this.initMenu();

        // Initialize Control

        // stop = false
        sNameTag = 'control.stop';
        this.setState(sNameTag, false, true);
        // pause = false
        sNameTag = 'control.pause';
        this.setState(sNameTag, false, true);
        // play = false
        sNameTag = 'control.play';
        this.setState(sNameTag, false, true);
        // state = ""
        sNameTag = 'control.state';
        this.setState(sNameTag, '', true);
        // shuffle = false
        sNameTag = 'control.shuffle';
        this.setState(sNameTag, false, true);
        sNameTag = 'control.forward';
        this.setState(sNameTag, false, true);
        sNameTag = 'control.backward';
        this.setState(sNameTag, false, true);

        // volume from player

        try {
            const response = await apiClient.get('/Volume');
            if (response.status === 200) {
                parseString(response.data, { mergeAttrs: true, explicitArray: false }, (err, result) => {
                    if (err) {
                        console.log(`Error parsing Volume XML:${err}`);
                        return;
                    }
                    sNameTag = 'control.volume';
                    this.setState(sNameTag, parseInt(result.volume._), true);

                    sNameTag = 'info.volume';
                    this.setState(sNameTag, parseInt(result.volume._), true);
                });
            } else {
                this.log.error(`Could not retrieve Volume data, Status code ${response.status}`);
            }
        } catch (e) {
            this.log.error(`Could not retrieve Volume data: ${e}`);
        }

        // Presets

        try {
            const response = await apiClient.get('/Presets');
            if (response.status == 200) {
                parseString(response.data, { mergeAttrs: true, explicitArray: false }, (err, result) => {
                    if (err) {
                        this.log.error(`Error parsing Presets XML:${err}`);
                        return;
                    }
                    for (const objPreset of result.presets.preset) {
                        const sPresetID = objPreset.id.replace(this.FORBIDDEN_CHARS, '_');
                        const sPresetName = objPreset.name;
                        const sPresetImage = objPreset.image;
                        const data1 = {
                            id: sPresetID,
                            name: sPresetName,
                            image: sPresetImage,
                            start: false,
                        };
                        const objs = helper.getPresets(sPresetID);
                        for (const obj of objs) {
                            const id = obj._id;
                            delete obj._id;
                            promises.push(this.setObjectNotExistsAsync(id, obj));
                            if (obj.type != 'channel') {
                                const sTag = `presets.preset${sPresetID}.${obj.common.name}`;
                                for (const x in data1) {
                                    if (x == obj.common.name) {
                                        if (obj.common.type == 'number') {
                                            this.setState(sTag, parseInt(data1[x]), true);
                                        } else {
                                            this.setState(sTag, data1[x], true);
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            } else {
                this.log.error(`Could not retrieve Presets data, Status code ${response.status}`);
            }
        } catch (e) {
            this.log.error(`Could not retrieve Presets data: ${e}`);
        }

        // Status
        this.readPlayerStatus();

        // Polling
        this.startPolling();

        // Set the connection indicator to true on succesful startup
        this.setState('info.connection', true, true);

        // examples for the checkPassword/checkGroup functions
        let result = await this.checkPasswordAsync('admin', 'iobroker');
        this.log.info(`check user admin pw iobroker: ${result}`);

        let resulta = await this.checkGroupAsync('admin', 'admin');
        this.log.info(`check group user admin group admin: ${resulta}`);
    }

    /**
     *
     * @param {() => void} callback
     */

    //  Is called when adapter shuts down - callback has to be called under any circumstances!

    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            clearTimeout(polling);

            // Set the connection indicator to false
            this.setState('info.connection', false, true);

            callback();
        } catch {
            callback();
        }
    }

    /**
     *
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */

    // Is called if a subscribed state changes

    async onStateChange(id, state) {
        if (state) {
            // The state was changed
            if (!state.ack) {
                const pos = id.toString().lastIndexOf('.');
                switch (id.substring(pos + 1)) {
                    case 'start':
                        try {
                            const obj = await this.getStateAsync(`${id.substring(0, pos)}.id`);
                            if (obj || obj.val) {
                                const preset = obj.val;
                                apiClient
                                    .get(`/Preset?id=${preset}`)
                                    .then(response => {
                                        // Handle response
                                        parseString(response.data, (err, result) => {
                                            if (err) {
                                                this.log.error(`Error parsing Preset XML: ${err}`);
                                                return;
                                            }
                                            const sStateTag = 'control.state';
                                            this.setState(sStateTag, result.state ?? '', true);
                                            this.setState(id, true, true); // Set acknowledged
                                            this.log.info(`${this.namespace} Preset${preset} Start`);
                                        });
                                    })
                                    .catch(err => {
                                        // Handle errors
                                        // adapter.log.error("Could not start preset, Status code " + response.status);
                                        this.log.error(`Could not start preset, Status code ${err}`);
                                    });
                            }
                        } catch (err) {
                            this.log.error(`Error reading ${id.substring(0, pos)}.id: ${err}`);
                        }
                        this.readPlayerStatus();
                        break;
                    case 'pause':
                        apiClient
                            .get('/Pause')
                            .then(response => {
                                // Handle response
                                parseString(response.data, (err, result) => {
                                    if (err) {
                                        this.log.error(`Error parsing Pause XML: ${err}`);
                                        return;
                                    }
                                    const sStateTag = 'control.state';
                                    this.setState(sStateTag, result.state, true);
                                    this.setState(id, true, true); // Set acknowledged
                                    this.log.info(`${this.namespace} Pause ${result.state}`);
                                });
                            })
                            .catch(err => {
                                // Handle errors
                                this.log.error(`Could not set Pause, Status code ${err}`);
                            });
                        this.readPlayerStatus();
                        break;
                    case 'stop':
                        apiClient
                            .get('/Stop')
                            .then(response => {
                                // Handle response
                                parseString(response.data, (err, result) => {
                                    if (err) {
                                        this.log.error(`Error parsing Stop XML: ${err}`);
                                        return;
                                    }
                                    const sStateTag = 'control.state';
                                    this.setState(sStateTag, result.state, true);
                                    this.setState(id, true, true);
                                    this.log.info(`${this.namespace} Stop`);
                                });
                            })
                            .catch(err => {
                                // Handle errors
                                this.log.error(`Could not set stop, Status code ${err}`);
                            });
                        this.clearPlayerStatus();
                        break;
                    case 'stream':
                    case 'play':
                        apiClient
                            .get('/Play')
                            .then(response => {
                                // Handle response
                                parseString(response.data, (err, result) => {
                                    if (err) {
                                        this.log.error(`Error parsing Play XML: ${err}`);
                                        return;
                                    }
                                    const sStateTag = 'control.state';
                                    this.setState(sStateTag, result.state, true);
                                    this.setState(id, true, true);
                                    this.log.info(`${this.namespace} Play`);
                                });
                            })
                            .catch(err => {
                                // Handle errors
                                this.log.error(`Could not set play, Status code ${err}`);
                            });
                        this.readPlayerStatus();
                        break;
                    case 'volume':
                        apiClient
                            .get(`/Volume?level=${state.val}`)
                            .then()
                            .catch(err => {
                                // Handle errors
                                this.log.error(`Could not set volume, Status code ${err}`);
                            });
                        this.readPlayerStatus();
                        break;
                    case 'shuffle': {
                        const sShuffleTag = 'info.shuffle';
                        try {
                            const valShuffle = await this.getStateAsync(sShuffleTag);
                            let val = valShuffle.val;
                            val = !val;
                            apiClient
                                .get(`/Shuffle?state=${Number(val)}`)
                                .then(() => {
                                    this.setState(sShuffleTag, val, true);
                                    this.setState(id, state.val, true);
                                })
                                .catch(err => {
                                    // Handle errors
                                    this.log.error(`Could not set shuffle, Status code ${err}`);
                                });
                        } catch (err) {
                            this.log.error(`Error reading ${sShuffleTag}: ${err}`);
                        }
                        this.readPlayerStatus();
                        break;
                    }
                    case 'forward':
                        apiClient
                            .get('/Skip')
                            .then(() => {
                                // Handle response
                                this.setState(id, true, true);
                            })
                            .catch(err => {
                                // Handle errors
                                this.log.error(`Could not set skip, Status code ${err}`);
                            });
                        break;
                    case 'backward':
                        apiClient
                            .get('/Back')
                            .then(() => {
                                // Handle response
                                this.setState(id, true, true);
                            })
                            .catch(err => {
                                // Handle errors
                                this.log.error(`Could not set back, Status code ${err}`);
                            });
                        break;
                    case 'command':
                        this.log.info(`key=${state.val}`);
                        var key;
                        try {
                            key = JSON.parse(`${state.val}`)['browseKey'];
                            this.log.debug(`BrowseKey New: ${key}`);
                        } catch (e) {
                            this.log.error(`Error parsing command ${e}`);
                        }
                        if (key === 'HOME' || (key === 'BACK' && commands.length < 2)) {
                            commands.length = 0;
                            this.log.info(`Stack: ${commands.length}`);
                            let a = new Promise(resolve => {
                                var ret = this.initMenu();
                                resolve(ret);
                            });
                            a.then(val => {
                                this.log.debug(`Menu initialized ${val}`);
                            });
                        } else if (key === 'BACK') {
                            //                            commands.pop();
                            commands.pop();
                            var newKey = commands[commands.length - 1];
                            let res = new Promise(resolve => {
                                var ret = this.readBrowseData(newKey);
                                resolve(ret);
                            });
                            res.then(val => {
                                this.log.debug(`List: ${val}`);
                                this.setState('info.list', val, true);
                            });
                        } else {
                            commands.push(key);
                            let res = new Promise(resolve => {
                                var ret = this.readBrowseData(key);
                                resolve(ret);
                            });
                            res.then(val => {
                                //                                this.log.debug(`List: ${val}`);
                                this.setState('info.list', val, true);
                            });
                        }
                        break;
                    default:
                    //this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                }
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    /**
     * @param {string} str - the string
     */
    stripHTML(str) {
        const strneu = str.replace('&amp;', '&');
        return strneu;
    }

    /**
     *
     * @param {number} secs - the string
     */

    convertSecs(secs) {
        const date = new Date(null);
        date.setSeconds(secs);

        let res = '';

        if (secs >= 3600) {
            res = date.toISOString().slice(11, 19);
        } else {
            res = date.toISOString().slice(14, 19);
        }

        return res;
    }

    startPolling() {
        polling = this.setTimeout(() => {
            this.readPlayerStatus();
            this.startPolling();
        }, pollingTime);
    }

    async clearPlayerStatus() {
        let i;
        for (i = 1; i < 4; i++) {
            const sStateTag = `info.title${i}`;
            await this.setState(sStateTag, { val: '', ack: true });
        }
    }

    async readPlayerStatus() {
        const promises = [];
        const title = [];
        let i;
        let varSecs;
        let strSecs;
        let varTotLen, strTotLen, varVolume, pState, varShuffle;
        let imageUrl = new String();

        for (i = 1; i < 4; i++) {
            title[i] = '';
        }
        try {
            const response = await apiClient.get('/Status');
            if (response.status === 200) {
                // Set the connection indicator to true on succesful read
                this.setState('info.connection', true, true);

                //const result = response.data;
                parseString(response.data, (err, result) => {
                    if (err) {
                        this.log.error(`Error parsing Status XML:${err}`);
                        return;
                    }

                    if (response.data.toString().lastIndexOf('title1') === -1) {
                        title[1] = '';
                    } else {
                        title[1] = result.status.title1[0];
                    }

                    if (response.data.toString().lastIndexOf('title2') === -1) {
                        title[2] = '';
                    } else {
                        title[2] = result.status.title2[0];
                    }

                    if (response.data.toString().lastIndexOf('title3') === -1) {
                        title[3] = '';
                    } else {
                        title[3] = result.status.title3[0];
                    }

                    varSecs = result.status.secs[0];
                    strSecs = this.convertSecs(varSecs);

                    if (response.data.toString().lastIndexOf('totlen') === -1) {
                        varTotLen = 28800;
                    } else {
                        varTotLen = result.status.totlen[0];
                    }

                    if (response.data.toString().lastIndexOf('image') === -1) {
                        imageUrl = '';
                    } else {
                        imageUrl = result.status.image[0];
                    }

                    varVolume = result.status.volume[0];
                    pState = result.status.state[0];

                    varShuffle = result.status.shuffle[0] == 0 ? false : true;
                });

                strTotLen = this.convertSecs(Number(varTotLen));

                if (imageUrl.substring(0, 4) != 'http') {
                    imageUrl = `http://${ip}:11000${imageUrl}`;
                }

                await Promise.all(promises);

                const sShuffleTag = 'info.shuffle';
                try {
                    const sShuffleOld = await this.getStateAsync(sShuffleTag);

                    if (varShuffle != sShuffleOld.val) {
                        await this.setState(sShuffleTag, { val: varShuffle, ack: true });
                    }
                } catch (err) {
                    this.log.error(`Error reading ${sShuffleTag}: ${err}`);
                }

                const sNameTag = 'control.state';
                try {
                    const pStateOld = await this.getStateAsync(sNameTag);

                    if (pState != pStateOld.val) {
                        let sStateTag = 'control.state';
                        await this.setState(sStateTag, { val: pState, ack: true });
                    }
                } catch (err) {
                    this.log.error(`Error reading ${sNameTag}: ${err}`);
                }

                if (pState == 'stream' || pState == 'play') {
                    for (i = 1; i < 4; i++) {
                        let sStateTag = `info.title${i}`;
                        try {
                            const valOld = await this.getStateAsync(sStateTag);
                            if (valOld.val != title[i]) {
                                await this.setState(sStateTag, { val: title[i], ack: true });
                                this.log.info(`title${i} changed: ${title[i]}`);
                            }
                        } catch (err) {
                            this.log.error(`Error reading ${sStateTag}: ${err}`);
                        }
                    }

                    let sStateTag = 'info.secs';
                    await this.setState(sStateTag, { val: parseInt(varSecs), ack: true });

                    sStateTag = 'info.totlen';
                    await this.setState(sStateTag, { val: parseInt(varTotLen), ack: true });

                    sStateTag = 'info.str_secs';
                    await this.setState(sStateTag, { val: strSecs, ack: true });

                    sStateTag = 'info.str_totlen';
                    await this.setState(sStateTag, { val: strTotLen, ack: true });

                    sStateTag = 'info.image';
                    try {
                        let valOld = await this.getStateAsync(sStateTag);

                        if (valOld.val != imageUrl) {
                            await this.setState(sStateTag, { val: imageUrl.toString(), ack: true });
                            this.log.info(`Image changed: ${imageUrl}`);
                        }
                    } catch (err) {
                        this.log.error(`Error reading ${sStateTag}: ${err}`);
                    }

                    sStateTag = 'info.volume';
                    try {
                        let valOld = await this.getStateAsync(sStateTag);
                        if (valOld.val != varVolume) {
                            await this.setState(sStateTag, { val: parseInt(varVolume), ack: true });
                            sStateTag = 'control.volume';
                            await this.setState(sStateTag, { val: parseInt(varVolume), ack: true });
                            this.log.info(`Volume changed: ${varVolume}`);
                        }
                    } catch (err) {
                        this.log.error(`Error reading ${sStateTag}: ${err}`);
                    }
                } else {
                    for (i = 1; i < 4; i++) {
                        const sStateTag = `info.title${i}`;
                        await this.setState(sStateTag, { val: '', ack: true });
                    }

                    let sStateTag = 'info.secs';
                    await this.setState(sStateTag, { val: 0, ack: true });

                    sStateTag = 'info.totlen';
                    await this.setState(sStateTag, { val: 0, ack: true });

                    sStateTag = 'info.image';
                    await this.setState(sStateTag, { val: '', ack: true });
                }
            } else {
                this.log.error(`Could not retrieve status data, Status code ${response.status}`);

                // Set the connection indicator to false on unsuccesful read
                this.setState('info.connection', false, true);
            }
        } catch (e) {
            this.log.error(`Could not retrieve status data: ${e}`);
            // Set the connection indicator to false on unsuccesful read
            this.setState('info.connection', false, true);
        }
        return true;
    }
    /**
     * @param {string} key Keyword for Browse command
     */
    async readBrowseData(key = '') {
        let res = JSON.stringify(-1);
        var browseKey;

        if (key === '' || key === 'HOME') {
            browseKey = '/ui/browseMenuGroup?service=LocalMusic';
        } else {
            browseKey = `${key}`;
        }
        this.log.debug(`Browsekey: ${browseKey}`);
        try {
            const response = await apiClient.get(browseKey);
            if (response.status === 200) {
                parseString(response.data, { mergeAttrs: true, explicitArray: false }, (err, result) => {
                    var myArr = [];
                    if (err) {
                        this.log.error(`Error parsing Browse XML: ${err}`);
                    } else {
                        this.setForeignState('0_userdata.0.browseKey', JSON.stringify(result), true);
                        const switchKey = Object.keys(result).toString();
                        this.log.debug(`Root: ${switchKey}`);
                        var entry;
                        /*                    var entry = {
                            text: '...',
                            browseKey: 'BACK',
                        };
                        myArr.push(entry);*/
                        switch (switchKey) {
                            case 'screen':
                                if (result.screen.id === 'screen-LocalMusic') {
                                    for (const objRow of result.screen.row) {
                                        entry = {
                                            text: `${objRow.action.title}`,
                                            browseKey: `${objRow.action.URI}`,
                                        };
                                        myArr.push(entry);
                                    }
                                } else if (result.screen.id === 'screen-LocalMusic-0') {
                                    entry = {
                                        text: '...',
                                        browseKey: 'BACK',
                                    };
                                    myArr.push(entry);
                                    for (const objItem of result.screen.list.item) {
                                        var regExP = new RegExp(' ', 'g');
                                        let artist = `${objItem.title}`.replace(regExP, '%2B');
                                        entry = {
                                            text: `${objItem.action.title}`,
                                            browseKey: `/ui/browseContext?service=LocalMusic&title=${artist}&type=Artist&url=%2FArtists%3Fservice%3DLocalMusic%26artist%3D${artist}`,
                                        };
                                        myArr.push(entry);
                                    }
                                    if ('nextLink' in result.screen.list) {
                                        entry = {
                                            text: 'NEXT',
                                            browseKey: `${result.screen.list.nextLink}`,
                                        };
                                        myArr.push(entry);
                                    }
                                } else if (result.screen.id === 'screen-LocalMusic-Artist') {
                                    entry = {
                                        text: '...',
                                        browseKey: 'BACK',
                                    };
                                    myArr.push(entry);
                                    if (Array.isArray(result.screen.row[0].largeThumbnail)) {
                                        for (const objItem of result.screen.row[0].largeThumbnail) {
                                            entry = {
                                                text: `${objItem.action.title}`,
                                                browseKey: `${objItem.playAction.URI}`,
                                            };
                                            myArr.push(entry);
                                        }
                                    } else {
                                        const objItem = result.screen.row[0].largeThumbnail;
                                        entry = {
                                            text: `${objItem.action.title}`,
                                            browseKey: `${objItem.playAction.URI}`,
                                        };
                                        myArr.push(entry);
                                    }
                                } else if (result.screen.id === 'screen-LocalMusic-1') {
                                    entry = {
                                        text: '...',
                                        browseKey: 'BACK',
                                    };
                                    myArr.push(entry);
                                    for (const objItem of result.screen.list.item) {
                                        entry = {
                                            text: `${objItem.subTitle} - ${objItem.title}`,
                                            browseKey: `${objItem.playAction.URI}`,
                                        };
                                        myArr.push(entry);
                                    }
                                    if ('nextLink' in result.screen.list) {
                                        entry = {
                                            text: 'NEXT',
                                            browseKey: `${result.screen.list.nextLink}`,
                                        };
                                        myArr.push(entry);
                                    }
                                } else {
                                    this.log.debug(`result: =${JSON.stringify(result)}`);
                                }
                                break;
                            case 'list':
                                this.log.info(`type: ${result.list.item[0].action.resultType}`);
                                entry = {
                                    text: '...',
                                    browseKey: 'BACK',
                                };
                                myArr.push(entry);
                                if (`${result.list.item[0].action.resultType}` === 'Artist') {
                                    for (const objItem of result.list.item) {
                                        entry = {
                                            text: `${objItem.action.title}`,
                                            browseKey: `${objItem.action.URI}`,
                                        };
                                        myArr.push(entry);
                                    }
                                } else if (`${result.list.item[0].action.resultType}` === 'Album') {
                                    for (const objItem of result.list.item) {
                                        entry = {
                                            text: `${objItem.subTitle} - ${objItem.title}`,
                                            browseKey: `${objItem.playAction.URI}`,
                                        };
                                        myArr.push(entry);
                                    }
                                }
                                if ('nextLink' in result.list) {
                                    entry = {
                                        text: 'NEXT',
                                        browseKey: `${result.list.nextLink}`,
                                    };
                                    myArr.push(entry);
                                }
                                break;
                            case 'playlist':
                                entry = {
                                    text: 'Content added, ... ',
                                    browseKey: 'BACK',
                                };
                                myArr.push(entry);
                                break;
                            default:
                                this.log.info(result);
                        }
                    }
                    res = JSON.stringify(myArr);
                });
            } else {
                this.log.error(`Could not retrieve Browse data, Status code ${response.status}`);
            }
            return res;
        } catch (e) {
            this.log.error(`Could not retrieve Browse data: ${e}`);
            return res;
        }
    }
    async initMenu() {
        var templist = await this.readBrowseData(); // Top level menu

        this.setState('info.list', templist, true);
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options] Option defined
     */
    module.exports = options => new Bluesound(options);
} else {
    // otherwise start the instance directly
    new Bluesound();
}

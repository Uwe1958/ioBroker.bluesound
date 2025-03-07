// @ts-nocheck
'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
// @ts-ignore
const helper = require(`${__dirname}/lib/utils`);

let ip;
let apiClient;
let polling;
let pollingTime;
var commands = [];
var entry;

const axios = require(`axios`);
const { parseString } = require('xml2js');

// Load your modules here, e.g.:
// const fs = require("fs");

class Bluesound extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'bluesound',
        });
        this.apiClient = null;
        this.on('ready', this.onReady.bind(this));
        // @ts-ignore
        this.on('stateChange', this.onStateChange.bind(this));
        // @ts-ignore
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
        // @ts-ignore
        const promises = [];

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        if (ip) {
            this.log.info('[Start] Starting adapter bluesound with: ' + ip);
        } else {
            this.log.warn('[Start] No IP Address set');
            return;
        }

        pollingTime = this.config.PollingTime * 1000 || 30000;
        if (pollingTime < 120000) {
            this.log.info('[Start] PollingTime [msec]: ' + pollingTime);
        } else if (pollingTime >= 120000 && pollingTime <= 300000) {
            this.log.warn('[Start] PollingTime set very high! Status update should be scheduled more often!');
        } else {
            this.log.error(
                '[Stop] PollingTime set to an impractical large number! Reasonable numbers are up to 120 secs',
            );
            return;
        }

        const timeOUT = this.config.TimeOut * 1000 || 2000;
        if (timeOUT < pollingTime / 10) {
            this.log.info('[Start] Timeout [msec]: ' + timeOUT);
        } else {
            this.log.error(
                '[Stop] TimeOut set to an impractical large number! Should be set to less than PollingTime divide by ten',
            );
            return;
        }

        apiClient = axios.create({
            baseURL: `http://${ip}:11000`,
            timeout: timeOUT,
            responseType: 'xml',
            responseEncoding: 'utf8',
        });

        // set Info

        let sNameTag = 'info.name';
        const sModelNameTag = 'info.modelname';
        try {
            const response = await apiClient.get('/SyncStatus');
            if (response.status === 200) {
                parseString(response.data, { mergeAttrs: true, explicitArray: false }, (err, result) => {
                    if (err) {
                        this.log('Error parsing SyncStatus XML:' + err);
                        return;
                    }
                    this.setState(sNameTag, result.SyncStatus.name, true);
                    this.setState(sModelNameTag, result.SyncStatus.modelName, true);
                });
            } else {
                this.log.error('Could not retrieve SyncStatus data, Status code ' + response.status);
            }
        } catch (e) {
            this.log.error('Could not retrieve SyncStatus data: ' + e);
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

        // volume from player

        try {
            const response = await apiClient.get('/Volume');
            if (response.status === 200) {
                parseString(response.data, { mergeAttrs: true, explicitArray: false }, (err, result) => {
                    if (err) {
                        this.log.error('Error parsing Volume XML:' + err);
                        return;
                    }
                    sNameTag = 'control.volume';
                    this.setState(sNameTag, parseInt(result.volume._), true);

                    sNameTag = 'info.volume';
                    this.setState(sNameTag, parseInt(result.volume._), true);
                });
            } else {
                this.log.error('Could not retrieve Volume data, Status code ' + response.status);
            }
        } catch (e) {
            this.log.error('Could not retrieve Volume data: ' + e);
        }

        // Presets

        try {
            const response = await apiClient.get('/Presets');
            if (response.status == 200) {
                parseString(response.data, { mergeAttrs: true, explicitArray: false }, (err, result) => {
                    if (err) {
                        this.log.error('Error parsing Presets XML:' + err);
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
                this.log.error('Could not retrieve Presets data, Status code ' + response.status);
            }
        } catch (e) {
            this.log.error('Could not retrieve Presets data: ' + e);
        }

        // Status

        this.readPlayerStatus();

        // Polling
        this.startPolling();

        // Set the connection indicator to true on succesful startup
        this.setState('info.connection', true, true);

        // examples for the checkPassword/checkGroup functions
        let result = await this.checkPasswordAsync('admin', 'iobroker');
        this.log.info('check user admin pw iobroker: ' + result);

        result = await this.checkGroupAsync('admin', 'admin');
        this.log.info('check group user admin group admin: ' + result);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    // @ts-ignore
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            clearTimeout(polling);

            // Set the connection indicator to false
            this.setState('info.connection', false, true);

            // clearTimeout(timeout2);
            // ...
            //            clearInterval(polling);

            // @ts-ignore
            callback();
        } catch (e) {
            // @ts-ignore
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    // @ts-ignore
    onStateChange(id, state) {
        // @ts-ignore
        if (state) {
            // The state was changed
            // @ts-ignore
            if (state.val && !state.ack) {
                const pos = id.toString().lastIndexOf('.');
                switch (id.substring(pos + 1)) {
                    case 'start':
                        this.getState(id.substring(0, pos) + '.id', (err, status) => {
                            if (status || status.val) {
                                const preset = status.val;
                                apiClient
                                    .get(`/Preset?id=${preset}`)
                                    .then((response) => {
                                        // Handle response
                                        parseString(response.data, (err, result) => {
                                            if (err) {
                                                this.log.error('Error parsing Preset XML: ' + err);
                                                return;
                                            }
                                            const sStateTag = 'control.state';
                                            this.setState(sStateTag, result.state, true);
                                            this.log.info(`${this.namespace} Preset${preset} Start`);
                                        });
                                    })
                                    .catch((err) => {
                                        // Handle errors
                                        //									adapter.log.error("Could not start preset, Status code " + response.status);
                                        this.log.error('Could not start preset, Status code ' + err);
                                    });
                            }
                        });
                        this.readPlayerStatus();
                        break;
                    case 'pause':
                        apiClient
                            .get('/Pause?toggle=1')
                            .then((response) => {
                                // Handle response
                                parseString(response.data, (err, result) => {
                                    if (err) {
                                        this.log.error('Error parsing Pause XML: ' + err);
                                        return;
                                    }
                                    const sStateTag = 'control.state';
                                    this.setState(sStateTag, result.state, true);
                                    this.log.info(`${this.namespace} Pause`);
                                });
                            })
                            .catch((err) => {
                                // Handle errors
                                this.log.error('Could not set Pause, Status code ' + err);
                            });
                        this.readPlayerStatus();
                        break;
                    case 'stop':
                        apiClient
                            .get('/Stop')
                            .then((response) => {
                                // Handle response
                                parseString(response.data, (err, result) => {
                                    if (err) {
                                        this.log.error('Error parsing Stop XML: ' + err);
                                        return;
                                    }
                                    const sStateTag = 'control.state';
                                    this.setState(sStateTag, result.state, true);
                                    this.log.info(`${this.namespace} Stop`);
                                });
                            })
                            .catch((err) => {
                                // Handle errors
                                this.log.error('Could not set stop, Status code ' + err);
                            });
                        this.clearPlayerStatus();
                        break;
                    case 'stream':
                    case 'play':
                        apiClient
                            .get('/Play')
                            .then((response) => {
                                // Handle response
                                parseString(response.data, (err, result) => {
                                    if (err) {
                                        this.log.error('Error parsing Play XML: ' + err);
                                        return;
                                    }
                                    const sStateTag = 'control.state';
                                    this.setState(sStateTag, result.state, true);
                                    this.log.info(`${this.namespace} Play`);
                                });
                            })
                            .catch((err) => {
                                // Handle errors
                                this.log.error('Could not set play, Status code ' + err);
                            });
                        this.readPlayerStatus();
                        break;
                    case 'volume':
                        apiClient
                            .get(`/Volume?level=${state.val}`)
                            .then()
                            .catch((err) => {
                                // Handle errors
                                this.log.error('Could not set volume, Status code ' + err);
                            });
                        break;
                    case 'command':
                        this.log.info(`key=${state.val}`);
                        var key;
                        try {
                            key = JSON.parse(`${state.val}`)['browseKey'];
                        } catch (e) {
                            key = state.val;
                        }
                        if (key === 'HOME' || (key === 'BACK' && commands.length < 2)) {
                            commands.length = 0;
                            this.log.info('Stack: ' + commands.length);
                            let a = new Promise((resolve) => {
                                var ret = this.initMenu();
                                resolve(ret);
                            });
                            a.then((val) => {
                                this.log.debug('Menu initialized');
                            });
                        } else if (key === 'BACK') {
                            //                            commands.pop();
                            commands.pop();
                            var newKey = commands[commands.length - 1];
                            let res = new Promise((resolve) => {
                                var ret = this.readBrowseData(newKey);
                                resolve(ret);
                            });
                            res.then((val) => {
                                this.log.debug('List: ' + val);
                                this.setState('info.list', val, true);
                            });
                        } else {
                            commands.push(key);
                            let res = new Promise((resolve) => {
                                var ret = this.readBrowseData(key);
                                resolve(ret);
                            });
                            res.then((val) => {
                                this.log.debug('List: ' + val);
                                this.setState('info.list', val, true);
                            });
                        }
                        break;
                    case 'home':
                        this.setState('control.command', 'HOME', false);
                        break;
                    default:
                    //                        this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                }
            }
        } else {
            // The state was deleted
            // @ts-ignore
            this.log.info(`state ${id} deleted`);
        }
    }

    stripHTML(str) {
        const strneu = str.replace('&amp;', '&');
        return strneu;
    }

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
        for (let i = 1; i < 4; i++) {
            const sStateTag = `info.title${i}`;
            await this.setStateAsync(sStateTag, { val: '', ack: true });
        }
        const sStateTag = `info.image`;
        await this.setStateAsync(sStateTag, { val: '', ack: true });
    }

    async readPlayerStatus() {
        const promises = [];
        const title = [];
        let i;
        let varSecs;
        let strSecs;
        let varTotLen, strTotLen, imageUrl, varVolume, pState;

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
                        this.log.error('Error parsing Status XML:' + err);
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
                });

                strTotLen = this.convertSecs(varTotLen);

                if (imageUrl.substring(0, 4) != 'http') {
                    imageUrl = `http://${ip}:11000` + imageUrl;
                }

                await Promise.all(promises);

                const sNameTag = 'control.state';
                const pStateOld = await this.getStateAsync(sNameTag);

                if (pState != pStateOld.val) {
                    const sStateTag = 'control.state';
                    await this.setStateAsync(sStateTag, { val: pState, ack: true });
                }

                if (pState == 'stream' || pState == 'play') {
                    for (i = 1; i < 4; i++) {
                        const sStateTag = `info.title${i}`;
                        const valOld = await this.getStateAsync(sStateTag);
                        if (valOld.val != title[i]) {
                            await this.setStateAsync(sStateTag, { val: title[i], ack: true });
                            this.log.info(`title${i} changed: ` + title[i]);
                        }
                    }

                    let sStateTag = 'info.secs';
                    await this.setStateAsync(sStateTag, { val: parseInt(varSecs), ack: true });

                    sStateTag = 'info.totlen';
                    await this.setStateAsync(sStateTag, { val: parseInt(varTotLen), ack: true });

                    sStateTag = 'info.str_secs';
                    await this.setStateAsync(sStateTag, { val: strSecs, ack: true });

                    sStateTag = 'info.str_totlen';
                    await this.setStateAsync(sStateTag, { val: strTotLen, ack: true });

                    sStateTag = 'info.image';
                    let valOld = await this.getStateAsync(sStateTag);

                    if (valOld.val != imageUrl) {
                        await this.setStateAsync(sStateTag, { val: imageUrl, ack: true });
                        this.log.info('Image changed: ' + imageUrl);
                    }

                    sStateTag = 'info.volume';
                    valOld = await this.getStateAsync(sStateTag);
                    if (valOld.val != varVolume) {
                        await this.setStateAsync(sStateTag, { val: parseInt(varVolume), ack: true });
                        sStateTag = 'control.volume';
                        await this.setStateAsync(sStateTag, { val: parseInt(varVolume), ack: true });
                        this.log.info('Volume changed: ' + varVolume);
                    }
                } else {
                    for (i = 1; i < 4; i++) {
                        const sStateTag = `info.title${i}`;
                        await this.setStateAsync(sStateTag, { val: '', ack: true });
                    }

                    let sStateTag = 'info.secs';
                    await this.setStateAsync(sStateTag, { val: 0, ack: true });

                    sStateTag = 'info.totlen';
                    await this.setStateAsync(sStateTag, { val: 0, ack: true });

                    sStateTag = 'info.image';
                    await this.setStateAsync(sStateTag, { val: '', ack: true });
                }
            } else {
                this.log.error('Could not retrieve status data, Status code ' + response.status);

                // Set the connection indicator to false on unsuccesful read
                this.setState('info.connection', false, true);
            }
        } catch (e) {
            this.log.error('Could not retrieve status data: ' + e);
            // Set the connection indicator to false on unsuccesful read
            this.setState('info.connection', false, true);
        }
        return true;
    }

    async readBrowseData(key) {
        let res = JSON.stringify(-1);
        var browseKey;

        if (key === '') browseKey = '/Browse';
        else if (key.substring(0, 1) === '/') {
            browseKey = key;
        } else browseKey = '/Browse?&key=' + key;
        this.log.debug('Browsekey: ' + browseKey);

        try {
            const response = await apiClient.get(browseKey);
            if (response.status === 200) {
                parseString(response.data, { mergeAttrs: true, explicitArray: false }, (err, result) => {
                    if (err) {
                        this.log('Error parsing Browse XML:' + err);
                    }
                    //                    this.setForeignState('0_userdata.0.browseKey', JSON.stringify(result), true);
                    const switchKey = Object.keys(result).toString();
                    this.log.debug('Root: ' + switchKey);
                    switch (switchKey) {
                        case 'folders':
                            var myArr = [];
                            var myPath = '';
                            if ('path' in result.folders) {
                                myPath = result.folders.path + '/';
                                if ('songs' in result.folders) {
                                    // Songs level
                                    entry = {
                                        text: '...',
                                        browseKey: 'BACK',
                                    };
                                    myArr.push(entry);
                                    for (var i = 0; i < result.folders.songs.song.length; i++) {
                                        if (i == 0) {
                                            let text = result.folders.songs.song[i].fn;
                                            text = text.substring(0, text.lastIndexOf('/'));
                                            entry = {
                                                text: 'ALL',
                                                browseKey: '/Add?playnow=1&path=' + text,
                                            };
                                            myArr.push(entry); // pointer to all songs in the album
                                        }
                                        entry = {
                                            text: result.folders.songs.song[i].title,
                                            browseKey: '/Add?playnow=1&file=' + result.folders.songs.song[i].fn,
                                        };
                                        myArr.push(entry);
                                    }
                                } else {
                                    if (Array.isArray(result.folders.subfolders.folder)) {
                                        // Folders level
                                        entry = {
                                            text: '...',
                                            browseKey: 'BACK',
                                        };
                                        myArr.push(entry);
                                        for (var i = 0; i < result.folders.subfolders.folder.length; i++) {
                                            entry = {
                                                text: result.folders.subfolders.folder[i],
                                                browseKey:
                                                    '/Folders?path=' + myPath + result.folders.subfolders.folder[i],
                                            };
                                            myArr.push(entry);
                                        }
                                    } else {
                                        // Albums level
                                        entry = {
                                            text: '...',
                                            browseKey: 'BACK',
                                        };
                                        myArr.push(entry);
                                        entry = {
                                            text: result.folders.subfolders.folder,
                                            browseKey: '/Folders?path=' + myPath + result.folders.subfolders.folder,
                                        };
                                        myArr.push(entry);
                                    }
                                }
                            } else {
                                // Path level
                                entry = {
                                    text: '...',
                                    browseKey: 'BACK',
                                };
                                myArr.push(entry);
                                for (let i in result.folders.subfolders) {
                                    entry = {
                                        text: result.folders.subfolders[i],
                                        browseKey: '/Folders?path=' + result.folders.subfolders[i],
                                    };
                                    myArr.push(entry);
                                }
                            }
                            res = JSON.stringify(myArr);
                            break;
                        case 'browse':
                            var myArr = [];
                            entry = {
                                text: '...',
                                browseKey: 'BACK',
                            };
                            var myTempArr = [];
                            switch (result.browse.type) {
                                case 'menu':
                                case 'genres':
                                    if (JSON.stringify(result.browse.item).substring(0, 1) != '[') {
                                        myTempArr.push(result.browse.item);
                                    } else myTempArr = result.browse.item;
                                    if (myTempArr[0].browseKey != 'playlists') {
                                        myArr.push(entry);
                                    }
                                    for (let i in myTempArr) {
                                        entry = {
                                            text: myTempArr[i].text,
                                            browseKey: myTempArr[i].browseKey,
                                        };
                                        myArr.push(entry);
                                    }
                                    break;
                                case 'items':
                                    myArr.push(entry);
                                    if ('category' in result.browse) {
                                        for (let i in result.browse.category) {
                                            entry = {
                                                text: result.browse.category[i].text,
                                            };
                                            myArr.push(entry);
                                            for (let j in result.browse.category[i].item) {
                                                entry = {
                                                    text: result.browse.category[i].item[j].text,
                                                    browseKey: result.browse.category[i].item[j].playURL,
                                                };
                                                myArr.push(entry);
                                            }
                                        }
                                    } else {
                                        for (let j in result.browse.item) {
                                            entry = {
                                                text: result.browse.item[j].text,
                                                browseKey: result.browse.item[j].playURL,
                                            };
                                            myArr.push(entry);
                                        }
                                    }

                                    break;
                                default:
                                    myArr.push(entry);
                                    console.log('hier');
                                    for (let i in result.browse.item) {
                                        entry = {
                                            text: result.browse.item[i].text,
                                            browseKey: result.browse.item[i].playURL + '&playnow=1',
                                        };
                                        myArr.push(entry);
                                    }
                            }
                            res = JSON.stringify(myArr);
                            break;
                        case 'playlists':
                            var myArr = [];
                            if ('name' in result.playlists) {
                                entry = {
                                    text: '...',
                                    browseKey: 'BACK',
                                };
                                myArr.push(entry);
                                for (let i in result.playlists.name) {
                                    entry = {
                                        text: `${result.playlists.name[i]._}`,
                                        browseKey:
                                            '/Add?service=' +
                                            `${result.playlists.service}` +
                                            '&playlistid=' +
                                            `${result.playlists.name[i].id}` +
                                            '&playnow=1',
                                    };
                                    myArr.push(entry);
                                }
                            } else {
                                entry = {
                                    text: 'empty ...',
                                    browseKey: 'BACK',
                                };
                                myArr.push(entry);
                            }
                            res = JSON.stringify(myArr);
                            break;
                        case 'radiotime':
                            var myArr = [];
                            if ('item' in result.radiotime) {
                                entry = {
                                    text: '...',
                                    browseKey: 'BACK',
                                };
                                myArr.push(entry);
                                for (var i = 0; i < result.radiotime.item.length; i++) {
                                    switch (result.radiotime.service) {
                                        case 'Deezer':
                                            entry = {
                                                text: result.radiotime.item[i].text,
                                                browseKey:
                                                    '/Play?service=' +
                                                    result.radiotime.service +
                                                    '&url=' +
                                                    result.radiotime.item[i].URL +
                                                    '&preset_id=' +
                                                    result.radiotime.item[i].preset_id,
                                            };
                                            break;
                                        default:
                                            entry = {
                                                text: `${result.radiotime.item[i].text}`,
                                            };
                                    }
                                    myArr.push(entry);
                                }
                            } else {
                                entry = {
                                    text: 'empty ...',
                                    browseKey: 'BACK',
                                };
                                myArr.push(entry);
                            }
                            res = JSON.stringify(myArr);
                            break;
                        case 'addsong':
                            var myArr = [];
                            entry = {
                                text: 'playing ...',
                                browseKey: 'BACK',
                            };
                            myArr.push(entry);
                            res = JSON.stringify(myArr);
                            break;
                        case 'albums':
                            var myArr = [];
                            entry = {
                                text: '...',
                                browseKey: 'BACK',
                            };
                            myArr.push(entry);
                            for (var i = 0; i < result.albums.album.length; i++) {
                                entry = {
                                    text: result.albums.album[i].title,
                                    browseKey:
                                        '/Add?service=' +
                                        result.albums.service +
                                        '&albumid=' +
                                        result.albums.album[i].albumid +
                                        '&playnow=1',
                                };
                                myArr.push(entry);
                            }
                            res = JSON.stringify(myArr);
                            break;
                        case 'artists':
                            var myArr = [];
                            if ('art' in result.artists) {
                                entry = {
                                    text: '...',
                                    browseKey: 'BACK',
                                };
                                myArr.push(entry);
                                for (var i = 0; i < result.artists.art.length; i++) {
                                    entry = {
                                        text: result.artists.art[i]._,
                                        browseKey:
                                            '/Add?service=' +
                                            result.artists.service +
                                            '&artistid=' +
                                            result.artists.art[i].artistid +
                                            '&playnow=1',
                                    };
                                    myArr.push(entry);
                                }
                            } else {
                                entry = {
                                    text: 'empty...',
                                    browseKey: 'BACK',
                                };
                                myArr.push(entry);
                            }
                            res = JSON.stringify(myArr);
                            break;
                        case 'songs':
                            var myArr = [];
                            if ('song' in result.songs) {
                                if (Array.isArray(result.songs.song)) {
                                    entry = {
                                        text: '...',
                                        browseKey: 'BACK',
                                    };
                                    myArr.push(entry);
                                    for (var i = 0; i < result.songs.song.length; i++) {
                                        entry = {
                                            text: result.songs.song[i].title,
                                            browseKey:
                                                '/Add?service=' +
                                                result.songs.service +
                                                '&file=' +
                                                result.songs.song[i].fn +
                                                '&playnow=1',
                                        };
                                        myArr.push(entry);
                                    }
                                } else {
                                    entry = {
                                        text: 'playing...',
                                        browseKey:
                                            '/Add?service=' +
                                            result.songs.service +
                                            '&file=' +
                                            result.songs.song.fn +
                                            '&playnow=1',
                                    };
                                    myArr.push(entry);
                                }
                            } else {
                                entry = {
                                    text: 'empty...',
                                    browseKey: 'BACK',
                                };
                                myArr.push(entry);
                            }
                            res = JSON.stringify(myArr);
                            break;
                        case 'state':
                        case 'loaded':
                            var myArr = [];
                            entry = {
                                text: ' playing ...',
                                browseKey: 'BACK',
                            };
                            myArr.push(entry);
                            res = JSON.stringify(myArr);
                        default:
                            this.log.warn('Unknown root: ' + Object.keys(result));
                    }
                });
            } else {
                this.log.error('Could not retrieve Browse data, Status code ' + response.status);
            }
            return res;
        } catch (e) {
            this.log.error('Could not retrieve Browse data: ' + e);
            return res;
        }
    }
    async initMenu() {
        // Top level menu
        // Pointer for LocalMusic changed to folder version
        let templist = await this.readBrowseData('/Browse');
        templist = templist.replace('LocalMusic:', '/Folders?service=LocalMusic');
        // Entry bluetooth eliminated
        let tempJSON = JSON.stringify(
            JSON.parse(templist).filter(function (item) {
                //                return item.text != 'Library' && item.text != 'Bluetooth';
                return item.text != 'Bluetooth';
            }),
        );
        this.setState('info.list', tempJSON, true);
    }
}

// @ts-ignore
if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Bluesound(options);
    // @ts-ignore
} else {
    // otherwise start the instance directly
    new Bluesound();
}

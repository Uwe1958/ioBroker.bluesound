'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
//const { setTimeout } = require('timers/promises');
const helper = require(`${__dirname}/lib/utils`);

let ip;
let polling;
let pollingTime;
var commands = [];
var headers = [];
var headerTitle;
var playlistToggle;

const axios = require(`axios`).default;
const { parseString } = require('xml2js');
const apiClient = axios.create();
const strPlus = '%2B';
const regPlus = new RegExp(strPlus, 'g');
const regPlusPlus = new RegExp('\\+', 'g');
const regDblQuote = new RegExp('%25', 'g');
const regAmp = new RegExp('&', 'g');
const regComma = new RegExp(',', 'g');
const regSemiColon = new RegExp(';', 'g');
const regDblPt = new RegExp(':', 'g');

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
        await this.readPlayerStatus();

        // Playlist
        await this.readPlaylist();
        playlistToggle = 1;
        this.setState('info.playliststate', playlistToggle == 1 ? true : false, true);

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
                        await this.readPlayerStatus();
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
                        await this.readPlayerStatus();
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
                        await this.clearPlayerStatus();
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
                        await this.readPlayerStatus();
                        break;
                    case 'volume':
                        apiClient
                            .get(`/Volume?level=${state.val}`)
                            .then()
                            .catch(err => {
                                // Handle errors
                                this.log.error(`Could not set volume, Status code ${err}`);
                            });
                        await this.readPlayerStatus();
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
                        await this.readPlayerStatus();
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
                        await this.readPlayerStatus();
                        break;
                    case 'playlist':
                        this.setPlaylistToggle();
                        this.log.info(`PlaylistToggle: ${playlistToggle}`);
                        this.setState(id, true, true);
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
                        await this.readPlayerStatus();
                        break;
                    case 'command':
                        //                        this.log.info(`key=${state.val}`);
                        var key;
                        try {
                            key = JSON.parse(`${state.val}`)['browseKey'];
                            headerTitle = JSON.parse(`${state.val}`)['headerTitle'];
                            this.setState('info.listheader', headerTitle, true);
                        } catch (e) {
                            this.log.error(`Error parsing command ${e}`);
                        }
                        if (key === 'HOME' || (key === 'BACK' && commands.length < 2)) {
                            commands.length = 0;
                            headers.length = 0;
                            let a = new Promise(resolve => {
                                var ret = this.initMenu();
                                this.log.info(`Menu initialized`);
                                resolve(ret);
                            });
                            a.then(() => {});
                        } else if (key === 'BACK') {
                            //                            commands.pop();
                            commands.pop();
                            headers.pop();
                            var newKey = commands[commands.length - 1];
                            //                            headerTitle = headers[headers.length - 1];
                            let res = new Promise(resolve => {
                                var ret = this.readBrowseData(newKey);
                                resolve(ret);
                            });
                            res.then(val => {
                                this.setState('info.list', val, true);
                            });
                        } else {
                            commands.push(key);
                            headers.push(headerTitle);
                            /*                            commands.forEach(el => {
                                this.log.info(`Commands: ${el}`);
                            });
                            headers.forEach(el => {
                                this.log.info(`Headers: ${el}`);
                            });*/
                            let res = new Promise(resolve => {
                                var ret = this.readBrowseData(key);
                                resolve(ret);
                            });
                            res.then(val => {
                                this.setState('info.list', val, true);
                            });
                        }
                        this.setState(id, state.val, true);
                        break;
                    case 'search': {
                        key = `/ui/Search?forService=LocalMusic&q=${state.val}`;
                        const res = new Promise(resolve => {
                            var ret = this.readBrowseData(key);
                            resolve(ret);
                        });
                        res.then(val => {
                            this.setState('info.list', val, true);
                        });
                        this.setState(id, state.val, true);
                        break;
                    }
                    default:
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
                                if (i == 1) {
                                    await this.readPlaylist();
                                }
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
                    await this.readPlaylist();
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
    async readPlaylist() {
        var curTitle;
        var curObjTitle = await this.getStateAsync('info.title1');
        if (curObjTitle || curObjTitle.val) {
            curTitle = curObjTitle.val;
        }
        try {
            const response = await apiClient.get('/Playlist');
            if (response.status === 200) {
                parseString(response.data, { mergeAttrs: true, explicitArray: false }, (err, result) => {
                    var myArr = [];
                    var entry;
                    if (err) {
                        this.log.error(`Error parsing Playlist XML: ${err}`);
                    } else {
                        var myHtml = `<body><div><table id="playlist">`;
                        if (Array.isArray(result.playlist.song)) {
                            for (const objSong of result.playlist.song) {
                                //                                this.log.info(`Playlist: ${objSong.title}, CurTitle: ${curTitle}`);
                                entry = {
                                    id: `${objSong.title == curTitle ? -1 : parseInt(objSong.id)}`,
                                    title: `${objSong.title}`,
                                    artist: `${objSong.art}`,
                                    image: `${objSong.image}`,
                                };
                                myArr.push(entry);
                                myHtml += `<tr><td rowspan="2"><img src="http://${ip}:11000${objSong.image}"</td>`;
                                if (parseInt(entry.id) == -1) {
                                    myHtml += `<td class="current">${objSong.title}</td>`;
                                } else {
                                    myHtml += `<td class="title">${objSong.title}</td>`;
                                }
                                myHtml += `</tr>
                                  <tr><td class="artist">${objSong.art}</td></tr>`;
                            }
                            myHtml += '</table></div></body>';
                        } else {
                            const objSong = result.playlist.song;
                            entry = {
                                id: `${objSong.title == curTitle ? -1 : parseInt(objSong.id)}`,
                                title: `${objSong.title}`,
                                artist: `${objSong.art}`,
                                image: `${objSong.image}`,
                            };
                            myArr.push(entry);
                            myHtml += `<tr><td rowspan="2"><img src="http://${ip}:11000${objSong.image}"</td>`;
                            if (parseInt(entry.id) == -1) {
                                myHtml += `<td class="current">${objSong.title}</td>`;
                            } else {
                                myHtml += `<td class="title">${objSong.title}</td>`;
                            }
                            myHtml += `</tr>
                                  <tr><td class="artist">${objSong.art}</td></tr>`;
                            myHtml += '</table></div></body>';
                        }
                    }
                    this.setState('info.playlist', JSON.stringify(myArr), true);
                    this.setState('info.playlisthtml', myHtml, true);
                });
            } else {
                this.log.error(`Could not retrieve playlist data, Status code ${response.status}`);
            }
        } catch (e) {
            this.log.error(`Could not retrieve status data: ${e}`);
            // Set the connection indicator to false on unsuccesful read
            this.setState('info.connection', false, true);
        }
        return true;
    }
    async setPlaylistToggle() {
        playlistToggle = playlistToggle == 1 ? 0 : 1;
        this.setState('info.playliststate', playlistToggle == 1 ? true : false, true);
        return;
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
        this.log.info(`Browsekey: ${browseKey}`);
        try {
            const response = await apiClient.get(browseKey);
            if (response.status === 200) {
                parseString(response.data, { mergeAttrs: true, explicitArray: false }, (err, result) => {
                    var myArr = [];
                    if (err) {
                        this.log.error(`Error parsing Browse XML: ${err}`);
                    } else {
                        //                        this.setForeignState('0_userdata.0.browseKey', JSON.stringify(result), true);
                        const switchKey = Object.keys(result).toString();
                        this.log.info(`Root: ${switchKey}`);
                        var entry;
                        switch (switchKey) {
                            case 'screen':
                                this.log.info(`Id: ${result.screen.id}`);
                                switch (result.screen.id) {
                                    case 'screen-LocalMusic':
                                        for (const objRow of result.screen.row) {
                                            entry = {
                                                text: `${objRow.action.title}`,
                                                browseKey:
                                                    playlistToggle == 1
                                                        ? `${objRow.action.URI}`
                                                        : `${objRow.action.URI}`.replace('playnow=1', 'playnow=0'),
                                                headerTitle: `${objRow.action.title}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-LocalMusic-0':
                                        // Artists alphabetical list
                                        entry = {
                                            text: '...',
                                            browseKey: 'BACK',
                                            headerTitle: 'Main Menu',
                                        };
                                        myArr.push(entry);
                                        for (const objItem of result.screen.list.index.item) {
                                            entry = {
                                                text: `${objItem.key}   ->`,
                                                browseKey: `${commands[commands.length - 1]}&offset=${objItem.offset}`,
                                                headerTitle: `Artists -> ${objItem.key}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-LocalMusic-Artist':
                                        if ('row' in result.screen) {
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 2]}`,
                                            };
                                            myArr.push(entry);
                                            if (Array.isArray(result.screen.row[0].largeThumbnail)) {
                                                for (const objItem of result.screen.row[0].largeThumbnail) {
                                                    entry = {
                                                        text: `${objItem.action.title}`,
                                                        browseKey:
                                                            playlistToggle == 1
                                                                ? `${objItem.playAction.URI}`
                                                                : `${objItem.playAction.URI}`.replace(
                                                                      'playnow=1',
                                                                      'playnow=0',
                                                                  ),
                                                        headerTitle: `${result.screen.header.title} -> ${objItem.action.title}`,
                                                    };
                                                    myArr.push(entry);
                                                }
                                            } else {
                                                const objItem = result.screen.row[0].largeThumbnail;
                                                entry = {
                                                    text: `${objItem.action.title}`,
                                                    browseKey:
                                                        playlistToggle == 1
                                                            ? `${objItem.playAction.URI}`
                                                            : `${objItem.playAction.URI}`.replace(
                                                                  'playnow=1',
                                                                  'playnow=0',
                                                              ),
                                                    headerTitle: `Artists -> ${result.screen.header.title}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else {
                                            entry = {
                                                text: 'Empty result, ...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 2]}`,
                                            };
                                            myArr.push(entry);
                                        }

                                        break;
                                    case 'screen-LocalMusic-Favourites':
                                        if ('list' in result.screen) {
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 2]}`,
                                            };
                                            myArr.push(entry);
                                            /*                                        if (Array.isArray(result.screen.list.item)) {
                                            for (const objItem of result.screen.list.item) {
                                                entry = {
                                                    text: `${objItem.subTitle} - ${objItem.title}`,
                                                    browseKey: `${objItem.playAction.URI}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else {
                                            const objItem = result.screen.list.item;
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
                                        }*/
                                        } else {
                                            entry = {
                                                text: 'Empty result, ...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 1]}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-LocalMusic-1':
                                        // Albums alphabetical list
                                        entry = {
                                            text: '...',
                                            browseKey: 'BACK',
                                            headerTitle: 'Main Menu',
                                        };
                                        myArr.push(entry);
                                        for (const objItem of result.screen.list.index.item) {
                                            entry = {
                                                text: `${objItem.key}   ->`,
                                                browseKey: `${commands[commands.length - 1]}&offset=${objItem.offset}`,
                                                headerTitle: `Albums -> ${objItem.key}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-LocalMusic-2':
                                        entry = {
                                            text: '...',
                                            browseKey: 'BACK',
                                            headerTitle: 'Main Menu',
                                        };
                                        myArr.push(entry);
                                        for (const objItem of result.screen.list.index.item) {
                                            entry = {
                                                text: `${objItem.key}   ->`,
                                                browseKey: `${commands[commands.length - 1]}&offset=${objItem.offset}`,
                                                headerTitle: `Songs -> ${objItem.key}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-LocalMusic-4':
                                        // Playlists
                                        entry = {
                                            text: '...',
                                            browseKey: 'BACK',
                                            headerTitle: `${headers[headers.length - 1]}`,
                                        };
                                        myArr.push(entry);
                                        for (const objItem of result.screen.list.item) {
                                            var regExp = new RegExp('(?<=id=).+', 'gm');
                                            var playlistID = `${objItem.playAction.URI}`.match(regExp)[0];
                                            entry = {
                                                text: `${objItem.action.title}`,
                                                browseKey: `/Add?playlistid=${playlistID}&playnow=${playlistToggle.toString()}&service=LocalMusic&shuffle=1`,
                                                headerTitle: `${objItem.action.title}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-LocalMusic-5':
                                        entry = {
                                            text: '...',
                                            browseKey: 'BACK',
                                            headerTitle: `${headers[headers.length - 1]}`,
                                        };
                                        myArr.push(entry);
                                        for (const objItem of result.screen.list.index.item) {
                                            entry = {
                                                text: `${objItem.key}   ->`,
                                                browseKey: `${commands[commands.length - 1]}&offset=${objItem.offset}`,
                                                headerTitle: `Composers -> ${objItem.key}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-LocalMusic-Genres':
                                        // Genres list
                                        entry = {
                                            text: '...',
                                            browseKey: 'BACK',
                                            headerTitle: `${headers[headers.length - 1]}`,
                                        };
                                        myArr.push(entry);
                                        for (const objItem of result.screen.list.item) {
                                            entry = {
                                                text: `${objItem.title}`,
                                                browseKey: `/ui/browseGrouped?browseIndex=2&menuGroupId=Genres&service=LocalMusic&title=Albums&type=Album&url=%2Flibrary%2Fv1%2FAlbums%3Fgenre%3D${objItem.title}%26service%3DLocalMusic`,
                                                headerTitle: `Genre -> ${objItem.title}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-Genres-2':
                                        // Genre
                                        if ('list' in result.screen) {
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 2]}`,
                                            };
                                            myArr.push(entry);
                                            if (Array.isArray(result.screen.list.item)) {
                                                for (const objItem of result.screen.list.item) {
                                                    entry = {
                                                        text: `${objItem.subTitle} - ${objItem.title}`,
                                                        browseKey:
                                                            playlistToggle == 1
                                                                ? `${objItem.playAction.URI}`
                                                                : `${objItem.playAction.URI}`.replace(
                                                                      'playnow=1',
                                                                      'playnow=0',
                                                                  ),
                                                        headerTitle: `${objItem.subTitle} - ${objItem.title}`,
                                                    };
                                                    myArr.push(entry);
                                                }
                                            } else {
                                                const objItem = result.screen.list.item;
                                                entry = {
                                                    text: `${objItem.subTitle} - ${objItem.title}`,
                                                    browseKey:
                                                        playlistToggle == 1
                                                            ? `${objItem.playAction.URI}`
                                                            : `${objItem.playAction.URI}`.replace(
                                                                  'playnow=1',
                                                                  'playnow=0',
                                                              ),
                                                    headerTitle: `${objItem.subTitle} - ${objItem.title}`,
                                                };
                                                myArr.push(entry);
                                            }
                                            if ('nextLink' in result.screen.list) {
                                                entry = {
                                                    text: 'NEXT',
                                                    browseKey: `${result.screen.list.nextLink}`,
                                                    headerTitle: `${headers[headers.length - 1]}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else {
                                            entry = {
                                                text: 'Empty result, ...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 2]}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-LocalMusic-8':
                                        // Genre
                                        if ('list' in result.screen) {
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: 'Main Menu',
                                            };
                                            myArr.push(entry);
                                            if (Array.isArray(result.screen.list.item)) {
                                                for (const objItem of result.screen.list.item) {
                                                    entry = {
                                                        text: `${objItem.subTitle} - ${objItem.title}`,
                                                        browseKey:
                                                            playlistToggle == 1
                                                                ? `${objItem.playAction.URI}`
                                                                : `${objItem.playAction.URI}`.replace(
                                                                      'playnow=1',
                                                                      'playnow=0',
                                                                  ),
                                                        headerTitle: `${objItem.subTitle} - ${objItem.title}`,
                                                    };
                                                    myArr.push(entry);
                                                }
                                            } else {
                                                const objItem = result.screen.list.item;
                                                entry = {
                                                    text: `${objItem.subTitle} - ${objItem.title}`,
                                                    browseKey:
                                                        playlistToggle == 1
                                                            ? `${objItem.playAction.URI}`
                                                            : `${objItem.playAction.URI}`.replace(
                                                                  'playnow=1',
                                                                  'playnow=0',
                                                              ),
                                                    headerTitle: `${objItem.subTitle} - ${objItem.title}`,
                                                };
                                                myArr.push(entry);
                                            }
                                            if ('nextLink' in result.screen.list) {
                                                entry = {
                                                    text: 'NEXT',
                                                    browseKey: `${result.screen.list.nextLink}`,
                                                    headerTitle: `${headers[headers.length - 1]}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else {
                                            entry = {
                                                text: 'Empty result, ...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 2]}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-LocalMusic-Genres-genre':
                                        entry = {
                                            text: '...',
                                            browseKey: 'BACK',
                                            headerTitle: `${headers[headers.length - 2]}`,
                                        };
                                        myArr.push(entry);
                                        if (Array.isArray(result.screen.row[2].largeThumbnail)) {
                                            for (const objItem of result.screen.row[2].largeThumbnail) {
                                                entry = {
                                                    text: `${objItem.subTitle} - ${objItem.title}`,
                                                    browseKey:
                                                        playlistToggle == 1
                                                            ? `${objItem.playAction.URI}`
                                                            : `${objItem.playAction.URI}`.replace(
                                                                  'playnow=1',
                                                                  'playnow=0',
                                                              ),
                                                    headerTitle: `${headers[headers.length - 1]}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else {
                                            const objItem = result.screen.row[2].largeThumbnail;
                                            entry = {
                                                text: `${objItem.subTitle} - ${objItem.title}`,
                                                browseKey:
                                                    playlistToggle == 1
                                                        ? `${objItem.playAction.URI}`
                                                        : `${objItem.playAction.URI}`.replace('playnow=1', 'playnow=0'),
                                                headerTitle: `${headers[headers.length - 1]}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-LocalMusic-Composer':
                                        // Composer result
                                        entry = {
                                            text: '...',
                                            browseKey: 'BACK',
                                            headerTitle: `${headers[headers.length - 2]}`,
                                        };
                                        myArr.push(entry);
                                        if (Array.isArray(result.screen.row[0].largeThumbnail)) {
                                            for (const objItem of result.screen.row[0].largeThumbnail) {
                                                entry = {
                                                    text: `${objItem.subTitle} - ${objItem.title}`,
                                                    browseKey:
                                                        playlistToggle == 1
                                                            ? `${objItem.playAction.URI}`
                                                            : `${objItem.playAction.URI}`.replace(
                                                                  'playnow=1',
                                                                  'playnow=0',
                                                              ),
                                                    headerTitle: `${objItem.subTitle} - ${objItem.title}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else {
                                            const objItem = result.screen.row[0].largeThumbnail;
                                            entry = {
                                                text: `${objItem.subTitle} - ${objItem.title}`,
                                                browseKey:
                                                    playlistToggle == 1
                                                        ? `${objItem.playAction.URI}`
                                                        : `${objItem.playAction.URI}`.replace('playnow=1', 'playnow=0'),
                                                headerTitle: `${objItem.subTitle} - ${objItem.title}`,
                                            };
                                            myArr.push(entry);
                                        }
                                        break;
                                    case 'screen-Folders':
                                        if (result.screen.screenTitle === 'Folders') {
                                            // Folders
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: 'Main Menu',
                                            };
                                            myArr.push(entry);
                                            if (Array.isArray(result.screen.list)) {
                                                for (const objItem of result.screen.list) {
                                                    entry = {
                                                        text: `${objItem.item.title}`,
                                                        browseKey:
                                                            playlistToggle == 1
                                                                ? `${objItem.item.action.URI}`
                                                                : `${objItem.item.action.URI}`.replace(
                                                                      'playnow=1',
                                                                      'playnow=0',
                                                                  ),
                                                        headerTitle: `${objItem.item.title}`,
                                                    };
                                                    myArr.push(entry);
                                                }
                                            } else {
                                                const objItem = result.screen.list;
                                                entry = {
                                                    text: `${objItem.item.title}`,
                                                    browseKey:
                                                        playlistToggle == 1
                                                            ? `${objItem.item.action.URI}`
                                                            : `${objItem.item.action.URI}`.replace(
                                                                  'playnow=1',
                                                                  'playnow=0',
                                                              ),
                                                    headerTitle: `${objItem.item.title}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else if (result.screen.screenTitle.substring(0, 1) === '/') {
                                            // Folders list
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 2]}`,
                                            };
                                            myArr.push(entry);
                                            if (Array.isArray(result.screen.list.item)) {
                                                for (const objItem of result.screen.list.item) {
                                                    entry = {
                                                        text: `${objItem.title}`,
                                                        browseKey:
                                                            playlistToggle == 1
                                                                ? `${objItem.action.URI}`
                                                                : `${objItem.action.URI}`.replace(
                                                                      'playnow=1',
                                                                      'playnow=0',
                                                                  ),
                                                        headerTitle: `Folders -> ${objItem.title}`,
                                                    };
                                                    myArr.push(entry);
                                                }
                                            } else {
                                                const objItem = result.screen.list.item;
                                                entry = {
                                                    text: `${objItem.title}`,
                                                    browseKey:
                                                        playlistToggle == 1
                                                            ? `${objItem.action.URI}`
                                                            : `${objItem.action.URI}`.replace('playnow=1', 'playnow=0'),
                                                    headerTitle: `Folders -> ${objItem.title}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else {
                                            // Folders list
                                            var regPath = new RegExp('(?<=path%3D).+');
                                            var regFile = new RegExp('(?<=file=).+');
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 2]}`,
                                            };
                                            myArr.push(entry);
                                            if (Array.isArray(result.screen.list.item)) {
                                                for (const objItem of result.screen.list.item) {
                                                    if (objItem.action.URI.lastIndexOf('path%3D') != -1) {
                                                        var myPath = objItem.action.URI.match(regPath)[0]
                                                            .replace(regDblQuote, '%')
                                                            .replace(regPlus, '+');
                                                        entry = {
                                                            text: `${objItem.title}`,
                                                            browseKey: `/Add?playnow=${playlistToggle.toString()}&context=Folder&path=${myPath}`,
                                                            headerTitle: `${headers[headers.length - 1]}/${objItem.title}`,
                                                        };
                                                        myArr.push(entry);
                                                    } else {
                                                        myPath = objItem.action.URI.match(regFile)[0]
                                                            .replace(regDblQuote, '%')
                                                            .replace(regPlus, '+');
                                                        entry = {
                                                            text: `${objItem.title}`,
                                                            browseKey: `/Add?playnow=${playlistToggle.toString()}&file=${myPath}`,
                                                            headerTitle: `${headers[headers.length - 1]}`,
                                                        };
                                                        myArr.push(entry);
                                                    }
                                                }
                                            } else {
                                                const objItem = result.screen.list.item;
                                                if (objItem.action.URI.lastIndexOf('path%3D') != -1) {
                                                    myPath = objItem.action.URI.match(regPath)[0]
                                                        .replace(regDblQuote, '%')
                                                        .replace(regPlus, '+');
                                                    entry = {
                                                        text: `${objItem.title}`,
                                                        browseKey: `/Add?playnow=${playlistToggle.toString()}&context=Folder&path=${myPath}`,
                                                        headerTitle: `${headers[headers.length - 1]}`,
                                                    };
                                                    myArr.push(entry);
                                                } else {
                                                    myPath = objItem.action.URI.match(regFile)[0]
                                                        .replace(regDblQuote, '%')
                                                        .replace(regPlus, '+');
                                                    entry = {
                                                        text: `${objItem.title}`,
                                                        browseKey: `/Add?playnow=${playlistToggle.toString()}&file=${myPath}`,
                                                        headerTitle: `${headers[headers.length - 1]}`,
                                                    };
                                                    myArr.push(entry);
                                                }
                                            }
                                        }
                                        break;
                                    case 'screen-LocalMusic-Search':
                                        if ('list' in result.screen) {
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                //                                            headerTitle: `Search(${result.screen.search.value})`,
                                                headerTitle: 'Main Menu',
                                            };
                                            myArr.push(entry);
                                            this.setState(
                                                'info.listheader',
                                                `Main Menu Search (${result.screen.search.value})`,
                                                true,
                                            );
                                            if (Array.isArray(result.screen.list)) {
                                                for (const objItem of result.screen.list) {
                                                    var typeSingle = objItem.title.substring(
                                                        0,
                                                        objItem.title.length - 1,
                                                    );
                                                    entry = {
                                                        text: `${objItem.title}`,
                                                        browseKey: `/ui/BrowseObjects?browseIndex=0&menuGroupId=LocalMusic-search&service=LocalMusic&title=${objItem.title}&type=${typeSingle}&url=%2Flibrary%2Fv1%2F${objItem.title}%3Fexpr%3D${result.screen.search.value}%26service%3DLocalMusic`,
                                                        headerTitle: `${objItem.title} Search (${result.screen.search.value})`,
                                                    };
                                                    myArr.push(entry);
                                                }
                                            } else {
                                                const objItem = result.screen.list;
                                                typeSingle = objItem.title.substring(0, objItem.title.length - 1);
                                                entry = {
                                                    text: `${objItem.title}`,
                                                    browseKey: `/ui/BrowseObjects?browseIndex=0&menuGroupId=LocalMusic-search&service=LocalMusic&title=${objItem.title}&type=${typeSingle}&url=%2Flibrary%2Fv1%2F${objItem.title}%3Fexpr%3D${result.screen.search.value}%26service%3DLocalMusic`,
                                                    headerTitle: `${objItem.title} Search(${result.screen.search.value})`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else {
                                            entry = {
                                                text: 'Empty Result, ...',
                                                browseKey: 'BACK',
                                                headerTitle: 'Main Menu',
                                            };
                                            myArr.push(entry);
                                            this.setState(
                                                'info.listheader',
                                                `Main Menu Search (${result.screen.search.value})`,
                                                true,
                                            );
                                        }
                                        break;
                                    case 'screen-LocalMusic-search-0':
                                        if (result.screen.screenTitle == 'Artists') {
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 1]}`,
                                            };
                                            myArr.push(entry);
                                            if (Array.isArray(result.screen.list.item)) {
                                                for (const objItem of result.screen.list.item) {
                                                    regExP = new RegExp(' ', 'g');
                                                    let myTitle = `${objItem.title}`
                                                        .replace(regPlusPlus, '%2B')
                                                        .replace(regExP, '+')
                                                        .replace(regComma, '%2C')
                                                        .replace(regSemiColon, '%3B')
                                                        .replace(regDblPt, '%3A')
                                                        .replace(regAmp, '%26');
                                                    let artist = encodeURIComponent(myTitle);
                                                    entry = {
                                                        text: `${objItem.action.title}`,
                                                        browseKey: `/ui/browseContext?service=LocalMusic&title=${myTitle}&type=Artist&url=%2FArtists%3Fservice%3DLocalMusic%26artist%3D${artist}`,
                                                        headerTitle: `Artist -> ${objItem.action.title}`,
                                                    };
                                                    myArr.push(entry);
                                                }
                                            } else {
                                                const objItem = result.screen.list.item;
                                                regExP = new RegExp(' ', 'g');
                                                let myTitle = `${objItem.title}`
                                                    .replace(regPlusPlus, '%2B')
                                                    .replace(regExP, '+')
                                                    .replace(regComma, '%2C')
                                                    .replace(regSemiColon, '%3B')
                                                    .replace(regDblPt, '%3A')
                                                    .replace(regAmp, '%26');
                                                let artist = encodeURIComponent(myTitle);
                                                entry = {
                                                    text: `${objItem.action.title}`,
                                                    browseKey: `/ui/browseContext?service=LocalMusic&title=${myTitle}&type=Artist&url=%2FArtists%3Fservice%3DLocalMusic%26artist%3D${artist}`,
                                                    headerTitle: `Artist -> ${objItem.action.title}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else if (result.screen.screenTitle == 'Albums') {
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 1]}`,
                                            };
                                            myArr.push(entry);
                                            if (Array.isArray(result.screen.list.item)) {
                                                for (const objItem of result.screen.list.item) {
                                                    entry = {
                                                        text: `${objItem.action.title}`,
                                                        browseKey:
                                                            playlistToggle == 1
                                                                ? `${objItem.playAction.URI}`
                                                                : `${objItem.playAction.URI}`.replace(
                                                                      'playnow=1',
                                                                      'playnow=0',
                                                                  ),
                                                        headerTitle: `Album -> ${objItem.action.title}`,
                                                    };
                                                    myArr.push(entry);
                                                }
                                            } else {
                                                const objItem = result.screen.list.item;
                                                entry = {
                                                    text: `${objItem.action.title}`,
                                                    browseKey:
                                                        playlistToggle == 1
                                                            ? `${objItem.playAction.URI}`
                                                            : `${objItem.playAction.URI}`.replace(
                                                                  'playnow=1',
                                                                  'playnow=0',
                                                              ),
                                                    headerTitle: `Album -> ${objItem.action.title}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else if (result.screen.screenTitle == 'Songs') {
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 1]}`,
                                            };
                                            myArr.push(entry);
                                            if (Array.isArray(result.screen.list.item)) {
                                                for (const objItem of result.screen.list.item) {
                                                    entry = {
                                                        text: `${objItem.title}`,
                                                        browseKey:
                                                            playlistToggle == 1
                                                                ? `${objItem.action.URI}`
                                                                : `${objItem.action.URI}`.replace(
                                                                      'playnow=1',
                                                                      'playnow=0',
                                                                  ),
                                                        headerTitle: `Album -> ${objItem.action.title}`,
                                                    };
                                                    myArr.push(entry);
                                                }
                                            } else {
                                                const objItem = result.screen.list.item;
                                                entry = {
                                                    text: `${objItem.title}`,
                                                    browseKey:
                                                        playlistToggle == 1
                                                            ? `${objItem.action.URI}`
                                                            : `${objItem.action.URI}`.replace('playnow=1', 'playnow=0'),
                                                    headerTitle: `Album -> ${objItem.action.title}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        } else if (result.screen.screenTitle == 'Composers') {
                                            entry = {
                                                text: '...',
                                                browseKey: 'BACK',
                                                headerTitle: `${headers[headers.length - 1]}`,
                                            };
                                            myArr.push(entry);
                                            for (const objItem of result.screen.list.item) {
                                                regExP = new RegExp(' ', 'g');
                                                let artist = `${objItem.title}`.replace(regExP, strPlus);
                                                entry = {
                                                    text: `${objItem.action.title}`,
                                                    browseKey: `/ui/browseContext?service=LocalMusic&title=${artist}&type=Composer&url=%2FComposers%3Fservice%3DLocalMusic%26composer%3D${artist}`,
                                                    headerTitle: `Composer -> ${objItem.action.title}`,
                                                };
                                                myArr.push(entry);
                                            }
                                        }
                                        break;
                                    default:
                                        this.log.debug(`resultNO: =${JSON.stringify(result)}`);
                                }
                                break;
                            case 'list':
                                entry = {
                                    text: '...',
                                    browseKey: 'BACK',
                                    headerTitle: `${headers[headers.length - 2]}`,
                                };
                                myArr.push(entry);
                                if (!('resultType' in result.list.item[0].action)) {
                                    var regExP = new RegExp('(?<=offset=)\\d*');
                                    var curOffset = parseInt(result.list.offset);
                                    var newOffset = curOffset + 30;
                                    var maxOffset;
                                    let newCmd = commands[commands.length - 1].replace(regExP, `${newOffset}`);
                                    var lstCommand = headers[headers.length - 1];
                                    var searchKey = lstCommand.substring(lstCommand.length - 1);
                                    for (const objKey of result.list.index.item) {
                                        if (objKey.key == searchKey) {
                                            maxOffset = parseInt(objKey.offset) + parseInt(objKey.length);
                                            break;
                                        }
                                    }
                                    for (const objItem of result.list.item) {
                                        entry = {
                                            text: `${objItem.title}`,
                                            browseKey:
                                                playlistToggle == 1
                                                    ? `${objItem.action.URI}`
                                                    : `${objItem.action.URI}`.replace('playnow=1', 'playnow=0'),
                                            headerTitle: `${objItem.title}`,
                                        };
                                        myArr.push(entry);
                                        curOffset++;
                                        if (curOffset > maxOffset - 1) {
                                            break;
                                        }
                                    }
                                    if (curOffset < maxOffset) {
                                        entry = {
                                            text: 'NEXT',
                                            browseKey: `${newCmd}`,
                                            headerTitle: `${headers[headers.length - 1]}`,
                                        };
                                        myArr.push(entry);
                                    }
                                } else {
                                    switch (result.list.item[0].action.resultType) {
                                        case 'Artist':
                                            lstCommand = headers[headers.length - 1];
                                            searchKey = lstCommand.substring(lstCommand.length - 1);
                                            curOffset = parseInt(result.list.offset);
                                            for (const objKey of result.list.index.item) {
                                                if (objKey.key == searchKey) {
                                                    maxOffset = parseInt(objKey.offset) + parseInt(objKey.length);
                                                    break;
                                                }
                                            }
                                            for (const objItem of result.list.item) {
                                                regExP = new RegExp(' ', 'g');
                                                let artist = `${objItem.title}`.replace(regExP, strPlus);
                                                entry = {
                                                    text: `${objItem.action.title}`,
                                                    browseKey: `/ui/browseContext?service=LocalMusic&title=${artist}&type=Artist&url=%2FArtists%3Fservice%3DLocalMusic%26artist%3D${artist}`,
                                                    headerTitle: `Artist -> ${objItem.action.title}`,
                                                };
                                                myArr.push(entry);
                                                curOffset++;
                                                if (curOffset > maxOffset - 1) {
                                                    break;
                                                }
                                            }
                                            if (curOffset < maxOffset && 'nextLink' in result.list) {
                                                entry = {
                                                    text: 'NEXT',
                                                    browseKey: `${result.list.nextLink}`,
                                                    headerTitle: `${headers[headers.length - 1]}`,
                                                };
                                                myArr.push(entry);
                                            }
                                            break;
                                        case 'Album':
                                            lstCommand = headers[headers.length - 1];
                                            searchKey = lstCommand.substring(lstCommand.length - 1);
                                            maxOffset;
                                            curOffset = parseInt(result.list.offset);
                                            for (const objKey of result.list.index.item) {
                                                if (objKey.key == searchKey) {
                                                    maxOffset = parseInt(objKey.offset) + parseInt(objKey.length);
                                                    break;
                                                }
                                            }
                                            for (const objItem of result.list.item) {
                                                entry = {
                                                    text: `${objItem.title} - ${objItem.subTitle}`,
                                                    browseKey:
                                                        playlistToggle == 1
                                                            ? `${objItem.playAction.URI}`
                                                            : `${objItem.playAction.URI}`.replace(
                                                                  'playnow=1',
                                                                  'playnow=0',
                                                              ),
                                                    headerTitle: `${objItem.title} - ${objItem.subTitle}`,
                                                };
                                                myArr.push(entry);
                                                curOffset++;
                                                if (curOffset > maxOffset - 1) {
                                                    break;
                                                }
                                            }
                                            if (curOffset < maxOffset && 'nextLink' in result.list) {
                                                entry = {
                                                    text: 'NEXT',
                                                    browseKey: `${result.list.nextLink}`,
                                                    headerTitle: `${headers[headers.length - 1]}`,
                                                };
                                                myArr.push(entry);
                                            }
                                            break;
                                        case 'Composer':
                                            lstCommand = headers[headers.length - 1];
                                            searchKey = lstCommand.substring(lstCommand.length - 1);
                                            maxOffset;
                                            curOffset = parseInt(result.list.offset);
                                            for (const objKey of result.list.index.item) {
                                                if (objKey.key == searchKey) {
                                                    maxOffset = parseInt(objKey.offset) + parseInt(objKey.length);
                                                    break;
                                                }
                                            }
                                            for (const objItem of result.list.item) {
                                                regExP = new RegExp('(?<=composer=).+');
                                                var myComposer = `${objItem.action.URI}`.match(regExP)[0];
                                                entry = {
                                                    text: `${objItem.title}`,
                                                    browseKey: `/ui/browseContext?service=LocalMusic&title=${myComposer}&type=Composer&url=%2FComposers%3Fservice%3DLocalMusic%26composer%3D${encodeURIComponent(myComposer)}`,
                                                    headerTitle: `${objItem.title}`,
                                                };
                                                myArr.push(entry);
                                                curOffset++;
                                                if (curOffset > maxOffset - 1) {
                                                    break;
                                                }
                                            }
                                            if (curOffset < maxOffset && 'nextLink' in result.list) {
                                                entry = {
                                                    text: 'NEXT',
                                                    browseKey: `${result.list.nextLink}`,
                                                    headerTitle: `${headers[headers.length - 1]}`,
                                                };
                                                myArr.push(entry);
                                            }
                                            break;
                                        default:
                                    }
                                }
                                break;
                            case 'playlist':
                                entry = {
                                    text: 'Content added, ... ',
                                    browseKey: 'BACK',
                                    headerTitle: `${headers[headers.length - 2]}`,
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
            await this.readPlayerStatus();
            await this.readPlaylist();
            return res;
        } catch (e) {
            this.log.error(`Could not retrieve Browse data: ${e}`);
            return res;
        }
    }
    async initMenu() {
        var templist = await this.readBrowseData(); // Top level menu

        this.setState('info.list', templist, true);
        this.setState('info.listheader', 'Main Menu', true);
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options] Options defined
     */
    module.exports = options => new Bluesound(options);
} else {
    // otherwise start the instance directly
    new Bluesound();
}

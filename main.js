'use strict';

/*
 * Created with @iobroker/create-adapter v1.31.0
 */
// version 0.0.11 all ACK warnings eliminated (jscontroller 3.3)
// version 0.0.10 ACK warning at startup eliminated
// version 0.0.8 Slight modifications due to adapter check
// version 0.0.7 Status polling added
// version 0.0.6 Volume control added
// version 0.0.5 Presets added
// version 0.0.4 IP added, Device name creation added, Added creation of objects

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const helper = require(`${__dirname}/lib/utils`);
const requestPromise = require(`request-promise-native`);
var ip;
let polling;
let pollingTime;

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
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		if (this.config.IP) {
			ip = this.config.IP;
			this.log.info('[Start] Starting adapter bluesound with: ' + this.config.IP);
		}
		else {
			this.log.warn('[Start] No IP Address set');
		}
		
		pollingTime = adapter.config.pollingtime || 30000 ;
		
		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		
		await this.setObjectNotExistsAsync(this.namespace, {
			type: 'device',
			common: {
				name: 'Bluesound device'
			},
			native: {},
		});

		// create objects
		const promises = [];
		for (const obj of helper.States) {
			const id = obj._id;
			delete obj._id;
			promises.push(this.setObjectNotExistsAsync(id, obj));
		}
		
		await Promise.all(promises);
		
		let sNameTag = adapter.namespace + '.info.name';
		this.subscribeStates(sNameTag);
		let sModelNameTag = adapter.namespace + '.info.modelname';
		this.subscribeStates(sModelNameTag);
		
		
		// set Info
		
		try {
		  const result = await requestPromise({url:`http://${ip}:11000/SyncStatus`});
		  var parser = new RegExp('name="(.+)(?=" etag)');
		  var sName = parser.exec(result)[1];
	      this.setState(sNameTag,sName,true);
		  var parser1 = new RegExp('modelName="(.+)(?=" model)');
          var sModelName = parser1.exec(result)[1];
	      this.setState(sModelNameTag,sModelName,true);
		} catch (e) { this.log.error(e);}
		
		// Initialize Control
		
		// stop = false
		sNameTag = adapter.namespace + '.control.stop';
		this.subscribeStates(sNameTag);
		this.setState(sNameTag,false,true);
		// pause = false
		sNameTag = adapter.namespace + '.control.pause';
		this.subscribeStates(sNameTag);
		this.setState(sNameTag,false,true);
		// play = false
		sNameTag = adapter.namespace + '.control.play';
		this.subscribeStates(sNameTag);
		this.setState(sNameTag,false,true);
		// state = ""
		sNameTag = adapter.namespace + '.control.state';
		this.subscribeStates(sNameTag);
		this.setState(sNameTag,"",true);
		try {
			// volume from player
			const result = await requestPromise({url:`http://${ip}:11000/Volume`});
			let parser1 = RegExp('>(.+)(?=<)');
			sNameTag = adapter.namespace + '.control.volume';
			this.subscribeStates(sNameTag);
			this.setState(sNameTag,parser1.exec(result)[1],true);
		} catch (e) { this.log.error(e);}

		// Presets
		
		try {
		    const result = await requestPromise({url:`http://${ip}:11000/Presets`});
		    parser = RegExp('preset(.+)\n','g');
		    let data = [];
		    let i = 1;
		    while((data = parser.exec(result)) != null){
				if (data[1].substring(0,4) == ' url') {
					let parser1 = RegExp('id="(.+)(?=" name)');
					var sPresetID = parser1.exec(data[1])[1];
					parser1 = RegExp('name="(.+)(?=" image)');
					var sPresetName = parser1.exec(data[1])[1];
					parser1 = RegExp('image="(.+)(?="\/)');
					var sPresetImage = parser1.exec(data[1])[1];
					const data1 = {
						id:   sPresetID,
						name: sPresetName,
						image:  sPresetImage,
						start: false 
					};

					const objs = helper.getPresets(i);
				  
					for (const obj of objs){
						const id = obj._id;
						delete obj._id;
						promises.push(this.setObjectNotExistsAsync(id,obj));
						if (obj.type != 'channel'){
							var sTag = adapter.namespace + `.presets.preset${i}.${obj.common.name}`;
							for (let x in data1){
								if (x == obj.common.name) {
									adapter.subscribeStates(sTag);
									adapter.setState(sTag,data1[x],true);
								}
							}
						}

					}
					i=i+1;
				}
			}
			await Promise.all(promises);
		}
		catch (e) { adapter.log.error(e);}
		
		// Status

		try{
			await readPlayerStatus();
		}
		catch (e) { adapter.log.error(e);}
		
		// Polling
		
		await startPolling(pollingTime);
		
		 
		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
//		this.subscribeStates('testVariable');
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates('*');

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
//		await this.setStateAsync('testVariable', true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
//		await this.setStateAsync('testVariable', { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
//		await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
//		let result = await this.checkPasswordAsync('', '');
//		this.log.info('check user admin pw iobroker: ' + result);

//		result = await this.checkGroupAsync('admin', 'admin');
//		this.log.info('check group user admin group admin: ' + result);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			if (state.val) {
				let pos = id.lastIndexOf('.');
				switch (id.substring(pos+1))
				{
					case 'start':
						try {
							this.getState(id.substring(0,pos) + '.id',(err, status) => {
								if (status || status.val){
									let preset = status.val;
									require("request")(`http://${ip}:11000/Preset?id=${preset}`, function (error, response, result) {
										let parser1 = RegExp('<state>(.+)(?=<)');
										let sStateTag = adapter.namespace + '.control.state';
										adapter.subscribeStates(sStateTag);
										adapter.setState(sStateTag,parser1.exec(result)[1],true);
										adapter.log.info(`${adapter.namespace} Preset${preset} Start`);
									}).on("error", function (e) {adapter.log.error(e);});
									setTimeout(function (){
										readPlayerStatus();
									},2000);
//									if (!polling) startPolling(pollingTime);
								}
							});
						} catch(e) { this.log.info('Keine Verbindung');	}
						break;
					case 'pause':
						require("request")(`http://${ip}:11000/Pause?toggle=1`, function (error, response, result) {
							let parser1 = RegExp('<state>(.+)(?=<)');
							let sStateTag = adapter.namespace + '.control.state';
							adapter.subscribeStates(sStateTag);
							adapter.setState(sStateTag,parser1.exec(result)[1],true);
							adapter.log.info(`${adapter.namespace} Pause`);
						}).on("error", function (e) {adapter.log.error(e);});
						setTimeout(function (){
							readPlayerStatus();
						},2000);
//						if (polling) stopPolling();
						break;
					case 'stop':
						require("request")(`http://${ip}:11000/Stop`, function (error, response, result) {
							let parser1 = RegExp('<state>(.+)(?=<)');
							let sStateTag = adapter.namespace + '.control.state';
							adapter.subscribeStates(sStateTag);
							adapter.setState(sStateTag,parser1.exec(result)[1],true);
							adapter.log.info(`${adapter.namespace} Stop`);
						}).on("error", function (e) {adapter.log.error(e);});
						clearPlayerStatus();
//						if (polling) stopPolling();
						break;
					case 'play':
						require("request")(`http://${ip}:11000/Play`, function (error, response, result) {
							let parser1 = RegExp('<state>(.+)(?=<)');
							let sStateTag = adapter.namespace + '.control.state';
							adapter.subscribeStates(sStateTag);
							adapter.setState(sStateTag,parser1.exec(result)[1],true);
							adapter.log.info(`${adapter.namespace} Play`);
						}).on("error", function (e) {adapter.log.error(e);});
						setTimeout(function (){
							readPlayerStatus();
						},2000);
//						if (!polling) startPolling(pollingTime);
						break;
					case 'volume':
						require("request")(`http://${ip}:11000/Volume?level=${state.val}`, function (error, response, result) {
						}).on("error", function (e) {adapter.log.error(e);});
						break;
					default:
						adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

				}
			} else {
				adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
			}
			
			
			
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }
}
	async function readPlayerStatus(){
		const promises = [];
		let title = [];
		let i;
		for (i=1; i<4; i++){
			title[i] = "";
		}
		try{
			const result = await requestPromise({url:`http://${ip}:11000/Status`});
			let parser = RegExp('title(.+)(?=<)','g');
			let data = [];
			while ((data = await parser.exec(result)) != null) {
				i = data[1].substring(0,1);
				title[i] = stripHTML(data[1].substring(2));
			}
			
			await Promise.all(promises);

			parser = RegExp('<state>(.+)(?=<)','g');
			const pState = await parser.exec(result)[1];

			var pStateOld = await adapter.getStateAsync(adapter.namespace + '.control.state');
			
//			adapter.log.info(`Old: ${pStateOld.val}, New: ${pState}`);
			
			if (pState != pStateOld.val) {
				
				let sStateTag = adapter.namespace + '.control.state';
				adapter.subscribeStates(sStateTag);
				await adapter.setStateAsync(sStateTag,{val:pState,ack:true});
			
			}

			if ( pState == 'stream' || pState == 'play') {
				adapter.subscribeStates(adapter.namespace+'.info.title*');

				for (i=1; i<4; i++){
					let sStateTag = adapter.namespace + `.info.title${i}`;
					await adapter.setStateAsync(sStateTag,{val:title[i],ack:true});
				}
			}
			
		}
		catch (e) { adapter.log.error(e);}

	}
	
	async function clearPlayerStatus(){
		let i;
		adapter.subscribeStates(adapter.namespace+'.info.title*');
		for (i=1;i<4; i++){
			let sStateTag = adapter.namespace + `.info.title${i}`;
			await adapter.setStateAsync(sStateTag,{val:"",ack:true});
		}
	}
	
	async function startPolling(pTime) {
		if (!polling) {
			polling = adapter.setInterval(async => {
				try {
					readPlayerStatus();
				} catch (e) {adapter.log.error(e);}
			},pTime);
		}
	}
	
	async function stopPolling() {
		adapter.clearInterval(polling);
		polling = null;
	}
	
	function stripHTML(str) {
		let strneu = str.replace("&amp;","&");
		return strneu;
	}
	

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Bluesound(options);
} else {
	// otherwise start the instance directly
	var adapter = new Bluesound();
}


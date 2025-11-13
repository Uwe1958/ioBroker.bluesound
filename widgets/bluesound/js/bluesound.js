/*
	ioBroker.vis bluesound Widget-Set

	version: "0.0.1"

	Copyright 2025 Uwe Nagel uwenagel@kabelmail.de
*/
'use strict';

/* global $, vis, systemDictionary */

// add translations for edit mode
$.extend(true, systemDictionary, {
    // Add your translations here, e.g.:
    // "size": {
    // 	"en": "Size",
    // 	"de": "Größe",
    // 	"ru": "Размер",
    // 	"pt": "Tamanho",
    // 	"nl": "Grootte",
    // 	"fr": "Taille",
    // 	"it": "Dimensione",
    // 	"es": "Talla",
    // 	"pl": "Rozmiar",
    //  "uk": "Розмір"
    // 	"zh-cn": "尺寸"
    // }
});

// this code can be placed directly in bluesound.html
vis.binds['bluesound'] = {
    version: '0.0.2',
    createWidget: function (widgetID, data) {
        var $div = $(`#${widgetID}`);
        // if nothing found => wait
        if (!$div.length) {
            return setTimeout(function () {
                vis.binds['bluesound'].createWidget(widgetID, data);
            }, 100);
        }
        var text = '';
        text += `<div id="bluesound-testvalue"></div>`;
        //        const objplaylist = 'bluesound.0.info.playlist';

        //text += 'OID: ' + data.oid + '</div><br>';
        //        text += 'OID value: <span class="bluesound-value">' + vis.states[data.oid + '.val'] + '</span><br>';
        //        text += 'Color: <span style="color: ' + data.BackgroundColor + '">' + data.BackgroundColor + '</span><br>';
        //        text += 'Browser instance: ' + vis.instance + '<br>';
        /*        const objplaylist = 'bluesound.0.info.playlist';
        var playlist = vis.conn.getStates(objplaylist).val;

        var table = '';
        table += '<table>';
        playlist.array.forEach(element => {
            table += `<tr><td>${element.title}</td></tr>`;
        });
        table += '</table>';*/

        $(`#${widgetID}`).html(text);

        // cache all jQuery selectors
        let $testvalue = $('#bluesound-testvalue');

        // subscribe on updates of value
        /*        function onChange(obj, newVal) {
            let id = obj.type.split('.')[2];
            switch (id) {
                case 'Header':
                    $testvalue.text(`${newVal} neu`);
                    break;
                default:
            }
        }*/

        let dps = ['0_userdata.0.Header'];

        // Update states and subscribe to changes
        vis.conn.getStates(dps, function (error, states) {
            vis.updateStates(states);
            vis.conn.subscribe(dps);

            // ad onChange listener
            for (let i = 0; i < dps.length; i++) {
                dps[i] = `${dps[i]}.val`;
                //                vis.states.bind(dps[i], onChange);
            } // endFor

            // give vis ability to destroy on change
            $div.data('bound', dps);
            //            $div.data('bindHandler', onChange);

            // set initial values
            $testvalue.text(`${states['0_userdata.0.Header'].val}`);
        });
    },
};

vis.binds['bluesound'].showVersion();

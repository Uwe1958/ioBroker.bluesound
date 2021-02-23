'use strict';

const States = [
     {
        _id: `info`,
        type: `channel`,
        common: {
            name: `Device Information`
        },
        native: {}
    },
    
    {
        _id: `info.name`,
        type: `state`,
        common: {
            name: `Player Name`,
            type: `string`,
            role: `text`,
            read: true,
            write: false,
            desc: `Name from player`
        },
        native: {}
    },

    {
        _id: `info.modelname`,
        type: `state`,
        common: {
            name: `Player Model`,
            type: `string`,
            role: `text`,
            read: true,
            write: false,
            desc: `Modelname from player`
        },
        native: {}
    }
];
/**
 * Returns the Presets in an array
 *
 * @param {string} id - Preset id
 * @returns {({common: {name: string}, native: {}, _id: string, type: string}|{common: {role: string, read: boolean, name: string, type: string, write: boolean, desc: string}, native: {}, _id: string, type: string})[]}
 */
const getPresets = (id) => {
    return [
        {
            _id: `presets.preset${id}`,
            type: `channel`,
            common: {
                name: `Preset ${id}`
            },
            native: {}
        },
        {
            _id: `presets.preset${id}.id`,
            type: `state`,
            common: {
                name: `id`,
                type: `number`,
                role: `value`,
                read: true,
                write: false,
                desc: `Preset ID`
            },
            native: {}
        },
        {
            _id: `presets.preset${id}.name`,
            type: `state`,
            common: {
                name: `name`,
                type: `string`,
                role: `text`,
                read: true,
                write: false,
                desc: `Preset Name`
            },
            native: {}
        },
        {
            _id: `presets.preset${id}.image`,
            type: `state`,
            common: {
                name: `url`,
                type: `string`,
                role: `url`,
                read: true,
                write: false,
                desc: `Image Url`
            },
            native: {}
        },
        {
            _id: `presets.preset${id}.start`,
            type: `state`,
            common: {
                name: `start`,
                type: `boolean`,
                read: true,
                write: true,
                desc: `Toggles Start`
            },
            native: {}
        },
        {
            _id: `presets.preset${id}.stop`,
            type: `state`,
            common: {
                name: `stop`,
                type: `boolean`,
                read: true,
                write: true,
                desc: `Toggles Stop`
            },
            native: {}
        },
        {
            _id: `presets.preset${id}.pause`,
            type: `state`,
            common: {
                name: `pause`,
                type: `boolean`,
                read: true,
                write: true,
                desc: `Toggles Pause`
            },
            native: {}
        }
        ];
    };

module.exports = {
    States,
    getPresets
};


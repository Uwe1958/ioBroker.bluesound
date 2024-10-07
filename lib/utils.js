'use strict';

/*
 *
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
                name: `Preset ${id}`,
            },
            native: {},
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
                desc: `Preset ID`,
            },
            native: {},
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
                desc: `Preset Name`,
            },
            native: {},
        },
        {
            _id: `presets.preset${id}.image`,
            type: `state`,
            common: {
                name: `image`,
                type: `string`,
                role: `text.url`,
                read: true,
                write: false,
                desc: `Preset Url`,
            },
            native: {},
        },
        {
            _id: `presets.preset${id}.start`,
            type: `state`,
            common: {
                name: `start`,
                type: `boolean`,
                role: `button.start`,
                read: false,
                write: true,
                desc: `Toggles Preset Start`,
            },
            native: {},
        },
    ];
};

module.exports = {
    getPresets,
};

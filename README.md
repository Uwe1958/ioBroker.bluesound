![Logo](admin/bluesound.png)

# ioBroker.bluesound

[![NPM version](https://img.shields.io/npm/v/iobroker.bluesound.svg)](https://www.npmjs.com/package/iobroker.bluesound)
[![Downloads](https://img.shields.io/npm/dm/iobroker.bluesound.svg)](https://www.npmjs.com/package/iobroker.bluesound)
![Number of Installations](https://iobroker.live/badges/bluesound-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/bluesound-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.bluesound.png?downloads=true)](https://nodei.co/npm/iobroker.bluesound/)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/bluesound/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)

**Tests:** ![Test and Release](https://github.com/Uwe1958/ioBroker.bluesound/workflows/Test%20and%20Release/badge.svg)

## bluesound adapter for ioBroker

Adapter to control Bluesound devices

## Functions included

The adapter uses API calls in the format: http://--playerAPI--:11000/xxx

A timeout parameter is set by optional parameter 'config.TimeOut' as timeout for the API call. Default value is 2 secs.

At startup the presets are read and added to the 'presets' channel.
Player model and name are stored in the 'info' channel.
When player is playing the titles are set in the 'info' channel.

The player status is polled in the interval set by 'config.pollingtime' and the result is stored in 'control.state' as well as in 'info.\*'.

PollingTime values up to 120 secs are reasonable. The adapter cannot be startet with values larger than 300 secs. Default value is 30 secs.

The following functions are implemented:

- Player stop (triggered by setting 'control.stop' to true)
- Player start (triggered by setting 'control.start' to true)
- Player Pause (triggered by setting 'control.pause' to true, toggle mode)
- Play Presetxxx (triggered by setting '.presets.preset(x).start' to true)
- Change Volume (triggered by changing 'control.volume')

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**

- (Uwe Nagel) Bump @eslint/js from 9.28.0 to 9.30.0
- (Uwe Nagel) Bump globals from 16.0.0 to 16.2.0
- (Uwe Nagel) Bump prettier from 3.5.3 to 3.6.2
- (Uwe Nagel) Bump eslint from 9.28.0 to 9.30.0
- (Uwe Nagel) Bump sinon from 20.0.0 to 21.0.0
- (Uwe Nagel) Bump @types/node from 22.15.29 to 24.0.8
- (Uwe Nagel) Translated using Weblate (Dutch)
- (Uwe Nagel) Bump eslint from 9.22.0 to 9.28.0
- (Uwe Nagel) Bump @types/chai from 5.2.1 to 5.2.2
- (Uwe Nagel) Bump @types/node from 22.15.3 to 22.15.29
- (Uwe Nagel) Update test-and.release.yml to node 24.x
- (Uwe Nagel) Bump eslint-config-prettier from 10.1.2 to 10.1.5
- (Uwe Nagel) Bump @eslint/js from 9.25.1 to 9.28.0
- (Uwe Nagel) Update testing to minimum node.js version 20
- (Uwe Nagel) Bump eslint-config-prettier from 10.1.1 to 10.1.2
- (Uwe Nagel) Bump sinon from 19.0.5 to 20.0.0
- (Uwe Nagel) Bump @eslint/js from 9.23.0 to 9.25.1
- (Uwe Nagel) Bump @types/node from 22.13.10 to 22.15.3
- (Uwe Nagel) Bump eslint-plugin-prettier from 5.2.3 to 5.2.6
- (Uwe Nagel) Bump @eslint/eslintrc from 3.3.0 to 3.3.1
- (Uwe Nagel) Bump @types/chai from 5.2.0 to 5.2.1
- (Uwe Nagel) Bump @eslint/js from 9.22.0 to 9.23.0
- (Uwe Nagel) Bump @iobroker/testing from 5.0.3 to 5.0.4
- (Uwe Nagel) Bump globals from 15.15.0 to 16.0.0

### 1.1.5 (2025-03-10)

- (Uwe Nagel) Create version 1.1.5
- (Uwe Nagel) Update info.connection regularly
- (Uwe Nagel) Update admin dependency to >=7.4.10
- (Uwe Nagel) Update @iobroker/adapter-dev to 1.3.0
- (Uwe Nagel) Fixing test action problems
- (Uwe Nagel) Bump mocha from 11.0.1 to 11.1.0
- (Uwe Nagel) Bump eslint-config-prettier from 9.1.0 to 10.0.1
- (Uwe Nagel) Bump chai and @types/chai
- (Uwe Nagel) Bump eslint from 9.16.0 to 9.19.0
- (Uwe Nagel) Corrected translations (de,pl)
- (Uwe Nagel) Update @iobroker/adapter-core to 3.2.3
- (Uwe Nagel) Update @iobroker/testing to 5.0.0

### 1.1.4 (2025-01-03)

- (Uwe Nagel) Correct common.news

### 1.1.3 (2025-01-03)

- (Uwe Nagel) Changed year in README
- (Uwe Nagel) Bump prettier from 3.4.1 to 3.4.2
- (Uwe Nagel) Bump mocha from 10.8.2 to 11.0.1
- (Uwe Nagel) Bump chai-as-promised and @types/chai-as-promised
- (Uwe Nagel) Bump sinon from 18.0.0 to 19.0.2
- (Uwe Nagel) Bump globals from 15.9.0 to 15.14.0

### 1.1.1 (2024-12-01)

- (Uwe Nagel) README.md cosmetics
- (Uwe Nagel) Added Weblate translation badge
- (Uwe Nagel) Bump cross-spawn from 7.0.3 to 7.0.6
- (Uwe Nagel) Switch to adapter-core3.2.2
- (Uwe Nagel) Corrected logic for remote volume changes

### 1.1.0 (2024-10-19)

- (Uwe Nagel) Potentially invalid characters are replaced before creating an object
- (Uwe Nagel) setTimeout used instead of setInterval, clearTimeout added
- (Uwe Nagel) Check values for PollingTime and TimeOut
- (Uwe Nagel) Missing sizes added
- (Uwe Nagel) State roles reevaluated
- (Uwe Nagel) subscribeState calls eliminated
- (Uwe Nagel) Instance prefixes in ObjectIds are omitted when calling setState()
- (Uwe Nagel) State change now honors ack flag
- (Uwe Nagel) PollingTime and TimeOUT changed to type number
- (Uwe Nagel) onReady() stopped when no IP is set
- (Uwe Nagel) Testing extended to node 22.x
- (Uwe Nagel) Example code removed

### 1.0.3 (2024-09-26)

- (Uwe Nagel) Parsing of /State corrected

### 1.0.2 (2024-09-19)

- (Uwe Nagel) Modified due to adapter checks

### 1.0.1 (2024-05-24)

- (Uwe Nagel) Added config descriptions
- (Uwe Nagel) Added translations for object descriptions
- (Uwe Nagel) Added role definition for all objects
- (Uwe Nagel) Added Timeout config Parameter

### 1.0.0 (2024-05-17)

- (Uwe Nagel) initial release

## License

MIT License

Copyright (c) 2025 Uwe Nagel <uwenagel@kabelmail.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

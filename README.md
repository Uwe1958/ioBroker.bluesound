![Logo](admin/bluesound.png)

# ioBroker.bluesound

[![NPM version](https://img.shields.io/npm/v/iobroker.bluesound.svg)](https://www.npmjs.com/package/iobroker.bluesound)
[![Downloads](https://img.shields.io/npm/dm/iobroker.bluesound.svg)](https://www.npmjs.com/package/iobroker.bluesound)
![Number of Installations](https://iobroker.live/badges/bluesound-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/bluesound-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.bluesound.png?downloads=true)](https://nodei.co/npm/iobroker.bluesound/)

**Tests:** ![Test and Release](https://github.com/Uwe1958/ioBroker.bluesound/workflows/Test%20and%20Release/badge.svg)

## bluesound adapter for ioBroker

Adapter to control Bluesound devices

## Developer manual

This section is intended for the developer. It can be deleted later.

### DISCLAIMER

Please make sure that you consider copyrights and trademarks when you use names or logos of a company and add a disclaimer to your README.
You can check other adapters for examples or ask in the developer community. Using a name or logo of a company without permission may cause legal problems for you.

### Getting started

You are almost done, only a few steps left:

1. Create a new repository on GitHub with the name `ioBroker.bluesound`
1. Initialize the current folder as a new git repository:
    ```bash
    git init -b main
    git add .
    git commit -m "Initial commit"
    ```
1. Link your local repository with the one on GitHub:

    ```bash
    git remote add origin https://github.com/Uwe1958/ioBroker.bluesound
    ```

1. Push all files to the GitHub repo:
    ```bash
    git push origin main
    ```
1. Add a new secret under https://github.com/Uwe1958/ioBroker.bluesound/settings/secrets. It must be named `AUTO_MERGE_TOKEN` and contain a personal access token with push access to the repository, e.g. yours. You can create a new token under https://github.com/settings/tokens.

1. Head over to [main.js](main.js) and start programming!

### Best Practices

We've collected some [best practices](https://github.com/ioBroker/ioBroker.repositories#development-and-coding-best-practices) regarding ioBroker development and coding in general. If you're new to ioBroker or Node.js, you should
check them out. If you're already experienced, you should also take a look at them - you might learn something new :)

### Scripts in `package.json`

Several npm scripts are predefined for your convenience. You can run them using `npm run <scriptname>`
| Script name | Description |
|-------------|-------------|
| `test:js` | Executes the tests you defined in `*.test.js` files. |
| `test:package` | Ensures your `package.json` and `io-package.json` are valid. |
| `test:integration` | Tests the adapter startup with an actual instance of ioBroker. |
| `test` | Performs a minimal test run on package files and your tests. |
| `check` | Performs a type-check on your code (without compiling anything). |
| `lint` | Runs `ESLint` to check your code for formatting errors and potential bugs. |
| `translate` | Translates texts in your adapter to all required languages, see [`@iobroker/adapter-dev`](https://github.com/ioBroker/adapter-dev#manage-translations) for more details. |
| `release` | Creates a new release, see [`@alcalzone/release-script`](https://github.com/AlCalzone/release-script#usage) for more details. |

### Writing tests

When done right, testing code is invaluable, because it gives you the
confidence to change your code while knowing exactly if and when
something breaks. A good read on the topic of test-driven development
is https://hackernoon.com/introduction-to-test-driven-development-tdd-61a13bc92d92.
Although writing tests before the code might seem strange at first, but it has very
clear upsides.

The template provides you with basic tests for the adapter startup and package files.
It is recommended that you add your own tests into the mix.

### Publishing the adapter

Using GitHub Actions, you can enable automatic releases on npm whenever you push a new git tag that matches the form
`v<major>.<minor>.<patch>`. We **strongly recommend** that you do. The necessary steps are described in `.github/workflows/test-and-release.yml`.

Since you installed the release script, you can create a new
release simply by calling:

```bash
npm run release
```

Additional command line options for the release script are explained in the
[release-script documentation](https://github.com/AlCalzone/release-script#command-line).

To get your adapter released in ioBroker, please refer to the documentation
of [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories#requirements-for-adapter-to-get-added-to-the-latest-repository).

### Test the adapter manually with dev-server

Since you set up `dev-server`, you can use it to run, test and debug your adapter.

You may start `dev-server` by calling from your dev directory:

```bash
dev-server watch
```

The ioBroker.admin interface will then be available at http://localhost:8081/

Please refer to the [`dev-server` documentation](https://github.com/ioBroker/dev-server#command-line) for more details.

## Functions included

The adapter uses API calls in the format: http://--playerAPI--:11000/xxx

At startup the presets are read and added to the 'presets' channel.
Player model and name are stored in the 'info' channel.
When player is playing the titles are set in the 'info' channel.
The player status is polled in the interval set by '.config.pollingtime' and the result is stored in '.control.state' as well as in '.info.\*'.

The following functions are implemented:

Player stop (triggered by setting '.control.stop' to true)
Player start (triggered by setting '.control.start' to true)
Player Pause (triggered by setting '.control.pause' to true, toggle mode)
Play Presetxxx (triggered by setting '.presets.preset(x).start' to true)
Change Volume (triggered by changing '.control.volume')

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### 0.2.0 Adapter rebuild using development server
    ### 0.1.8 Fixed type error (PollingTime) after updating to javascript 5.
    ### 0.1.7 Issue #11: Volume is now read from player and stored into .info.volume
    ### 0.1.6 Added secs and totlen also as string object
    ### 0.1.5 Solved error message, when totlen is not reported in /Status
    ### 0.1.4 pollingtime is now correctly read from config page
    ### 0.1.0 All `request` calls changed to `axios` (`request-promise-native` deprecated)
    ### 0.0.14 Solved dependabot alerts
    ### 0.0.13 follow-redirect vulnerability eliminated
    ### 0.0.12 Bump parse-path from 1.0.6 to 1.0.7
    ### 0.0.11 ACK warnings (due to JS controller 3.3) eliminated
    ### 0.0.8 Slight changes due to adapter check
    ### 0.0.7 Status polling added
    ### 0.0.6 Volume control implemented
    ### 0.0.5 Start/Stop/Pause implemented
    ### 0.0.4 Presets created as states
    ### 0.0.3 Device info created as states
    ### 0.0.1 (uwe1958) initial release
-->

### **WORK IN PROGRESS**

-   (Uwe Nagel) initial release

## License

MIT License

Copyright (c) 2024 Uwe Nagel <uwenagel@kabelmail.de>

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

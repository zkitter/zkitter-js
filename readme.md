# ZkitterJS

Javascript implementation of a standalone Zkitter node



## CLI Usage
To install CLI:
```sh
npm i -g zkitter-js
```

CLI options:
```
Options:
  -V, --version       output the version number
  -h, --help          display help for command

Commands:
  init [options]      initialize zkitter
  status              display status
  timeline [options]  display timeline
  sync [options]      sync with arbitrum and group
  fetch [options]     fetch historical data (30 days max) from waku
  whois <address>     sync with arbitrum and group
  up                  start zkitter and subscribe to all global events
  write [options]     publish a post
  list [options]      list all groups or users
  help [command]      display help for command
```

## NPM Usage
```ts
import {Zkitter} from "zkitter-js";
const zkitter = await Zkitter.initialize({
  arbitrumHttpProvider: 'https://...',
});

// Sync with arbitrum registrar
await zkitter.syncUsers();

// Sync with zk groups on zkitter
await zkitter.syncGroup();

// Get all historical messages (30 days) from Waku store
await zkitter.queryAll();

// Subscribe to all future messages from everyone
await zkitter.subscribe();
```

## Development

```sh
# node v16 
npm install

# build a dev cli to build/cli.js 
npm run dev
```
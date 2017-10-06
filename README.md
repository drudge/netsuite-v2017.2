# NetSuite SOAP client for NodeJS based apps (v2017.2)

This library is at early alpha stage, don't expect it to do much. If you are using NodeJS and struggling to get data from NetSuite's SOAP based SuiteTalk API
then looking through the code may prove informative.

# Install

```
npm install netsuite-v2017.2
```

# Usage

With credentials:
```js
var NetSuite = require('netsuite-v2017.2');
var ns = new NetSuite({appId: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', passport: {account: 'TSTDRV111111', email: 'you@yourcompany.com', password: 'shhhhh'}});
```

# A simple search of Files in the file cabinet

Here's a quick example that will loop through all files in your account:

```js
var NetSuite = require('netsuite-v2017.2');
var ns = new NetSuite({appId: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', passport: {account: 'TSTDRV111111', email: 'you@yourcompany.com', password: 'shhhhh'}});

var result = await ns.search({type: 'FileSearch'});
while (result) {
    result = await ns.searchMoreWithId(result);
}
```

# Supported seach objects

 * FolderSearch
 * FileSearch

# Testing
To run unit tests, execute `npm test`

# Licence

This NetSuite SOAP client is distributed under the MIT licence.
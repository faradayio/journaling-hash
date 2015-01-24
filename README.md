# journaling-hash
Immutable hash that can back itself up to a file and rebuild itself

> "I get knocked down, but I get up again" - William Shakespeare

## Quick use

```console
npm install journaling-hash
```

Here is a simple example that will increment `number_of_cookies` every time you run it. If it crashes for some reason while incrementing the cookie count or writing to the file, the next time it is run it will recover to the last good state.

```javascript
var journalingHash = require('journaling-hash');

journalingHash('./state.log').then(function(state){
  if (!state.has('number_of_cookies')) {
    state.update({
      number_of_cookies: 0
    });
  } else {
    state.update({
      number_of_cookies: state.get('number_of_cookies') + 1
    });
  }
});
```

## Slow use

Here is a less contrived example. It aquires a new cookie every 5 seconds, but if you kill the process it won't lose any of the cookies it's kept.

```javascript
var journalingHash = require('journaling-hash');

var cookieTypes = ['Chocolate Chip Cookie', 'Macadamia Nut Cookie', 'Double Chocolate Cookie', 'Pretend Cookie'];
var downloadCookie = function(callback){
  console.log('Starting cookie download...');
  setTimeout(function(){
    //give a random cookie
    callback(cookieTypes[Math.floor(Math.random()*cookieTypes.length)]);
  }, 5000);
};

journalingHash('./state.log').then(function(state){

  if (!state.has('number_of_cookies')) {
    console.log('First run. Prepare for cookies.');
  } else {
    console.log('Resuming a previous cookie aquisition operation.');
    console.log(state.get('number_of_cookies')+' cookies found in '+state.journalPath);
  }

  var getCookie = function(){
    downloadCookie(function(newCookie){
      var cookieCount = state.get('number_of_cookies') || 0;
      cookieCount++;

      console.log('got a '+newCookie, 'bringing the total to '+cookieCount);

      update = {
        number_of_cookies: cookieCount,
        cookies: {}
      };
      update['cookies'][cookieCount] = newCookie;

      state.update(update).then(getCookie);
    });
  };

  getCookie();
});
```

## How it works

When you run `journalingHash(path)` it opens that path, reads it, and reconstructs an [immutable hash](https://www.npmjs.com/package/immutable-hash) from it.

The promise is resolved with an object which serves as your interface to the hash.

You can use any of the methods that [immutable hash](https://www.npmjs.com/package/immutable-hash) provides.

In order to make changes to the hash, you must use the `update` function which is provided. This will `patch` the hash, and persist the changes to the filesystem.

## Note

`hash.patch(...)` will return a new immutable hash.

`hash.update(...)` will call `hash.patch` and use the result to replace the internally stored hash, returning a promise that will resolve once the change has been written to the journal.

## Resumable.js Hapi

![shippable-badge](https://api.shippable.com/projects/5745e8ba2a8192902e216480/badge?branch=master)

This is a [resumable.js](https://github.com/23/resumable.js) backend for [Hapi](http://hapijs.com/). It is adapted from [this example](https://github.com/23/resumable.js/blob/master/samples/Node.js/resumable-node.js).

### Usage

Register the plugin the usual way. Access the object from `server.plugins['resumable-js-hapi'].service`,
or construct your own like so:
```js
var ResumableJsService =  require('resumable-js-hapi/lib/resumable-js-service');
var service = new ResumableJsService();
```

* Check if chunk exists:
```js
server.plugins['resumable-js-hapi'].service.get(request).then(exists => {
    if (exists) {
        reply();
    } else {
        reply().code(404);
    }
}).catch(err => {
    // something went wrong
})
```
* Accept chunk:
```js
var resumable = server.plugins['resumable-js-hapi'].service;
resumable.post(request).then(result => {
    if (result.complete) {
        // final chunk uploaded
        var stream = getSomeSortOfWritableStream();
        resumable.write(result.identifier, stream).then(() => {
            // Delete chunks
            resumable.clean(result.identifier);
            // Done combining all the chunks and writing them to stream
        });
    } else {
        // chunk uploaded. more to go.
    }
}).catch(err => {
    // something went wrong
})
```

var ResumableJsService = require('./resumable-js-service');

exports.register = function(server, options, next) {
    server.expose(new ResumableJsService(options));
    next();
};

exports.register.attributes = {
    pkg : require('./package.json')
};

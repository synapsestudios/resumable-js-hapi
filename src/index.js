var ResumableJsService = require('./resumable-js-service');

exports.register = function(server, options, next) {
    server.expose('service', new ResumableJsService(options));
    next();
};

exports.register.attributes = {
    pkg : require('../package.json')
};

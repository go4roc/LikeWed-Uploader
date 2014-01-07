var _ = require('underscore'),
    EventEmitter = require('events').EventEmitter;

function _(type) {
    var date = new Date();

    var month = date.getMonth()+1;
    if (month < 10) month = '0'+month;
    return '/'+date.getFullYear()+'/'+month+'/'+uniqid()+type;
}

var UploaderMiddleware = function () {
    EventEmitter.call(this);
    // setting default options
    this.options = this.prepareOptions({});
};
require('util').inherits(UploaderMiddleware, EventEmitter);

UploaderMiddleware.prototype.prepareOptions = function (options) {
    options = _.extend({
        tmpDir: '/tmp',
        uploadDir: __dirname + '/public/files',
        uploadUrl: '/files/',
        maxPostSize: 1024*1024*20, // 20 M
        minFileSize: 1024,
        maxFileSize: 1024*1024*20, // 20 M
        acceptFileTypes: /.+/i,
        imageTypes: /\.(gif|jpe?g|png)$/i,
        imageVersions: {
//            thumbnail: {
//                width: 80,
//                height: 80
//            }
        },
        accessControl: {
            allowOrigin: '*',
            allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE'
        }
    }, options);

    return options;
}

UploaderMiddleware.prototype.configure = function (options) {
    this.options = this.prepareOptions(options);
};

UploaderMiddleware.prototype.fileHandler = function (options) {
    var self = this;

    var _options = self.prepareOptions(_.extend(this.options, options));

    return function (req, res, next) {
        res.set({
            'Access-Control-Allow-Origin': _options.accessControl.allowOrigin,
            'Access-Control-Allow-Methods': _options.accessControl.allowMethods
        });

        var UploadHandler = require('./lib/uploadhandler')(_options);
        var handler = new UploadHandler(req, res, self, function (err, result) {
            if (err) res.send(500, err.message);

            res.set({
                'Content-Type': (req.headers.accept || '').indexOf('application/json') !== -1
                    ? 'application/json'
                    : 'text/plain'
            });

            res.json(200, result);
        });

        switch (req.method) {
            case 'OPTIONS':
                res.end();
                break;
            case 'POST':
                handler.post();
                break;
            case 'HEAD':
            case 'GET':
            case 'DELETE':
            default:
                res.send(405);
        }
    }
};

module.exports = new UploaderMiddleware();
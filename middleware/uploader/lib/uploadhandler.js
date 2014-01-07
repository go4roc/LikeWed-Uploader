var EventEmitter = require('events').EventEmitter,
    path = require('path'),
    fs = require('fs'),
    formidable = require('formidable'),
    imageMagick = require('imagemagick'),
    mkdirp = require('mkdirp'),
    _ = require('underscore');

module.exports = function (options) {

    var FileInfo = require('./fileinfo')(
        _.extend({
            baseDir: options.uploadDir,
            pathType: options.pathType
        }, _.pick(options, 'minFileSize', 'maxFileSize', 'acceptFileTypes'))
    );

    var UploadHandler = function (req, res, middleware, callback) {
        EventEmitter.call(this);
        this.req = req;
        this.res = res;
        this.middleware = middleware;
        this.callback = callback;
    };

    require('util').inherits(UploadHandler, EventEmitter);

    UploadHandler.prototype.noCache = function () {
        this.res.set({
            'Pragma': 'no-cache',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Content-Disposition': 'inline; filename="files.json"'
        });
    };

    UploadHandler.prototype.post = function () {
        var self = this,
            middleware = self.middleware,
            form = new formidable.IncomingForm(),
            tmpFiles = [],
            files = [],
            map = {},
            counter = 1,
            finish = _.bind(function () {
                if (!--counter) {
                    _.each(files, function (fileInfo) {
                        this.initUrls(fileInfo);
                        middleware.emit('end', fileInfo);
                    }, this);
                    this.callback(null, {files: files});
                }
            }, this);

        this.noCache();

        form.uploadDir = options.tmpDir;
        form
            .on('fileBegin', function (name, file) {
                tmpFiles.push(file.path);
                var fileInfo = new FileInfo(file);
                map[path.basename(file.path)] = fileInfo;
                files.push(fileInfo);
                middleware.emit('begin', fileInfo);
            })
            .on('field', function (name, value) {
                //console.debug('name['+name+']=['+value+']');
            })
            .on('file', function (name, file) {
                var fileInfo = map[path.basename(file.path)];
                if (fs.existsSync(file.path)) {
                    fileInfo.size = file.size;
                    if (!fileInfo.validate()) {
                        fs.unlink(file.path);
                        return;
                    }

                    var generatePreviews = function () {
                        if (options.imageTypes.test(fileInfo.name)) {
                            _.each(options.imageVersions, function (value, version) {
                                // creating directory recursive
                                if (!fs.existsSync(options.uploadDir + fileInfo.path + '/' + version + '/'))
                                    mkdirp.sync(options.uploadDir + fileInfo.path + '/' + version + '/');

                                counter++;
                                var opts = options.imageVersions[version];
                                imageMagick.resize({
                                    width: opts.width,
                                    height: opts.height,
                                    srcPath: options.uploadDir + fileInfo.path + '/' + fileInfo.name,
                                    dstPath: options.uploadDir + fileInfo.path + '/' + version + '/' + fileInfo.name,
                                    customArgs: opts.imageArgs || ['-auto-orient']
                                }, finish);
                            });
                        }
                    }

                    if (!fs.existsSync(options.uploadDir + fileInfo.path + '/'))
                        mkdirp.sync(options.uploadDir + fileInfo.path + '/');

                    counter++;
                    fs.rename(file.path, options.uploadDir + fileInfo.path + '/' + fileInfo.name, function (err) {
                        if (!err) {
                            generatePreviews();
                            finish();
                        } else {
                            var is = fs.createReadStream(file.path);
                            var os = fs.createWriteStream(options.uploadDir + fileInfo.path + '/' + fileInfo.name);
                            is.on('end', function (err) {
                                if (!err) {
                                    fs.unlinkSync(file.path);
                                    generatePreviews();
                                }
                                finish();
                            });
                            is.pipe(os);
                        }
                    });
                }
            })
            .on('aborted', function () {
                _.each(tmpFiles, function (file) {
                    var fileInfo = map[path.basename(file)];
                    middleware.emit('abort', fileInfo);
                    fs.unlink(file);
                });
            })
            .on('error', function (e) {
                middleware.emit('error', e);
            })
            .on('progress', function (bytesReceived, bytesExpected) {
                if (bytesReceived > options.maxPostSize)
                    self.req.connection.destroy();
            })
            .on('end', finish)
            .parse(self.req);
    };

    UploadHandler.prototype.initUrls = function (fileInfo) {
        var baseUrl = (options.ssl ? 'https:' : 'http:') + '//' + (options.hostname || this.req.get('Host'));
        fileInfo.setUrl(null, baseUrl + options.uploadUrl + fileInfo.path);
        _.each(options.imageVersions, function (value, version) {
            if (fs.existsSync(options.uploadDir + fileInfo.path + '/' + version + '/' + fileInfo.name)) {
                fileInfo.setUrl(version, baseUrl + options.uploadUrl + fileInfo.path);
            }
        }, this);
    };

    return UploadHandler;
}


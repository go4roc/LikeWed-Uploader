/**
 * Module dependencies.
 */
var express = require('express'),
    log4js  = require('log4js'),
    config  = require('./config'),
    uploader  = require('../middleware/uploader');

 //var   RedisStore = require('connect-redis')(express);

var logger        = log4js.getLogger('SERVER');
var access_logger = log4js.getLogger('ACCESS');

module.exports = function(app, passport) {
    app.set('showStackError', true);

    //Setting access logger
    app.use(log4js.connectLogger(access_logger, { level: log4js.levels.INFO, format: ':req[x-forwarded-for] :method :url :status :response-time'}));
    //Setting static folder
    app.use(express.static(config.root + '/public'));

    //Set views path, template engine and default layout
    app.set('views', config.root + '/views');
    app.set('view engine', 'jade');

    //Enable jsonp
    //app.enable("jsonp callback");

    app.configure(function() {
        //cookieParser should be above session
        app.use(express.cookieParser());

        // request body parsing middleware should be above methodOverride
        app.use('/upload/img/ad', uploader.fileHandler({
            hostname: 'img.htwed.com',
            uploadDir: '/data/images/img/ad',
            pathType: "YYYY/MM",
            uploadUrl: '/ad'
        }));

        app.use('/upload/img/site', uploader.fileHandler({
            hostname: 'img.likewed.com',
            uploadDir: '/data/images/img/site',
            pathType: "YYYY/MM",
            uploadUrl: '/site'
        }));

        app.use('/upload/img/logos', uploader.fileHandler({
            hostname: 'img.htwed.com',
            uploadDir: '/data/images/img/logos',
            pathType: "YYYY/MM/DD",
            uploadUrl: '/logos',
            imageVersions: {
                "50": {
                    width: 50,
                    height: 50
                },
                "100": {
                    width: 100,
                    height: 100
                },
                "180": {
                    width: 180,
                    height: 180
                }
            }
        }));

        app.use(express.urlencoded());
        app.use(express.json());
        app.use(express.methodOverride());

        //routes should be at the last
        app.use(app.router);

        //Assume "not found" in the error msgs is a 404. this is somewhat silly, but valid, you can do whatever you like, set properties, use instanceof etc.
        app.use(function(err, req, res, next) {
            //Treat as 404
            if (~err.message.indexOf('not found')) return next();

            //Log it
            logger.error(err);
            
            res.status(500).json(err);
        });

        //Assume 404 since no middleware responded
        app.use(function(req, res, next) {
           res.status(404).json(new Error('Unauthorized'));
        });
    });
};
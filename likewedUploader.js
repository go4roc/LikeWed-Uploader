/**
 * Module dependencies.
 */
var express  = require('express'),
	log4js   = require('log4js'),
	config   = require('./config/config');

var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';

log4js.configure('./config/log4js.json',  {cwd: config.logger_dir});
log4js.setGlobalLogLevel(config.logger_level);

var app = express();

//express settings
require('./config/express')(app);

//Bootstrap routes
require('./config/routes')(app, config);

//Start the app by listening on <port>
app.listen(config.port);
console.log('Express app started on port ' + config.port);

//expose app
exports = module.exports = app;
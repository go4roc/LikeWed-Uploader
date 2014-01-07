var fs = require('fs'),
    path = require('path'),
    _ = require('lodash');

function _getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function _uid(len) {
    var buf = []
    , chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    , charlen = chars.length;

    for (var i = 0; i < len; ++i) {
        buf.push(chars[_getRandomInt(0, charlen - 1)]);
    }

    return buf.join('');
}

function _get_yyyy_path() {
    var date = new Date();

    return '/'+date.getFullYear();
}

function _get_yyyymm_path() {
    var date = new Date();

    var month = date.getMonth()+1;
    if (month < 10) month = '0'+month;
    return '/'+date.getFullYear()+'/'+month;
}

function _get_yyyymmdd_path() {
    var date = new Date();

    var month = date.getMonth()+1;
    if (month < 10) month = '0'+month;
    return '/'+date.getFullYear()+'/'+month+'/'+date.getDate();
}

module.exports = function (options) {

    var FileInfo = function (file) {
        this.name = _uid(16)+path.extname(file.name);
        console.debug('pathType:', options.pathType);
        switch(options.pathType) {
            case "YYYY":
                this.path = _get_yyyy_path();
                break;
            case "YYYY/MM":
                this.path = _get_yyyymm_path();
                break;
            case "YYYY/MM/DD":
                this.path = _get_yyyymmdd_path();
                break;
            default:
                this.path = "";
        }
        
        console.debug('path:', this.path);
        this.originalName = file.name;
        this.size = file.size;
        this.type = file.type;
    };

    FileInfo.prototype.validate = function () {
        if (options.minFileSize && options.minFileSize > this.size) {
            this.error = 'File is too small';
        } else if (options.maxFileSize && options.maxFileSize < this.size) {
            this.error = 'File is too big';
        } else if (!options.acceptFileTypes.test(this.name)) {
            this.error = 'Filetype not allowed';
        }
        return !this.error;
    };

    FileInfo.prototype.setUrl = function (type, baseUrl) {
        var key = type ? type + 'Url' : 'url';
        this[key] = baseUrl + '/' + encodeURIComponent(this.name);
    }

    return FileInfo;
};
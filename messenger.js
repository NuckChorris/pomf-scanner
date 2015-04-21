var EventEmitter = require('events').EventEmitter
  , util = require('util');

var Messenger = function (wot) {
	if (!wot) throw new Error('u wot m8');
	this._wot = wot;

	var _this = this;
	this._wot.on('message', function (msg) {
		_this.emit(msg.cmd, msg.payload);
	});
	EventEmitter.call(this);
};
util.inherits(Messenger, EventEmitter);

Messenger.prototype._wot = null;

Messenger.prototype.send = function (cmd, payload) {
	this._wot.send({ 'cmd': cmd, 'payload': payload });
};

module.exports = Messenger;

var cp = require('child_process')
  , fs = require('fs')
  , os = require('os')
  , path = require('path')
  , util = require('util');
var colors = require('colors');

/** Provides a wrapper around message passing */
var Messenger = require(__dirname + '/messenger.js');

/**
 * Logging stuff
 */
var Logger = (function () {
	var log = function log (label, msg, name, pid) {
		if (!name || !pid)
			var name = 'Master' , pid = process.pid;
		if (name == 'Master') name = name.green.bold;
		if (name == 'Worker') name = name.blue.bold;
		
		process.stderr.write([name,'[',pid,'] ',label,' ',msg].join('') + '\n');
	};
	return {
		'info': function (msg, name, pid) {
			log('-log-'.blue, msg, name, pid);
		},
		'err': function (msg, name, pid) {
			log('-err-'.red.bold, msg, name, pid);
		}
	};
})();


/**
 * Configuration loading and defaults
 */
var config = require(__dirname + '/config.json');

if (!config.workers) config.workers = os.cpus().length;
if (!config.dir) config.dir = '.';

config.dir = path.resolve(config.dir);


/**
 * Grab the list of files
 */
var files = fs.readdirSync(config.dir).map(function (file) {
	return path.resolve(config.dir, file);
});
var start = files.length;
Logger.info('Processing ' + files.length + ' files.');


/**
 * Worker prototype, because I'm a lazy cunt
 */
var Worker = function () {
	// Fork
	this._child = cp.fork(__dirname + '/worker.js');

	// Add ourselves to the array
	workers.push(this);

	// Call the superconstructor
	Messenger.call(this, this._child);
};
util.inherits(Worker, Messenger);

Worker.prototype._file = null;
Worker.prototype._child = null;

Worker.prototype.err = function (msg) {
	Logger.err(msg, 'Worker', this._child.pid);
};
Worker.prototype.die = function (msg, sig) {
	if (!sig) sig = 'SIGTERM';
	this.log('Stopping with ' + sig + ((msg) ? (' (' + msg + ')') : ''));
	var pid = this._child.pid;
	// kill the process
	this._child.kill(sig);
	// remove ourselves from the array
	workers = workers.filter(function (worker) {
		return (worker._child.pid != this._child.pid);
	}.bind(this));
};
Worker.prototype.log = function (msg) {
	Logger.info(msg, 'Worker', this._child.pid);
};

/**
 * Fork the workers
 */
Logger.info('Starting ' + config.workers + ' workers.');
var workers = [];

var addWorker = function () {
	var worker = new Worker();

	worker.on('done', function (data) {
		console.log([data.file, data.sha1].join());
	});
	worker.on('err', function (data) {
		this.err('Fatal error; replacing worker and requeueing file.');
		// Add the file to the end of the queue -- we assume it failed.
		files.push(this._file);
		// Die and respawn
		worker.die();
		addWorker();
	});
	worker.on('next', function (data) {
		var file = files.shift();
		if (!file) {
			// End the process
			worker.die();
			if (workers.length == 0) {
				process.exit();
			}
		} else {
			this._file = file;
			this.log('(' + (start - files.length) + '/' + start + ') ' + file);
			this.send('file', {
				'file': file
			});
		}
	});
};

// Spawn the initial workers
for (var i = 0; i < config.workers; i++) {
	addWorker();
}

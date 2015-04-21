var mysql = require('mysql')
  , fs = require('fs')
  , crypto = require('crypto')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , path = require('path');

var Messenger = require(__dirname + '/messenger.js');

/**
 * Master prototype, technically just a singleton
 */
var Master = function () {
	Messenger.call(this, process);
};
util.inherits(Master, Messenger);
var master = new Master();


/**
 * Catch all errors and notify the master process
 */
process.on('uncaughtException', function (err) {
	master.send('err', err);
});


/**
 * Database stuffs
 */
var db = mysql.createConnection({
  host: 'butts',
  user: 'butts',
  password: 'butts'
});

function createFile(name, sha, size, date) {
  db.query('SELECT COUNT(*) AS count FROM files WHERE name = ?', [name], function(err, res) {
	 if (res[0].count == 0) {
		db.query('INSERT INTO files (filename, hash, size, date) VALUES (?, ?, ?, ?)', [name, sha, size, date]);
	 }
  })
}

/**
 * Actual load carrying portion of this application
 */
master.on('file', function (data) {
	var stat = fs.lstatSync(data.file);
	if (!stat.isFile() || stat.isSymbolicLink()) return master.send('next');

	var birthtime = new Date(Math.min(stat.atime.getTime(), stat.mtime.getTime(),
	                                  stat.ctime.getTime(), stat.birthtime.getTime()));

	var file = fs.createReadStream(data.file);

	// Initialize streaming hashes
	var sha1 = crypto.createHash('sha1');

	// Read the data and cram it into our hashes
	file.on('data', function (chunk) {
		sha1.update(chunk);
	});

	// File's over, move onward
	file.on('end', function () {
		var sha1sum = sha1.digest('hex');

		createFile(data.file, sha1sum, stat.size, birthtime);

		master.send('done', {
			'file': data.file,
			'sha1': sha1sum
		});
		master.send('next');
	});
});


/**
 * What starts it running
 */
master.send('start'); // Announce that we're started
master.send('next');  // Request first assignment

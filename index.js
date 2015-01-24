var ImmutableHash = require('immutable-hash');
var through2 = require('through2');
var Promise = require('bluebird');
var fs = require('fs');

var lineReader = require('through2-linereader');
var lineWriter = require('through2-linewriter');
var JSONReader = require('through2-jsonreader');
var JSONWriter = require('through2-jsonwriter');

var readJournal = function(journalPath, callback){

  var hash = ImmutableHash();

  fs.createReadStream(journalPath, {encoding: 'utf8'})
    .on('error', function(err){
      callback(err, hash);
    })
    .pipe(lineReader(true))
    .pipe(JSONReader())
    .on('error', function(err){
      callback(err, hash);
    })
    .on('data', function(patch){
      hash = hash.patch(patch);
    })
    .on('end', function(){
      callback(null, hash);
    });
};

var JournaledHash = function(journalPath, callback){
  this.journalPath = journalPath;

  var self = this;

  readJournal(journalPath, function(err, hash){
    self.hash = hash;

    var hasData = !!Object.keys(hash.toJSON()).length;
    var newFile = (err || !hasData);

    var writeStream = fs.createWriteStream(self.journalPath, {
      flags: newFile ? 'w' : 'a',
      encoding: 'utf8'
    });

    if (!newFile) {
      //produces extra newlines in journal, which are ignored
      //handles edge case where a newline is missing from the end of the file
      //would happen if a write only made it half-way through
      writeStream.write('\n');
    }

    self.journalWriteStream = JSONWriter();
    self.journalWriteStream
      .pipe(lineWriter())
      .pipe(writeStream);

    if (newFile && hasData) {
      self.journalWriteStream.write(hash.toJSON(), function(){
        callback(self);
      });
    } else {
      callback(self);
    }
  });
};

var methods = ['patch', 'toJSON', 'get', 'has', 'map', 'filter', 'diff'];
methods.forEach(function(method){
  JournaledHash.prototype[method] = function(){
    return this.hash[method].apply(this.hash, arguments);
  };
});

JournaledHash.prototype.update = function(diff){
  var promise;

  if (Object.keys(diff).length) {
    this.hash = this.hash.patch(diff);

    var self = this;
    promise = new Promise(function(resolve){
      self.journalWriteStream.write(diff, resolve);
    });
  } else {
    promise = Promise.resolve();
  }

  return promise;
};

module.exports = function(journalPath, callback){
  return new Promise(function(resolve){
    new JournaledHash(journalPath, resolve);
  });
};
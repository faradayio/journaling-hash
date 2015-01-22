var ImmutableHash = require('immutable-hash');
var through2 = require('through2');
var Promise = require('bluebird');
var fs = require('fs');

var lineReader = function(){
  var buffer = '';
  return through2(function(chunk, enc, cb){
    buffer += chunk.toString();

    var lines = buffer.split('\n');
    buffer = lines.pop();

    var self = this;
    lines.forEach(function(line){
      self.push(line);
    });

    cb();
  }, function(cb){
    this.push(buffer);
    cb();
  });
};
var JSONReader = function(){
  return through2.obj(function(chunk, enc, cb){
    chunk = chunk.toString();
    var err = null;

    try {
      chunk = JSON.parse(chunk);
    } catch (error) {
      err = error;
      chunk = null;
    }

    cb(err, chunk);
  });
};

var readJournal = function(journalPath, callback){

  var hash = ImmutableHash();

  fs.createReadStream(journalPath, {encoding: 'utf8'})
    .on('error', function(err){
      callback(err, hash);
    })
    .pipe(lineReader())
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

    self.journalWriteStream = fs.createWriteStream(self.journalPath, {
      flags: newFile ? 'w' : 'a',
      encoding: 'utf8'
    });

    if (newFile && hasData) {
      self.journalWriteStream.write(JSON.stringify(hash.toJSON())+'\n', 'utf8', function(){
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
      self.journalWriteStream.write(JSON.stringify(diff)+'\n', 'utf8', resolve);
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
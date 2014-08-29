var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN
  , AbstractIterator  = require('abstract-leveldown').AbstractIterator
  , inherits          = require('util').inherits
  , xtend             = require('xtend')
  , EventEmitter      = require('events').EventEmitter
  , externr           = require('externr')


function fixOptions (options) {
  var x = {
      valueEncoding : options.asBuffer === false ? 'utf8' : 'binary'
  }

  if (options.keyEncoding != 'utf8' && options.valueEncoding != 'utf8')
    x.keyEncoding = 'binary'

  return xtend(options, x)
}


function LevelUPDOWNIterator (db, options) {
  if (!(this instanceof LevelUPDOWNIterator))
    return new LevelUPDOWNIterator(db, options)

  AbstractIterator.call(this, db)

  this.options = options
  this._externs = externr({ wrap: [ 'preNext', 'postNext', 'preEnd', 'postEnd' ] })
  this.extendWith = this._externs.$register.bind(this._externs)

  var self = this

  function start () {
    self._iterator = self.db.levelup.db.iterator(options)
  }

  if (db.levelup.isOpen())
    return start()

  this._deferred = new EventEmitter()

  db.levelup.once('ready', function () {
    start()
    setImmediate(function () {
      self._deferred.emit('ready')
      self._deferred = null
    })
  })
}

inherits(LevelUPDOWNIterator, AbstractIterator)


LevelUPDOWNIterator.prototype._next = function (callback) {
  var self = this

  function exec () {
    self._externs.preNext(self, [ callback ], afterPreNext)

    function afterPreNext (callback) {
      self._iterator.next(afterNext)

      function afterNext (err, key, value) {
        self._externs.postNext(self, [ err, key, value, callback ], afterPostNext)
      }

      function afterPostNext (err, key, value, callback) {
        if (!err && !key && !value)
          return callback()

        callback(err, key, value)
      }
    }
  }

  if (!this._deferred)
    return exec()

  this._deferred.on('ready', exec)
}


LevelUPDOWNIterator.prototype._end = function (callback) {
  var self = this

  function exec () {
    self._externs.preEnd(self, [ callback ], afterPreEnd)

    function afterPreEnd (callback) {
      self._iterator.end(afterEnd)

      function afterEnd (err) {
        self._externs.postEnd(self, [ err, callback ], afterPostEnd)
      }

      function afterPostEnd (err, callback) {
        callback(err)
      }
    }
  }

  if (!this._deferred)
    return exec()

  this._deferred.on('ready', exec)
}

function LevelUPDOWN (levelup) {
  if (!(this instanceof LevelUPDOWN))
    return new LevelUPDOWN(levelup)

  AbstractLevelDOWN.call(this, '')

  this.levelup = levelup

  this._externs = externr({
      wrap   : [
          'open'
        , 'close'
        , 'prePut'
        , 'postPut'
        , 'preGet'
        , 'postGet'
        , 'preDel'
        , 'postDel'
        , 'preBatch'
        , 'postBatch'
      ]
    , extend : [
          'preIterator'
        , 'postIterator'
      ]
  })

  this.extendWith = this._externs.$register.bind(this._externs)
}

inherits(LevelUPDOWN, AbstractLevelDOWN)


// noop
LevelUPDOWN.prototype._open = function (options, callback) {
  this._externs.open(this, [ options, callback ], afterOpen)

  function afterOpen (options, callback) {
    process.nextTick(callback)
  }
}


// noop
LevelUPDOWN.prototype._close = function (callback) {
  this._externs.close(this, [ callback ], afterClose)

  function afterClose (callback) {
    process.nextTick(callback)
  }
}

LevelUPDOWN.prototype._put = function (key, value, options, callback) {
  var self = this

  this._externs.prePut(this, [ key, value, options, callback ], afterPrePut)

  function afterPrePut (key, value, options, callback) {
    self.levelup.put(key, value, options, afterPut)

    function afterPut (err) {
      self._externs.postPut(self, [ key, value, options, err, callback ], afterPostPut)
    }

    function afterPostPut (key, value, options, err, callback) {
      callback(err)
    }
  }
}


LevelUPDOWN.prototype._get = function (key, options, callback) {
  var self = this

  this._externs.preGet(this, [ key, options, callback ], afterPreGet)

  function afterPreGet (key, options, callback) {
    self.levelup.get(key, fixOptions(options), afterGet)

    function afterGet (err, value) {
      self._externs.postGet(self, [ key, options, err, value, callback ], afterPostGet)
    }

    function afterPostGet (key, options, err, value, callback) {
      callback(err, value)
    }
  }
}


LevelUPDOWN.prototype._del = function (key, options, callback) {
  var self = this

  this._externs.preDel(this, [ key, options, callback ], afterPreDel)

  function afterPreDel (key, options, callback) {
    self.levelup.del(key, options, afterDel)

    function afterDel (err) {
      self._externs.postDel(self, [ key, options, err, callback ], afterPostDel)
    }

    function afterPostDel (key, options, err, callback) {
      callback(err)
    }
  }
}


LevelUPDOWN.prototype._batch = function (array, options, callback) {
  var self = this

  this._externs.preBatch(this, [ array, options, callback ], afterPreBatch)

  function afterPreBatch (array, options, callback) {
    self.levelup.batch(array, options, afterBatch)

    function afterBatch (err) {
      self._externs.postBatch(self, [ array, options, err, callback ], afterPostBatch)
    }

    function afterPostBatch (array, options, err, callback) {
      callback(err)
    }
  }
}


LevelUPDOWN.prototype._iterator = function (options) {
  var self = this

  function iteratorFactory (options) {
    var iterator = new LevelUPDOWNIterator(self, fixOptions(options))
    return self._externs.postIterator(iterator)
  }

  var pre = self._externs.preIterator({
      options : options
    , factory : iteratorFactory
  })

  return pre.factory(pre.options)
}


LevelUPDOWN.prototype._isBuffer = function (obj) {
  return Buffer.isBuffer(obj)
}


module.exports                     = LevelUPDOWN
module.exports.LevelUPDOWNIterator = LevelUPDOWNIterator
module.exports.factory             = function factory () {
  var args = Array.prototype.slice.call(arguments)
  return function makeLevelUPDOWN () {
    return LevelUPDOWN.apply(null, args)
  }
}

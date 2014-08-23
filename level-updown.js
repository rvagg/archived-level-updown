var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN
  , AbstractIterator  = require('abstract-leveldown').AbstractIterator
  , inherits          = require('util').inherits
  , xtend             = require('xtend')
  , EventEmitter      = require('events').EventEmitter
  , externr           = require('externr')


function fixOptions (options) {
  return xtend(options, {
      keyEncoding   : 'binary'
    , valueEncoding : options.asBuffer === false ? 'utf8' : 'binary'
  })
}


function LevelUPDOWNIterator (db, options) {
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
    self._externs.preNext(self, [ callback ], function (callback) {
      self._iterator.next(function (err, key, value) {
        self._externs.postNext(
            self
          , [ err, key, value, callback ]
          , function (err, key, value, callback) {
              if (!err && !key && !value)
                return callback()
              callback(err, key, value)
            }
        )
      })
    })
  }

  if (!this._deferred)
    return exec()

  this._deferred.on('ready', exec)
}


LevelUPDOWNIterator.prototype._end = function (callback) {
  var self = this

  function exec () {
    self._externs.preEnd(self, [ callback ], function (callback) {
      self._iterator.end(function (err) {
        self._externs.postEnd(
            self
          , [ err, callback ]
          , function (err, callback) {
              callback(err)
            }
        )
      })
    })
  }

  if (!this._deferred)
    return exec()

  this._deferred.on('ready', exec)
}

function LevelUPDOWN (levelup, options) {
  if (!(this instanceof LevelUPDOWN))
    return new LevelUPDOWN(levelup, options)

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
          'iterator'
      ]
  })

  this.extendWith = this._externs.$register.bind(this._externs)
}

inherits(LevelUPDOWN, AbstractLevelDOWN)


// noop
LevelUPDOWN.prototype._open = function (options, callback) {
  this._externs.open(this, [ options, callback ], function (options, callback) {
    process.nextTick(callback)
  })
}


// noop
LevelUPDOWN.prototype._close = function (callback) {
  this._externs.close(this, [ callback ], function (callback) {
    process.nextTick(callback)
  })
}

LevelUPDOWN.prototype._put = function (key, value, options, callback) {
  var self = this

  this._externs.prePut(this, [ key, value, options, callback ], function (key, value, options, callback) {
    return self.levelup.put(key, value, fixOptions(options), function (err) {
      self._externs.postPut(
          self
        , [ key, value, options, err, callback ]
        , function (key, value, options, err, callback) {
            callback(err)
          }
      )
    })
  })
}


LevelUPDOWN.prototype._get = function (key, options, callback) {
  var self = this

  this._externs.preGet(this, [ key, options, callback ], function (key, options, callback) {
    return self.levelup.get(key, fixOptions(options), function (err, value) {
      self._externs.postGet(
          self
        , [ key, options, err, value, callback ]
        , function (key, options, err, value, callback) {
            callback(err, value)
          }
      )
    })
  })
}


LevelUPDOWN.prototype._del = function (key, options, callback) {
  var self = this

  this._externs.preDel(this, [ key, options, callback ], function (key, options, callback) {
    return self.levelup.del(key, fixOptions(options), function (err) {
      self._externs.postDel(
          self
        , [ key, options, err, callback ]
        , function (key, options, err, callback) {
            callback(err)
          }
      )
    })
  })
}


LevelUPDOWN.prototype._batch = function (array, options, callback) {
  var self = this

  this._externs.preBatch(this, [ array, options, callback ], function (array, options, callback) {
    return self.levelup.batch(array, fixOptions(options), function (err) {
      self._externs.postBatch(
          self
        , [ array, options, err, callback ]
        , function (array, options, err, callback) {
            callback(err)
          }
      )
    })
  })
}


LevelUPDOWN.prototype._iterator = function (options) {
  return this._externs.iterator(new LevelUPDOWNIterator(this, fixOptions(options)))
}


LevelUPDOWN.prototype._isBuffer = function (obj) {
  return Buffer.isBuffer(obj)
}


module.exports                     = LevelUPDOWN
module.exports.LevelUPDOWNIterator = LevelUPDOWNIterator
module.exports.factory             = function () {
  var args = Array.prototype.slice.call(arguments)
  return function () {
    return LevelUPDOWN.apply(null, args)
  }
}
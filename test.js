var test       = require('tape')
  , rimraf     = require('rimraf')
  , xtend      = require('xtend')
  , levelup    = require('levelup')
  , testCommon = require('abstract-leveldown/testCommon')
  , testBuffer = require('crypto').randomBytes(256)
  , updown     = require('./')

  , testdb     = '__test.db'
  , opendb     = null


function cleanup () {
  rimraf.sync(testdb)
}

function updownWrapper () {
  opendb = levelup(testdb)
  return updown(opendb)
}


function closingUpdownWrapper () {
  opendb = levelup(testdb)
  var ud = updown(opendb)
  ud.open = function (callback) {
    opendb.open(callback)
  }
  ud.close = function (callback) {
    opendb.close(function (err) {
      cleanup()
      callback(err)
    })
  }
  return ud
}

testCommon._tearDown = testCommon.tearDown
testCommon.tearDown = function () {
  var args = Array.prototype.slice.call(arguments)
  opendb.close(function () {
    opendb = null
    cleanup()
    testCommon._tearDown.apply(null, args)
  })
}


// 3 layers of abstraction, test we can set and get values on both ends
test('test basic pass-through', function (t) {
  t.on('end', cleanup)
  t.plan(12)

  var db  = levelup(testdb)
    , db2 = levelup({ db: updown.factory(db) })
    , db3 = levelup({ db: updown.factory(db2) })

  db.put('foo1', 'bar1', function (err) {
    t.ifError(err, 'no error')

    db3.put('foo2', 'bar2', function (err) {
      t.ifError(err, 'no error')

      db2.get('foo1', function (err, value) {
        t.ifError(err, 'no error')
        t.equal(value, 'bar1', 'got expected value')
  
        db.get('foo2', function (err, value) {
          t.ifError(err, 'no error')
          t.equal(value, 'bar2', 'got expected value')
    
          db2.get('foo2', function (err, value) {
             t.ifError(err, 'no error')
             t.equal(value, 'bar2', 'got expected value')

            db3.get('foo1', function (err, value) {
              t.ifError(err, 'no error')
              t.equal(value, 'bar1', 'got expected value')

              db3.get('foo2', function (err, value) {
                t.ifError(err, 'no error')
                t.equal(value, 'bar2', 'got expected value')

                db.close(t.end())
              })
            })
          })
        })
      })
    })
  })
})

require('abstract-leveldown/abstract/del-test').all(updownWrapper, test, testCommon)

require('abstract-leveldown/abstract/get-test').all(updownWrapper, test, testCommon)

require('abstract-leveldown/abstract/put-test').all(updownWrapper, test, testCommon)

require('abstract-leveldown/abstract/put-get-del-test').all(updownWrapper, test, testCommon, testBuffer)

require('abstract-leveldown/abstract/batch-test').all(updownWrapper, test, testCommon)
require('abstract-leveldown/abstract/chained-batch-test').all(updownWrapper, test, testCommon)

require('abstract-leveldown/abstract/iterator-test').all(closingUpdownWrapper, test, testCommon)

require('abstract-leveldown/abstract/ranges-test').all(closingUpdownWrapper, test, testCommon)

test('test open() wrap', function (t) {
  var db = levelup(testdb)
    , ud = updown(db)
    , openCalledWith
    , extendedOpenCalledWith
    , options = { options: 1 }

  db._open = db.open

  db.open = function (options, callback) {
    openCalledWith = Array.prototype.slice.call(arguments)
    callback()
  }

  ud.extendWith({
      open: function (options, callback, next) {
        extendedOpenCalledWith = Array.prototype.slice.call(arguments)
        next(options, callback)
      }
  })

  ud.open(xtend(options), afterOpen)

  function afterOpen (err) {
    t.ifError(err, 'no error')

    t.ok(extendedOpenCalledWith, 'open() called')
    t.deepEqual(extendedOpenCalledWith[0], options, 'open() called with options')
    t.same(extendedOpenCalledWith[1], afterOpen, 'open() called with callback')

    t.notOk(openCalledWith, 'open() not called') // noop in updown

    db.close(function (err) {
      t.ifError(err, 'no error')
      cleanup()
      t.end()
    })
  }
})


test('test close() wrap', function (t) {
  var db = levelup(testdb)
    , ud = updown(db)
    , closeCalledWith
    , extendedCloseCalledWith

  db.on('ready', function () {
    db._close = db.close

    db.close = function (callback) {
      closeCalledWith = Array.prototype.slice.call(arguments)
      callback()
    }

    ud.extendWith({
        close: function (callback, next) {
          extendedCloseCalledWith = Array.prototype.slice.call(arguments)
          next(callback)
        }
    })

    ud.close(afterClose)

    function afterClose (err) {
      t.ifError(err, 'no error')

      t.ok(extendedCloseCalledWith, 'close() called')
      t.same(extendedCloseCalledWith[0], afterClose, 'close() called with callback')

      t.notOk(closeCalledWith, 'close() not called') // noop in updown

      db._close(function (err) {
        t.ifError(err, 'no error')
        cleanup()
        t.end()
      })
    }
  })
})


test('test put() wraps', function (t) {
  var db = levelup(testdb)
    , ud = updown(db)
    , putCalledWith
    , prePutCalledWith
    , postPutCalledWith

  db._put = db.put

  db.put = function (key, value, options, callback) {
    putCalledWith = Array.prototype.slice.call(arguments)
    callback(null)
  }

  ud.extendWith({
      prePut: function (key, value, options, callback, next) {
        prePutCalledWith = Array.prototype.slice.call(arguments)
        next('preputkey', 'preputvalue', { preput: 1 }, callback)
      }

    , postPut: function (key, value, options, err, callback, next) {
        postPutCalledWith = Array.prototype.slice.call(arguments)
        next('postputkey', 'postputvalue', { postput: 1 }, err, callback)
      }
  })

  ud.put('putkey', 'putvalue', { put: 1 }, afterPut)

  function afterPut (err) {
    t.ifError(err, 'no error')

    t.ok(prePutCalledWith, 'put() called')
    t.equal(prePutCalledWith[0], 'putkey', 'prePut() called with correct key')
    t.equal(prePutCalledWith[1], 'putvalue', 'prePut() called with correct value')
    t.deepEqual(prePutCalledWith[2], { put: 1 }, 'prePut() called with correct value')
    t.same(prePutCalledWith[3], afterPut, 'prePut() called with callback')

    t.ok(putCalledWith, 'put() called')
    t.equal(putCalledWith[0], 'preputkey', 'put() called with correct key')
    t.equal(putCalledWith[1], 'preputvalue', 'put() called with correct value')
    t.deepEqual(
        putCalledWith[2]
      , { preput: 1 }
      , 'put() called with correct value'
    )

    t.ok(postPutCalledWith, 'postPut() called')
    t.equal(postPutCalledWith[0], 'preputkey', 'postPut() called with correct key')
    t.equal(postPutCalledWith[1], 'preputvalue', 'postPut() called with correct value')
    t.deepEqual(postPutCalledWith[2], { preput: 1 }, 'put() called with correct value')
    t.same(postPutCalledWith[3], null, 'postPut() called with null error')
    t.same(postPutCalledWith[4], afterPut, 'postPut() called with callback')

    db.close(function (err) {
      t.ifError(err, 'no error')
      cleanup()
      t.end()
    })
  }
})


test('test get() wraps', function (t) {
  var db = levelup(testdb)
    , ud = updown(db)
    , getCalledWith
    , preGetCalledWith
    , postGetCalledWith

  db._get = db.get

  db.get = function (key, options, callback) {
    getCalledWith = Array.prototype.slice.call(arguments)
    callback(null, 'bar')
  }

  ud.extendWith({
      preGet: function (key, options, callback, next) {
        preGetCalledWith = Array.prototype.slice.call(arguments)
        next('pregetkey', { preget: 1 }, callback)
      }

    , postGet: function (key, options, err, value, callback, next) {
        postGetCalledWith = Array.prototype.slice.call(arguments)
        next('postgetkey', { postget: 1 }, err, 'postgetvalue', callback)
      }
  })

  ud.get('foo', { get: 1 }, afterGet)

  function afterGet (err, value) {
    t.ifError(err, 'no error')

    t.ok(preGetCalledWith, 'get() called')
    t.equal(preGetCalledWith[0], 'foo', 'preGet() called with correct key')
    t.deepEqual(preGetCalledWith[1], { get: 1 }, 'preGet() called with correct value')
    t.same(preGetCalledWith[2], afterGet, 'preGet() called with callback')

    t.ok(getCalledWith, 'get() called')
    t.equal(getCalledWith[0], 'pregetkey', 'get() called with correct key')
    t.deepEqual(
        getCalledWith[1]
      , { preget: 1, keyEncoding: 'binary', valueEncoding: 'binary' }
      , 'get() called with correct value'
    )

    t.ok(postGetCalledWith, 'postGet() called')
    t.equal(postGetCalledWith[0], 'pregetkey', 'postGet() called with correct key')
    t.deepEqual(postGetCalledWith[1], { preget: 1 }, 'get() called with correct value')
    t.same(postGetCalledWith[2], null, 'postGet() called with null error')
    t.equal(postGetCalledWith[3], 'bar', 'postGet() called with correct value')
    t.same(postGetCalledWith[4], afterGet, 'postGet() called with callback')

    t.equal(value, 'postgetvalue', 'get() callback got postGet value')

    db.close(function (err) {
      t.ifError(err, 'no error')
      cleanup()
      t.end()
    })
  }
})


test('test del() wraps', function (t) {
  var db = levelup(testdb)
    , ud = updown(db)
    , delCalledWith
    , preDelCalledWith
    , postDelCalledWith

  db._del = db.del

  db.del = function (key, options, callback) {
    delCalledWith = Array.prototype.slice.call(arguments)
    callback(null)
  }

  ud.extendWith({
      preDel: function (key, options, callback, next) {
        preDelCalledWith = Array.prototype.slice.call(arguments)
        next('predelkey', { predel: 1 }, callback)
      }

    , postDel: function (key, options, err, callback, next) {
        postDelCalledWith = Array.prototype.slice.call(arguments)
        next('postdelkey', { postdel: 1 }, err, callback)
      }
  })

  ud.del('foo', { del: 1 }, afterDel)

  function afterDel (err) {
    t.ifError(err, 'no error')

    t.ok(preDelCalledWith, 'del() called')
    t.equal(preDelCalledWith[0], 'foo', 'preDel() called with correct key')
    t.deepEqual(preDelCalledWith[1], { del: 1 }, 'preDel() called with correct value')
    t.same(preDelCalledWith[2], afterDel, 'preDel() called with callback')

    t.ok(delCalledWith, 'del() called')
    t.equal(delCalledWith[0], 'predelkey', 'del() called with correct key')
    t.deepEqual(
        delCalledWith[1]
      , { predel: 1 }
      , 'del() called with correct value'
    )

    t.ok(postDelCalledWith, 'postDel() called')
    t.equal(postDelCalledWith[0], 'predelkey', 'postDel() called with correct key')
    t.deepEqual(postDelCalledWith[1], { predel: 1 }, 'del() called with correct value')
    t.same(postDelCalledWith[2], null, 'postDel() called with null error')
    t.same(postDelCalledWith[3], afterDel, 'postDel() called with callback')

    db.close(function (err) {
      t.ifError(err, 'no error')
      cleanup()
      t.end()
    })
  }
})


test('test batch() wraps', function (t) {
  var db = levelup(testdb)
    , ud = updown(db)
    , batchCalledWith
    , preBatchCalledWith
    , postBatchCalledWith


  function mktestBatch (k, v) {
    return [
        { type: 'put', key: k, value: v }
      , { type: 'put', key: k + '2', value: v + '2' }
      , { type: 'del', key: k + '3' }
    ]
  }

  db._batch = db.batch

  db.batch = function (array, options, callback) {
    batchCalledWith = Array.prototype.slice.call(arguments)
    callback(null)
  }

  ud.extendWith({
      preBatch: function (array, options, callback, next) {
        preBatchCalledWith = Array.prototype.slice.call(arguments)
        next(mktestBatch('prebatchkey', 'prebatchvalue'), { prebatch: 1 }, callback)
      }

    , postBatch: function (array, options, err, callback, next) {
        postBatchCalledWith = Array.prototype.slice.call(arguments)
        next(mktestBatch('postbatchkey', 'postbatchvalue'), { postbatch: 1 }, err, callback)
      }
  })

  ud.batch(mktestBatch('batchkey', 'batchvalue'), { batch: 1 }, afterBatch)

  function afterBatch (err) {
    t.ifError(err, 'no error')

    t.ok(preBatchCalledWith, 'batch() called')
    t.deepEqual(preBatchCalledWith[0], mktestBatch('batchkey', 'batchvalue'), 'preBatch() called with correct array')
    t.deepEqual(preBatchCalledWith[1], { batch: 1 }, 'preBatch() called with correct array')
    t.same(preBatchCalledWith[2], afterBatch, 'preBatch() called with callback')

    t.ok(batchCalledWith, 'batch() called')
    t.deepEqual(batchCalledWith[0], mktestBatch('prebatchkey', 'prebatchvalue'), 'batch() called with correct array')
    t.deepEqual(
        batchCalledWith[1]
      , { prebatch: 1 }
      , 'batch() called with correct array'
    )

    t.ok(postBatchCalledWith, 'postBatch() called')
    t.deepEqual(
        postBatchCalledWith[0]
      , mktestBatch('prebatchkey', 'prebatchvalue')
      , 'postBatch() called with correct array'
    )
    t.deepEqual(postBatchCalledWith[1], { prebatch: 1 }, 'batch() called with correct array')
    t.same(postBatchCalledWith[2], null, 'postBatch() called with null error')
    t.same(postBatchCalledWith[3], afterBatch, 'postBatch() called with callback')

    db.close(function (err) {
      t.ifError(err, 'no error')
      cleanup()
      t.end()
    })
  }
})


test('test chained batch() wraps', function (t) {
  var db = levelup(testdb)
    , ud = updown(db)
    , batchCalledWith
    , preBatchCalledWith
    , postBatchCalledWith


  function mktestBatch (k, v) {
    return [
        { type: 'put', key: k, value: v }
      , { type: 'put', key: k + '2', value: v + '2' }
      , { type: 'del', key: k + '3' }
    ]
  }

  db._batch = db.batch

  db.batch = function (array, options, callback) {
    batchCalledWith = Array.prototype.slice.call(arguments)
    callback(null)
  }

  ud.extendWith({
      preBatch: function (array, options, callback, next) {
        preBatchCalledWith = Array.prototype.slice.call(arguments)
        next(mktestBatch('prebatchkey', 'prebatchvalue'), { prebatch: 1 }, callback)
      }

    , postBatch: function (array, options, err, callback, next) {
        postBatchCalledWith = Array.prototype.slice.call(arguments)
        next(mktestBatch('postbatchkey', 'postbatchvalue'), { postbatch: 1 }, err, callback)
      }
  })

  ud.batch()
    .put('batchkey', 'batchvalue')
    .put('batchkey2', 'batchvalue2')
    .del('batchkey3')
    .write({ batch: 1 }, afterBatch)

  function afterBatch (err) {
    t.ifError(err, 'no error')

    t.ok(preBatchCalledWith, 'batch() called')
    t.deepEqual(preBatchCalledWith[0], mktestBatch('batchkey', 'batchvalue'), 'preBatch() called with correct array')
    t.deepEqual(preBatchCalledWith[1], { batch: 1 }, 'preBatch() called with correct array')
    t.same(preBatchCalledWith[2], afterBatch, 'preBatch() called with callback')

    t.ok(batchCalledWith, 'batch() called')
    t.deepEqual(batchCalledWith[0], mktestBatch('prebatchkey', 'prebatchvalue'), 'batch() called with correct array')
    t.deepEqual(
        batchCalledWith[1]
      , { prebatch: 1 }
      , 'batch() called with correct array'
    )

    t.ok(postBatchCalledWith, 'postBatch() called')
    t.deepEqual(
        postBatchCalledWith[0]
      , mktestBatch('prebatchkey', 'prebatchvalue')
      , 'postBatch() called with correct array'
    )
    t.deepEqual(postBatchCalledWith[1], { prebatch: 1 }, 'batch() called with correct array')
    t.same(postBatchCalledWith[2], null, 'postBatch() called with null error')
    t.same(postBatchCalledWith[3], afterBatch, 'postBatch() called with callback')

    db.close(function (err) {
      t.ifError(err, 'no error')
      cleanup()
      t.end()
    })
  }
})


test('test iterator() extends', function (t) {
  var db = levelup(testdb)
    , ud = updown(db)
    , iteratorCalledWith

  ud.extendWith({
      postIterator: function () {
        iteratorCalledWith = Array.prototype.slice.call(arguments)
        return { extendedIterator: 1 }
      }
  })

  var ret = ud.iterator({ options: 1 })

  t.ok(iteratorCalledWith, 'iterator wrap called')
  t.deepEqual(ret, { extendedIterator: 1 }, 'returned expected object')
  t.ok(iteratorCalledWith[0] instanceof updown.LevelUPDOWNIterator, 'got expected arguemnt')
  t.deepEqual(
      { options: 1, fillCache: false, keyAsBuffer: true, keys: true, limit: -1, reverse: false, valueAsBuffer: true, values: true, keyEncoding: 'binary', valueEncoding: 'binary' }
    , iteratorCalledWith[0].options
    , 'iterator had expected options'
  )

  db.once('ready', function () {
    setImmediate(function () {
      db.close(function (err) {
        t.ifError(err, 'no error')
        cleanup()
        t.end()
      })
    })
  })
})


test('test iterator#next wraps', function (t) {
  var db = levelup(testdb)
    , ud = updown(db)
    , nextCalledWith
    , preNextCalledWith
    , postNextCalledWith

  // we have to extend iterators once they are created, so we do
  // that by wrapping the iterator() call of updown and doing the
  // extension within that for each new iterator
  ud.extendWith({
      postIterator: function (iterator) {
        db.once('ready', function () {
          iterator._iterator.next = function (callback) {
            nextCalledWith = Array.prototype.slice.call(arguments)
            callback(null, 'nextkey', 'nextvalue')
          }
        })

        iterator.extendWith({
            preNext: function (callback, next) {
              preNextCalledWith = Array.prototype.slice.call(arguments)
              next(callback)
            }
          , postNext: function (err, key, value, callback, next) {
              postNextCalledWith = Array.prototype.slice.call(arguments)
              next(err, 'postnextkey', 'postnextvalue', callback)
            }
        })

        return iterator
      }
  })

  ud.iterator().next(afterNext)

  function afterNext (err, key, value) {
    t.ok(preNextCalledWith, 'preNext() called')
    t.equal(typeof preNextCalledWith[0], 'function', 'preNext() called with callback')

    t.ok(nextCalledWith, 'next() called')
    t.equal(typeof nextCalledWith[0], 'function', 'next() called with callback')

    t.ok(postNextCalledWith, 'postNext() called')
    t.same(postNextCalledWith[0], null, 'postNext() called with null err')
    t.equal(postNextCalledWith[1], 'nextkey', 'postNext() called with correct key')
    t.equal(postNextCalledWith[2], 'nextvalue', 'postNext() called with correct value')
    t.equal(typeof postNextCalledWith[3], 'function', 'postNext() called with callback')

    t.notOk(err, 'iterator() returned null error')
    t.equal(key, 'postnextkey', 'iterator() returned correct key')
    t.equal(value, 'postnextvalue', 'iterator() returned correct value')

    db.close(function (err) {
      t.ifError(err, 'no error')
      cleanup()
      t.end()
    })
  }
})


test('test iterator#end wraps', function (t) {
  var db = levelup(testdb)
    , ud = updown(db)
    , endCalledWith
    , preEndCalledWith
    , postEndCalledWith

  // we have to extend iterators once they are created, so we do
  // that by wrapping the iterator() call of updown and doing the
  // extension within that for each new iterator
  ud.extendWith({
      postIterator: function (iterator) {
        db.once('ready', function () {
          iterator._iterator.end = function (callback) {
            endCalledWith = Array.prototype.slice.call(arguments)
            callback(null, 'endkey', 'endvalue')
          }
        })

        iterator.extendWith({
            preEnd: function (callback, next) {
              preEndCalledWith = Array.prototype.slice.call(arguments)
              next(callback)
            }
          , postEnd: function (err, callback, next) {
              postEndCalledWith = Array.prototype.slice.call(arguments)
              next(err, callback)
            }
        })

        return iterator
      }
  })

  ud.iterator().end(afterEnd)

  function afterEnd (err) {
    t.ok(preEndCalledWith, 'preEnd() called')
    t.equal(typeof preEndCalledWith[0], 'function', 'preEnd() called with callback')

    t.ok(endCalledWith, 'end() called')
    t.equal(typeof endCalledWith[0], 'function', 'end() called with callback')

    t.ok(postEndCalledWith, 'postEnd() called')
    t.same(postEndCalledWith[0], null, 'postEnd() called with null err')
    t.equal(typeof postEndCalledWith[1], 'function', 'postEnd() called with callback')

    t.notOk(err, 'iterator() returned null error')

    db.close(function (err) {
      t.ifError(err, 'no error')
      cleanup()
      t.end()
    })
  }
})

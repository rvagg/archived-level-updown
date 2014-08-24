var levelup = require('levelup')
  , updown  = require('../')

module.exports = function uppercase (db) {
  return levelup({ db: function () {
    var ud = updown(db)

    ud.extendWith({
        prePut   : prePut
      , preBatch : preBatch
    })

    return ud
  }})
}

function prePut (key, value, options, callback, next) {
  next(key, value.toString().toUpperCase(), options, callback)
}

function preBatch (array, options, callback, next) {
  for (var i = 0; i < array.length; i++) {
    if (array[i].type == 'put')
      array[i].value = array[i].value.toString().toUpperCase()
  }

  next(array, options, callback)
}

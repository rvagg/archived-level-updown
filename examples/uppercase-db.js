var levelup   = require('levelup')
  , uppercase = require('./level-uppercase')

var db   = levelup('uc.db')
  , ucdb = uppercase(db)

// one database, two complete LevelUP "views" to it

db.put('db foo', 'db bar')
ucdb.put('ucdb foo', 'ucdb bar')

// check the contents

db.createReadStream().on('data', console.log)
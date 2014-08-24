# level-updown

**A LevelDOWN backed by LevelUP so LevelUP can use LevelUP through LevelDOWN**

**Simple and highly extensible to support creative database hackery**

[![NPM](https://nodei.co/npm/level-updown.png?downloads=true&downloadRank=true)](https://nodei.co/npm/level-updown/)
[![NPM](https://nodei.co/npm-dl/level-updown.png?months=6&height=3)](https://nodei.co/npm/level-updown/)

## Why?

**[LevelDOWN](https://github.com/rvagg/node-leveldown/)** is a "backend" for **[LevelUP](https://github.com/rvagg/node-levelup)** supporting LevelDB. It's also a well-defined API through **[AbstractLevelDOWN](https://github.com/rvagg/node-abstract-leveldown)** which can be implemented by many storage systems that allow for the basic primitives required by LevelUP.

LevelUP is a storage system that supports all of those primitives so implementing a LevelDOWN that is backed by LevelUP is fairly simple. Why? Because LevelDOWN is a simpler and cleaner API and being able to use it as an extensibility point opens up some creative possibilities that are otherwise difficult when trying to extend LevelUP directly.

Because **level-updown** builds on AbstractLevelDOWN, it already has checks and fixes for predictable argument types so you need to do significantly less argument checking than if you were extending LevelUP. This includes the assumption that entries passing through are only going to be `String` or `Buffer` objects.

**level-updown** uses **[externr](https://github.com/rvagg/externr)** to expose a large number of potential extension points. Each point can be extended by injecting a wrapper function that can either inspect or adjust the call flow and the arguments that move around. What's more, many different types of extensions can operate on the same instance of **level-updown** at the same time by simply plugging in their extension functions to the chain. Alternatively, you can layer **level-updown** by passing an instance of it to LevelUP and passing that new LevelUP into a new instance of **level-updown** and so on! The possibilities for crazy people are endless.

**LevelCEPTION:**

```text
------------------------------------------------
| LevelDOWN / level.js / MemDOWN / LMDB / etc. |
------------------------------------------------
                       |
                  -----------
                  | LevelUP |
                  -----------
                       |
                ----------------  -------------
                | level-updown |--| extension |
                ----------------  -------------
                       |
                  -----------
                  | LevelUP |
                  -----------
                       |
 -------------  ----------------  -------------
 | extension |--| level-updown |--| extension |
 -------------  ----------------  -------------
                       |
                  -----------
                  | LevelUP |
                  -----------
```

## Examples

Let's make a **level-uppercase** that upper-cases all values put into the database.

We only need to intercept the `put()` and `batch()` calls to make this work.

```js
var levelup = require('levelup')
  , updown  = require('level-updown')

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
```

Now use it:

```js
var levelup   = require('levelup')
  , uppercase = require('./level-uppercase')

var db   = levelup('uc.db')
  , ucdb = uppercase(db)

// one database, two complete LevelUP "views" to it

db.put('db foo', 'db bar')
ucdb.put('ucdb foo', 'ucdb bar')

// check the contents

db.createReadStream().on('data', console.log)
```

Gives:

```text
{ key: 'db foo', value: 'db bar' }
{ key: 'ucdb foo', value: 'UCDB BAR' }
```

No monkey patching!

## API

### LevelUPDOWN(levelup)

The object exposed on `exports` is `LevelUPDOWN` which can be instantiated with `new` or just by calling it. It requires a `levelup` argument that is a proper (or fully compatible) `LevelUP` object. In return you get a fully API compliant `LevelDOWN` instance backed by your `LevelUP`.

Extensible using externr, see below.

### LevelUPDOWNIterator(updown, [, options])

Exposed on `exports` as `LevelUPDOWNIterator` in case you need direct access to the prototype. Normally instantiated by a call to `db.iterator()` and is a fully compliant `LevelDOWN` iterator.

Extensible using externr, see below.

### factory()

Exposed on `exports` as `factory`, a simple utility function if you need something to pass to a new `LevelUP` constructor as the `'db'` property. However, when extending **level-updown** you would normally create your own factory functions or just instantiate new `LevelUP` instances yourself.

### LevelUPDOWN#extendWith(extensionMap)

The `extendWith()` method on each **level-updown** instance is the **externr** extension injection mechanism. You must pass an `Object` to it where the properties are the keys of the extension points you wish to use. The extensions take the form of functions with a specific list of arguments for each extension point.

### LevelUPDOWN extension points

Each of the extension points below can be passed in to `LevelUPDOWN#extendWith()` as a property by that name where the value is a function whose signature matches the ones presented below. Each extension function below is presented as a *noop* version that you can use as a starting-point for creating extensions.preIterator

You can modify and replace any of the arguments before calling the `next()` function in the asynchronous extension points, you can even opt to not call `next()` or perhaps call `callback` directly (the callback function supplied originally to LevelUPDOWN). Common operations would include modifying or replacing `key`s, `value`s and `options` before continuing on with the call chain via `next()`. You **must** pass the correct number and type of arguments to `next()` for the asynchronous extension functions.

The last two extension functions below, `'preIterator'` and `'postIterator'` are synchronous functions, and therefore have a single argument. You **must** return an argument to match, either a modified version of the original or a new one in its place.

#### `'open'`

The `open()` method in **level-updown** is a `process.nextTick()` noop by default. This extension function is executed prior to executing the internal noop.

**Noop form:**

```js
function open (options, callback, next) {
  next(options, callback)
}
```

#### `'close'`

The `close()` method in **level-updown** is a `process.nextTick()` noop by default. This extension function is executed prior to executing the internal noop.

**Noop form:**

```js
function close (callback, next) {
  next(callback)
}
```

#### `'prePut'`

This extension function is called as the first step in the `put()` method.

**Noop form:**

```js
function prePut (key, value, options, callback, next) {
  next(key, value, options, callback)
}
```

#### `'postPut'`

This extension function is called *after* the internal LevelUP `put()` has been executed and we have a possible `err` object. It is called just prior to calling the user-supplied `callback()` with the `err` argument.

**Noop form:**

```js
function postPut (key, value, options, err, callback, next) {
  next(key, value, options, err, callback)
}
```

#### `'preGet'`

This extension function is called as the first step in the `get()` method.

**Noop form:**

```js
function preGet (key, options, callback, next) {
  next(key, options, callback)
}
```

#### `'postGet'`

This extension function is called *after* the internal LevelUP `get()` has been executed and we have a possible `err` object or a `value`. It is called just prior to calling the user-supplied `callback()` with the `err` and `value` arguments.

**Noop form:**

```js
function postGet (key, options, err, value, callback, next) {
  next(key, options, err, value, callback)
}
```

#### `'preDel'`

This extension function is called as the first step in the `del()` method.

**Noop form:**

```js
function preDel (key, options, callback, next) {
  next(key, options, callback)
}
```

#### `'postDel'`

This extension function is called *after* the internal LevelUP `del()` has been executed and we have a possible `err` object. It is called just prior to calling the user-supplied `callback()` with the `err` argument.

**Noop form:**

```js
function postDel (key, options, err, callback, next) {
  next(key, options, err, callback)
}
```

#### `'preBatch'`

This extension function is called as the first step in the `batch()` method. It should be safe to assume that the `array` object is an `Array` and has appropriate entries in it.

Also note that **level-updown** does *not* implement a custom form of the chained-batch supported by LevelUP and LevelDOWN. Therefore it uses the default chained-batch implementation by AbstractLevelDOWN which simply collects an array of operations and passes them to `batch()`, so we only have to worry about this extension point for both array and chained forms of `batch()`.

**Noop form:**

```js
function preBatch (array, options, callback, next) {
  next(array, options, callback, callback)
}
```

#### `'postBatch'`

This extension function is called *after* the internal LevelUP `batch()` has been executed and we have a possible `err` object. It is called just prior to calling the user-supplied `callback()` with the `err` argument.

**Noop form:**

```js
function postBatch (array, options, err, callback, next) {
  next(array, options, err, callback)
}
```

#### `'preIterator'`

It is important that iterator-creation happen within the same tick as the call to `iterator()` (and `createReadStream()` in LevelUP) so that a LevelDB snapshot can be made for the iterator straight away. The synchronous form of `iterator()` is the only supported means of creating an iterator from LevelDOWN for this reason (and because it doesn't involve any I/O).

Therefore, the extension functions for `'preIterator'` and `'postIterator'` take the form of `function (arg) { return arg }`. You are given an argument and you can either modify or replace it before returning it and this cannot occur asynchronously.

`'preIterator'` is called prior to creating a new `LevelUPDOWNIterator` object so you are given the opportunity to modify or replace the options, or replace the iterator-creation process and return something completely different.

It is important to note that the LevelUP `createReadStream()` mechanism is bypassed completely and a new iterator is created with `levelup.db.iterator()`, i.e. by calling `iterator()` on the LevelDOWN object being used by the LevelUP instance you are using. This should be safe assuming that the LevelDOWN in use is an AbstractLevelDOWN implementing and/or tested version.

You are provided with an object with two properties, a `'options'` property containing the original options object and an `'iteratorFactory'` function that takes an `options` argument that will be called internally to create a new iterator. The default `'iteratorFactory'` creates a new `LevelUPDOWNIterator` and calls the `'preIterator'` extension function(s) (below).

**Noop form:**

```js
function preIterator (pre) {
  // `pre` contains:
  //  - pre.options: options argument passed to the new iterator
  //  - pre.iteratorFactory: a function used to create a new iterator
  return pre
}
```

#### `'postIterator'`

*(See note above about the reasons for this extension function being synchronous)*

This extension function is called just prior to a new `LevelUPDOWNIterator` (or other) iterator being created. It is passed the new `iterator` object and the returned value is then passed back to the caller of the original `iterator()` call.

A common use for this function is to have the opportunity to extend the new iterator with `iterator.extendWith()` (see below) prior to handing it off. Because each iterator instance is new for each call to `iterator()` (or `createReadStream()` in LevelUP) you must extend each one as it is created.

**Noop form:**

```js
function postIterator (iterator) {
  return iterator
}
```

### LevelUPDOWNIterator#extendWith(extensionMap)

The `extendWith()` method on each **level-updown** iterator instance is the **externr** extension injection mechanism. You must pass an `Object` to it where the properties are the keys of the extension points you wish to use. The extensions take the form of functions with a specific list of arguments for each extension point.

### LevelUPDOWNIterator extension points

#### `'preNext'`

This extension function is called as the first step in the `next()` method.

**Noop form:**

```js
function preNext (callback, next) {
  next(callback)
}
```

#### `'postNext'`

This extension function is called *after* the internal `next()` has been executed and we have possible `err`, `key` and `value` objects. It is called just prior to calling the user-supplied `callback()` with the `err`, `key` and `value` arguments.

Note that `null` values `err`, `key` *and* `value` are used by LevelDOWN to indicate the end of the iterator.

**Noop form:**

```js
function postNext (err, key, value, callback, next) {
  next(err, key, value, callback)
}
```

#### `'preEnd'`

This extension function is called as the first step in the `end()` method.

**Noop form:**

```js
function preEnd (callback, next) {
  next(callback)
}
```

#### `'postEnd'`

This extension function is called *after* the internal `end()` has been executed and we have a possible `err` object. It is called just prior to calling the user-supplied `callback()` with the `err` argument.

**Noop form:**

```js
function postEnd (err, callback, next) {
  next(err, callback)
}
```

## License


**level-updown** is Copyright (c) 2014 Rod Vagg [@rvagg](https://twitter.com/rvagg) and licensed under the MIT licence. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE.md file for more details.

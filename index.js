var hindex = require('hyperlog-index')
var sub = require('subleveldown')
var through = require('through2')
var pump = require('pump')
var EventEmitter = require('events').EventEmitter
var SEED = 's', DEX = 'i'

module.exports = function (opts) {
  var sdb = sub(opts.db, SEED)
  var map = opts.map
  var seeding = {}
  var dex = hindex({
    log: opts.log,
    db: sub(opts.db, DEX),
    map: function (row, next) {
      var cmd = map(row.value)
      if (!cmd) next()
      if (cmd.type === 'del') {
        sdb.del(cmd.link, next)
        change()
      } else if (cmd.type === 'put') {
        sdb.put(cmd.link, row.key, next)
        change()
      }
    }
  })
  var changing = false
  change()
  var ev = new EventEmitter
  return ev

  function change () {
    if (changing) return
    changing = true
    var links = {}
    dex.ready(function () {
      changing = false
      pump(sdb.createReadStream(), through.obj(write))
    })
    function write (row, enc, next) {
      links[row.key] = true
      if (seeding[row.key]) return next()
      seeding[row.key] = true
      ev.emit('seed', row.key)
      next()
    }
    function end () {
      Object.keys(seeding).forEach(function (key) {
        if (!links[key]) {
          ev.emit('unseed', key)
          delete seeding[key]
        }
      })
    }
  }
}

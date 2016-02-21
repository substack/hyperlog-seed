var webtorrent = require('webtorrent')
var parseTorrent = require('parse-torrent')
var level = require('level')
var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var sub = require('subleveldown')
var swarmlog = require('swarmlog')

var db = level('/tmp/webtorrent-mirror.db')
var hseed = require('../')

var log = swarmlog({
  id: process.argv[2],
  db: sub(db, 'log'),
  sodium: require('chloride'),
  valueEncoding: 'json',
  hubs: [ 'https://signalhub.mafintosh.com' ]
})
var seeder = hseed({
  db: sub(db, 'seed'),
  log: log,
  map: function (row) {
    if (row.link) return { type: 'put', link: row.link }
    if (row.unlink) return { type: 'del', link: row.unlink }
  }
})
var dir = '/tmp/webtorrent'

var client = webtorrent()

seeder.on('seed', function (link) {
  console.log('SEED', link)
  var t = parseTorrent(link)
  var tdir = path.join(dir, t.infoHash)
  fs.readdir(tdir, function (err, files) {
    if (!files) client.add(link, onadd)
    else {
      var tfiles = files.map(function (f) { return path.join(tdir, f) })
      client.seed(tfiles, onseed)
    }
  })
  function onadd (s) {
    var tdir = path.join(dir, t.infoHash)
    mkdirp(tdir, function () {
      t.files.forEach(function (file) {
        file.createReadStream()
          .pipe(fs.createWriteStream(path.join(tdir, t.infoHash)))
      })
    })
  }
  function onseed (s) {
    if (s.infoHash !== t.infoHash) {
      client.remove(s)
      client.add(link, onadd)
    }
  }
})
seeder.on('unseed', function (link) {
  console.log('UNSEED', link)
  var t = parseTorrent(link)
  for (var i = 0; i < client.torrents.length; i++) {
    if (client[i].infoHash === t.infoHash) client[i].destroy()
  }
})

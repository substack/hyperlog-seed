var webtorrent = require('webtorrent')
var parseTorrent = require('parse-torrent')
var level = require('level')
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

var client = webtorrent()
seeder.on('seed', function (link) {
  var t = parseTorrent(link)
  client.add(link)
  console.log('SEED', link)
})
seeder.on('unseed', function (link) {
  var t = parseTorrent(link)
  for (var i = 0; i < client.torrents.length; i++) {
    if (client[i].infoHash === t.infoHash) client[i].destroy()
  }
  console.log('UNSEED', link)
})

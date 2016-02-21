var webtorrent = require('webtorrent')
var parseTorrent = require('parse-torrent')
var level = require('level')
var sub = require('subleveldown')
var swarmlog = require('swarmlog')

var db = level('/tmp/webtorrent-publish.db')
var hseed = require('../')

var log = swarmlog({
  keys: require('./keys.json'),
  db: sub(db, 'log'),
  sodium: require('chloride'),
  valueEncoding: 'json',
  hubs: [ 'https://signalhub.mafintosh.com' ]
})

var client = webtorrent()
client.seed([process.stdin], { name: 'test.txt' }, function (torrent) {
  log.append({ link: torrent.magnetURI })
})

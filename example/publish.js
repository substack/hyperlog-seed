var webtorrent = require('webtorrent')
var parseTorrent = require('parse-torrent')
var level = require('level')
var swarmlog = require('swarmlog')

var log = swarmlog({
  keys: require('./keys.json'),
  db: level('/tmp/webtorrent-publish.db'),
  sodium: require('chloride'),
  valueEncoding: 'json',
  hubs: [ 'https://signalhub.mafintosh.com' ]
})

var client = webtorrent()
client.seed([process.stdin], { name: 'test.txt' }, function (torrent) {
  log.append({ link: torrent.magnetURI })
  console.log(torrent.magnetURI)
})

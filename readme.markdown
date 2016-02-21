# hyperlog-seed

seed content hashes embedded in a hyperlog

# example

First we will generate some elliptic curve keys:

```
$ node -pe "JSON.stringify(require('ssb-keys').generate())" > keys.json
```

Now we can seed content from stdin to webtorrent and write the magnet link to a
swarmlog:

``` js
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
```

We can now write a mirroring service to download and seed everything published
to our swarmlog:

``` js
var webtorrent = require('webtorrent')
var parseTorrent = require('parse-torrent')
var level = require('level')
var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var sub = require('subleveldown')
var swarmlog = require('swarmlog')

var db = level('/tmp/webtorrent-mirror.db')
var log = swarmlog({
  id: process.argv[2],
  db: sub(db, 'log'),
  sodium: require('chloride'),
  valueEncoding: 'json',
  hubs: [ 'https://signalhub.mafintosh.com' ]
})

var hseed = require('../')
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
```


Given the public key from our publisher, we can mirror the webtorrent magnet
links it posts to its swarmlog:

```
$ json public < keys.json
VtSrpZkaY9570yX4TQZEPDwFWkYApGt2otPsLN3Bw/0=.ed25519
$ electron-spawn mirror.js VtSrpZkaY9570yX4TQZEPDwFWkYApGt2otPsLN3Bw/0=.ed25519
```

Finally, we can publish torrents to the swarmlog:

```
$ echo OH HI HELLO | electron-spawn publish.js
magnet:?xt=urn:btih:5302fe31bf355f91a47f47cea74e57652b7fa3e3&dn=test.txt&tr=udp%3A%2F%2Fexodus.desync.com%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.webtorrent.io
```

and download them with webtorrent elsewhere, even when the publisher is offline:

```
$ electron-spawn `which webtorrent` 'magnet:?xt=urn:btih:5302fe31bf355f91a47f47cea74e57652b7fa3e3&dn=test.txt&tr=udp%3A%2F%2Fexodus.desync.com%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.webtorrent.io'
```

If you restart the mirror process, it will resume seeding torrents from the
swarmlog feed. If you publish more torrents to the feed, these new torrents will
also be mirrored.

# api

``` js
var hseed = require('hyperlog-seed')
```

## var seeder = hseed(opts)

Create a new `seeder` from:

* `opts.db` - a leveldb instance
* `opts.log` - a hyperlog instance
* `opts.map(row)` - a function mapping rows to link and unlink operations

To add a magnet link for seeding, `opts.map` should return:

``` js
{ type: 'put', link: 'magnet:...' }
```

To remove a magnet link from seeding, `opts.map` should return:

``` js
{ type: 'put', unlink: 'magnet:...' }
```

## seeder.on('seed', function (link) {})

This event fires when the seeder should start seeding a magnet `link`.
This happens when a new `link` is posted to the log and when the seeder resumes
after a restart.

## seeder.on('unseed', function (link) {})

This event fires when the seeder should stop seeding a magnet `link`.
This happens when the log removes `link`.

# license

BSD

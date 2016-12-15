/* jshint asi:true,unused:true */
var path = require('path')
var fs = require('fs')
var readPackage = require('read-package-json')
var detective = require('detective')
var async = require('async')
var builtins = require('builtins')
var resolve = require('resolve')
var debug = require('debug')('non-local-requires')
var lookup = require('lookup')
var flatten = require('flatten')

module.exports = function(opts, cb) {
  var pkgPath = opts.path
  readPackage(pkgPath, function(err, pkg) {
    if (err && err.code === 'EISDIR') {
      pkgPath = path.join(pkgPath, 'package.json')
      return readPackage(pkgPath, function(err, pkg) {
        if (err && err.code === 'EISDIR') {
          return cb(err)
        }
        pkg = pkg || {dependencies: {}}
        doParse(pkg, cb)
      })
      doParse(pkg, cb)
    }
  })

  function doParse (pkg, cb) {
    debug('parsing ' + pkgPath);
    parse({path: pkgPath, package: pkg, entries: opts.entries}, cb)
  }
}

function parse(opts, cb) {
  var IS_NOT_RELATIVE = /^[^\\\/\.]/
  var IS_JSON = /\.json$/
  
  var pkgPath = opts.path
  var pkg = opts.package
  
  var paths = []
  var main = pkg.main || 'index.js';
  if (main[0] === '.') main = main.substr(2);
  if (main.indexOf('.') < 0) main += '.js';
  var mainPath = path.resolve(path.join(path.dirname(pkgPath), main))
  if (fs.existsSync(mainPath)) paths.push(mainPath)
  
  if (pkg.bin) {
    if (typeof pkg.bin === 'string') {
      paths.push(path.resolve(path.join(path.dirname(pkgPath), pkg.bin)))
    } else {
      Object.keys(pkg.bin).forEach(function(cmdName) {
        var cmd = pkg.bin[cmdName]
        paths.push(path.resolve(path.join(path.dirname(pkgPath), cmd)))
      })
    }
  }
  
  // pass in custom additional entries e.g. ['./test.js']
  if (opts.entries) {
    if (typeof opts.entries === 'string') opts.entries = [opts.entries]
    opts.entries.forEach(function(entry) {
      paths.push(path.resolve(path.join(path.dirname(pkgPath), entry)))
    })
  }
  
  debug('entry paths', paths)
  
  if (paths.length === 0) return cb(new Error('No entry paths found ' + opts.path))
  
  var visited = {};
  async.map(paths, function(file, cb) {
    getDeps(file, path.dirname(pkgPath), cb)
  }, function(err, allDeps) {
    if (err) return cb(err)
    // turn deps into lookup with require strings as keys
    var used = lookup.reduce(flatten(allDeps), 'string', 'array');
    used = Object.keys(used).map(function (key) {
      return {
        string: key,
        locations: used[key].map(function (loc) { return loc.file + ':' + loc.line })
      }
    });
    cb(null, used)
  })
  
  function getDeps(file, basedir, callback) {
    if (IS_NOT_RELATIVE.test(file) || IS_JSON.test(file)) {
      return callback(null, [])
    }
    
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      var filename = './' + path.basename(file)
      debug('resolve', [path.dirname(file), filename])
      file = resolve.sync(filename, { basedir: path.dirname(file) })
    }
    
    if (visited[file]) return callback(null, []);
    visited[file] = true;
    fs.readFile(file, 'utf8', read)
    
    function read(err, contents) {
      if (err) {
        return callback(err)
      }
      
      debug('parsing %s', file);
      var requires;
      try {
        requires = detective.find(contents, {nodes: true, parse: {loc: true}})
      } catch (err) {
        callback(err);
      }
      var relatives = []
      var localDeps = requires.strings.map(function(req, i) {
        var isCore = builtins.indexOf(req) > -1
        if (IS_NOT_RELATIVE.test(req) && !isCore) {
          // require('foo/bar') -> require('foo')
          //if (req.indexOf('/') > -1) req = req.split('/')[0]
          var line = requires.nodes[i].loc.start.line;
          debug('require("' + req + '") at line ' + line + ' of ' + file + ' is a dependency')
          return { string: req, line: line, file: file }
        }

        if (isCore) {
          debug('require("' + req + '")' + ' is core')
        } else {
          debug('require("' + req + '")' + ' is relative')
          relatives.push(path.resolve(path.dirname(file), req))
        }
      }).filter(Boolean)
      
      async.map(relatives, function(name, cb) {
        getDeps(name, basedir, cb)
      }, function (err, siblingDeps) {
        if (err) return callback(err);
        callback(null, localDeps.concat(siblingDeps))
      })
    }
  }
}


#!/usr/bin/env node

var path = require('path')
var check = require('./')

var args = require('minimist')(process.argv.slice(2))

if (args._.length === 0) {
  console.log('Usage: dependency-check <path to package.json or module folder>')
  process.exit(1)
}

findRequires({path: args._[0], entries: args.entry}, function(err, requires) {
  if (err) {
    console.error(err.message)
    return process.exit(1)
  }
  requires.forEach(function (req) {
    console.log(JSON.stringify(req))
  }
})

# non-local-requires

Find all the non-local and non-core requires in your code. (E.g. external
dependencies).

## What it do

`non-local-requires` parses your module code starting from the default entry files (e.g. `index.js` or `main` and any `bin` commands defined in package.json) and traverses through all relatively required JS files, ultimately producing a list of non-relative modules

* **relative** - e.g. `require('./a-relative-file.js')`, if one of these are encountered the required file will be recursively parsed by the `dependency-check` algorithm
* **non-relative** - e.g. `require('a-module')`, if one of these are encountered it will get added to the list of dependencies, but subdependencies of the module will not get recursively parsed

the goal of this module is to simply check that all non-relative modules that get `require()`'d are in package.json, which prevents people from getting 'module not found' errors when they install your module that has missing deps which was accidentally published to NPM (happened to me all the time, hence the impetus to write this module).

## CLI usage

```
$ npm install non-local-requires -g
$ non-local-requires <package.json file or module folder path>
```

## Tips

- [detective](https://www.npmjs.org/package/detective) is used for parsing `require()` statements, which means it only does **static requires**. this means you should convert things like `var foo = "bar"; require(foo)` to be static, e.g. `require("bar")`
- you can specify as many entry points as you like with multiple `--entry foo.js` arguments

## acknowledgements

This code was mostly written by Max Ogden for his super useful [dependency-check](https://npmjs.org/dependency-check), I wanted something similar-but-not-quite-the-same-in-scope so I forked it.

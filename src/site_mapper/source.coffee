EventEmitter = require('events').EventEmitter
config = require '../config'

module.exports = class Source extends EventEmitter
  constructor: (options) ->
    @options = options
    @changefreq = options.changefreq
    @priority = options.priority
    @urlFormatter = options.urlFormatter
    @urlFilter = options.urlFilter
    @out = options.out

  generateUrls: (cb) ->
    @_generateUrls (prefilteredUrl) ->
      if !@urlFilter || @urlFilter(prefilteredUrl)
        cb(prefilteredUrl)

  end: ->
    process.nextTick =>
      @emit('done')

  error: (err) ->
    process.nextTick =>
      util = require 'util'
      unless @options.ignoreErrors
        @emit('error', err)
      else
        util = require 'util'
        @out.write "[IGNORING ERROR]: #{util.inspect err} by configuration\n"
        @emit('done')

  _generateUrls: (cb) ->
    throw "Not Implemented Yet!"

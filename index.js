'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const colors = require('ansi-colors')
const log = require('fancy-log')
const PluginError = require('plugin-error')
const through = require('through2')
const url = require('url')
const OSS = require('ali-oss')
const moment = require('moment')
const _ = require('lodash')
const zlib = require('zlib')
const mime = require('mime')
const gulp = require('gulp')

let ossClient
let ossOptions = {
  accessKeyId: '',
  accessKeySecret: '',
  bucket: '',
  urlPrefix: '',
  endpoint: ''
}

let cdnCache = {}

let keyPrefix = ''

function sha1(content) {
  return crypto.createHash('md5')
    .update(content)
    .digest('hex').substr(6, 7)
}

let cdnCacheFileName = ''

function getCdnName(filePath, prefix) {
  const name = path.basename(filePath)
  const dir = path.dirname(prefix)

  return (dir === '.' ? '' : dir + '/') + name
}

async function uploadFile(filePath, filename) {
  if (cdnCache[filename]) {
    return { isSuccess: true }
  }

  const ext = path.extname(filePath)
  let content = fs.readFileSync(filePath)
  let contentType

  const charsetMimes = {
    '.js': 'utf-8',
    '.css': 'utf-8',
    '.html': 'utf-8',
    '.htm': 'utf-8',
    '.svg': 'utf-8'
  }

  const gzipMimes = {
    '.html': 6,
    '.htm': 6,
    '.js': 6,
    '.css': 6,
    '.svg': 6
  }

  contentType = mime.getType(ext) || 'application/octet-stream'

  if (charsetMimes[ext]) {
    contentType += '; charset=' + charsetMimes[ext]
  }

  if (!ossClient) {
    ossClient = new OSS({
      accessKeyId: ossOptions.accessKeyId,
      accessKeySecret: ossOptions.accessKeySecret,
      bucket: ossOptions.bucket,
      endpoint: ossOptions.endpoint
    })
  }

  // console.log(ossClient.__proto__);

  const key = `${keyPrefix}${filename}`.replace(/^\/+/, '')

  // console.log(key)

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': contentType,
    'Cache-Control': 'max-age=315360000',
    Expires: moment().add(10, 'years').toDate().toGMTString()
  }

  if (gzipMimes[ext]) {
    headers['Content-Encoding'] = 'gzip'
    content = zlib.gzipSync(content, { level: gzipMimes[ext] })
  }

  try {
    await ossClient.put(key, content, { headers })

    cdnCache[filename] = true
    log('OK:', colors.green(filename + '\tmime: ' + contentType))

    return true
  } catch (error) {
    log('ERR:', colors.red(filename + '\t' + error))

    return false
  }
}

function cdn(options) {
  options = options || {}

  const asset = options.asset || process.cwd()
  const queue = []

  try {
    cdnCache = _(cdnCache).merge(JSON.parse(fs.readFileSync(path.join(__dirname, cdnCacheFileName)))).value()
  } catch (e) {}

  return through.obj(function (file, enc, cb) {
    let contents, prefix, cdnName

    if (file.isNull()) {
      cb()
      return
    }

    if (file.isStream()) {
      cb(new PluginError('CDN', 'Streaming not supported'))
      return
    }

    contents = file.contents.toString()

    prefix = path.relative(asset, file.path)
    cdnName = getCdnName(file.path, prefix)

    queue.push({
      name: cdnName,
      path: file.path
    })

    file.contents = Buffer.from(contents)

    return cb(null, file)
  }, function (cb) {
    let len = 0

    const run = async () => {
      const isSuccess = await uploadFile(queue[len].path, queue[len].name)

      if (isSuccess) {
        len++

        if (len >= queue.length) {
          fs.writeFileSync(path.join(__dirname, cdnCacheFileName), JSON.stringify(cdnCache, null, '  '))

          cb()
        } else {
          run()
        }
      } else {
        cb()
      }
    }

    if (queue.length > 0) {
      run()
    } else {
      return cb()
    }
  })
}

class WebpackPlugin {
  constructor(options) {
    this.options = options

    ossOptions = { ...options.oss }
    cdnCacheFileName = `cdn-manifest.${sha1(JSON.stringify(ossOptions))}.json`

    let urlPrefix = ossOptions.urlPrefix
    if (urlPrefix.indexOf('//') === 0) {
      urlPrefix = `http:${urlPrefix}`
    }

    keyPrefix = (new url.URL(urlPrefix)).pathname
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tap('webpack-alioss-upload-plugin', () => {
      gulp.series(
        (cb) => {
          console.log('============== 开始上传 ==============')
          console.log()
          cb()
        },
        () => {
          const outputPath = this.options.outputPath ? this.options.outputPath : compiler.outputPath

          return gulp.src(outputPath + '/**/*').pipe(cdn({
            asset: outputPath
          }))
        },
        (cb) => {
          console.log()
          console.log('============== 上传完成 ==============')
          console.log()
          cb()
        }
      )()
    })
  }
}

module.exports = WebpackPlugin

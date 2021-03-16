# webpack-alioss-upload-plugin

[![npm version](https://badge.fury.io/js/webpack-alioss-upload-plugin.svg)](https://badge.fury.io/js/webpack-alioss-upload-plugin)

用于上传 webpack 生成的所有文件到阿里云 OSS 的 webpack 插件。本插件会自动缓存已经上传过的文件，不会重复上传，提高上传速度。

插件会设置好已上传文件的浏览器缓存和 CORS 设置。

## 安装

```console
$ npm install webpack-alioss-upload-plugin --save-dev
```

## 使用

例子 webpack 配置：

**webpack.config.js**

```js
const WebpackAliossUploadPlugin = require('webpack-alioss-upload-plugin');

module.exports = {
  plugins: [
    new WebpackAliossUploadPlugin({
      oss: {
        accessKeyId: '',
        accessKeySecret: '',
        bucket: '',
        urlPrefix: '',
        endpoint: ''
      }
    })
  ]
};
```

## 配置项

* **oss** - 阿里云 OSS 配置信息
* **outputPath** - 输出路径，默认插件会读取 webpack 的 outputPath 参数，如果你想指定上传到 OSS 文件的根路径，可以设置这个参数。

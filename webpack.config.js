const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    main: './src/index.js',
    vendor: './src/vendor.js'
  },
  devtool: 'cheap-module-eval-source-map',
  module: {
    rules: [{
      test: /\.(jpg|png)$/,
      use: [{
        loader: "file-loader",
      }],
    }, {
      test: /\.js$/,
      exclude: [/node_modules/],
      use: [{
        loader: 'babel-loader',
        options: {
          presets: ['es2015']
        }
      }]
    }]
  },
  output: {
    filename: '[chunkhash].[name].js',
    path: path.resolve(__dirname, 'build'),
    publicPath: '/'
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Space Junker'
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor'
    })
  ],
  devServer: {
    contentBase: path.resolve(__dirname, 'build'),
    publicPath: '/'
  },
}

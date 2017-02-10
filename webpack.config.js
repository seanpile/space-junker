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
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(jpg|png)$/,
        use: [{
          loader: "file-loader?name=img/[name].[ext]",
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
      }
    ]
  },
  output: {
    filename: '[name]-dist.js',
    path: path.resolve(__dirname, 'docs'),
    publicPath: 'https://seanpile.github.io/space-junker/'
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Space Junker',
      template: 'src/index.template.ejs',
      inject: 'body',
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor'
    })
  ],
  devServer: {
    contentBase: path.resolve(__dirname, 'docs'),
    publicPath: '/'
  },
}

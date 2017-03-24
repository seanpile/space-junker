const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = function (env) {
  const config = {
    entry: {
      main: env.prod ? './src/index.js' :
      [
        'react-hot-loader/patch',
        'webpack/hot/only-dev-server',
        'webpack-dev-server/client?http://localhost:8080',
        './src/index.js',
      ],
      vendor: './src/vendor.js',
    },
    resolve: {
      alias: {
        splash: path.resolve(__dirname, 'node_modules/splash-screen/dist/'),
      },
      extensions: ['.js', '.json', '.jsx'],
    },
    devtool: env.prod ? 'eval' : 'cheap-module-eval-source-map',
    devServer: {
      hot: true,
      inline: true,
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /img\/.*\.(jpg|png)$/,
          use: [{
            loader: 'file-loader?name=[name].[ext]&publicPath=img/&outputPath=img/',
          }],
        },
        {
          test: /models\/(.*)\.(jpg|png)$/,
          use: [{
            loader: 'file-loader',
            options: {
              name: '[path][name].[ext]',
              context: path.resolve(__dirname, 'src', 'models'),
              publicPath: 'models/',
              outputPath: 'models/',
            },
          }],
        },
        {
          test: /\.(dae)$/,
          use: [{
            loader: 'file-loader?name=[name].[ext]&publicPath=models/&outputPath=models/',
          }],
        },
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: [{
            loader: 'babel-loader',
            options: {
              plugins: env.prod ? [] : ['react-hot-loader/babel'],
              presets: [['es2015', {
                modules: false,
              }], 'stage-2', 'react'],
            },
          }],
        },
      ],
    },
    output: {
      filename: '[name]-dist.js',
      path: path.resolve(__dirname, 'docs'),
    },
    plugins: [
      new HtmlWebpackPlugin({
        title: 'Space Junker',
        template: 'src/index.template.ejs',
        inject: 'body',
      }),
      new webpack.optimize.CommonsChunkPlugin({
        name: 'vendor',
      }),
      new webpack.NamedModulesPlugin(),
    ],
  };

  if (env.dev) {
    config.plugins.push(new webpack.HotModuleReplacementPlugin());
  }

  return config;
};

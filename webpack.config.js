const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = function (env) {

  const dev = env && env.dev;
  const config = {
    entry: {
      main: dev ? [
        'webpack/hot/only-dev-server',
        'webpack-dev-server/client?http://localhost:8080',
        './src/index.js',
      ] : './src/index.js',
      vendor: './src/vendor.js',
    },
    resolve: {
      alias: {
        splash: path.resolve(__dirname, 'node_modules/splash-screen/dist/'),
        vue$: 'vue/dist/vue.esm.js',
      },
      extensions: ['.js', '.json', '.jsx', '.vue'],
    },
    devtool: dev ? 'cheap-module-eval-source-map' : 'eval',
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
          test: /\.vue$/,
          exclude: /node_modules/,
          loader: 'vue-loader',
        },
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: [{
            loader: 'babel-loader',
            options: {
              presets: [['es2015', {
                modules: false,
              }], 'stage-2'],
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

  if (dev) {
    config.plugins.push(new webpack.HotModuleReplacementPlugin());
  }

  return config;
};

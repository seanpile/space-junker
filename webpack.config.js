const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    main: './src/index.js',
    vendor: './src/vendor.js',
  },
  resolve: {
    alias: { splash: path.resolve(__dirname, 'node_modules/splash-screen/dist/') },
    extensions: ['.js', '.json', '.jsx'],
  },
  devtool: 'cheap-module-eval-source-map',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /img\/.*\.(jpg|png)$/,
        use: [{ loader: 'file-loader?name=[name].[ext]&publicPath=img/&outputPath=img/' }],
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
        use: [{ loader: 'file-loader?name=[name].[ext]&publicPath=models/&outputPath=models/' }],
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [{
          loader: 'babel-loader',
          options: { presets: ['es2015', 'react'] },
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
    new webpack.optimize.CommonsChunkPlugin({ name: 'vendor' }),
  ],
};

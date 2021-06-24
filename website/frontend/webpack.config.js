const Path = require('path');
const Webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const StylelintPlugin = require('stylelint-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const prodMode = process.env.NODE_ENV === 'production';

// Modifications for dev for linting
const plugins = !prodMode ? [
  new BundleAnalyzerPlugin(),
  new StylelintPlugin({
    files: Path.join('src', '**/*.s?(a|c)ss'),
  }),
] : [];
const rules = !prodMode ? [{
  test: /\.js$/,
  include: Path.resolve(__dirname, 'src'),
  enforce: 'pre',
  loader: 'eslint-loader',
  options: {
    emitWarning: true,
  },
}] : [];

module.exports = {
  mode: prodMode ? 'production' : 'development',
  devtool: prodMode ? 'source-map' : 'inline-cheap-source-map',
  bail: prodMode ? true : false,
  entry: {
    main: Path.resolve(__dirname, 'src/main/scripts/index.ts'),
    flabyrinth: Path.resolve(__dirname, 'src/flabyrinth/scripts/index.ts'),
  },
  output: {
    path: Path.join(__dirname, 'static/'),
    filename: 'js/[name].js',
    chunkFilename: prodMode ? 'js/[name].[chunkhash:8].chunk.js' : 'js/[name].chunk.js'
  },
  devServer: {
    contentBase: Path.join(__dirname, 'static/'),
    hot: true,
    proxy: {
      '!/static/**': {
        target: 'http://localhost:8000',
        changeOrigin: true, 
      }
    }
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      name: 'vendors',
    },
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyWebpackPlugin({ 
      patterns: [{ 

        // MUST have '/' after public, if not only hollow directories are copied
        from: Path.resolve(__dirname, 'public/'), 
        to: '' 
      }] 
    }),
    new MiniCssExtractPlugin({ 
      filename: 'css/[name].css', 
      chunkFilename: 'css/[name].css' 
    }),
    ...plugins
  ],
  resolve: {
    alias: {
      '~': Path.resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
      },
      {
        test: /\.(t|j)s$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.s?css/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader', 'sass-loader'],
      },
      {
        test: /\.(ico|jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2)(\?.*)?$/,
        use: {
          loader: 'file-loader',
          options: {
            name: '[path][name].[ext]',
          },
        },
      },
      ...rules
    ],
  },
};

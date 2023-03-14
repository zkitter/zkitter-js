const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const { compilerOptions } = require('./tsconfig.compile.json');
const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';

const envPlugin = new webpack.EnvironmentPlugin({
  NODE_ENV: '',
  NODE_NO_WARNINGS: '',
});

const rules = [
  {
    test: /\.tsx?$/,
    exclude: [/(node_modules|.webpack)/],
    rules: [
      {
        loader: 'ts-loader',
        options: {
          configFile: 'tsconfig.json',
          transpileOnly: true,
        },
      },
    ],
  },
  {
    test: /\.node$/,
    use: 'node-loader',
  },
];

module.exports = [
  {
    mode: isProd ? 'production' : 'development',
    entry: {
      index: path.join(__dirname, 'src', 'index.ts'),
    },
    target: 'node',
    devtool: 'source-map',
    resolve: {
      extensions: ['.ts', '.js', '.png', '.svg', '.wasm'],
    },
    node: {
      __dirname: true,
    },
    module: {
      rules: [...rules],
    },
    output: {
      path: __dirname + '/dist',
      filename: `[name].js`,
      libraryTarget: 'umd',
      globalObject: 'this',
      umdNamedDefine: true,
      library: {
        name: 'zkitter-js',
        type: 'umd',
      },
    },
    // optimization: {
    //     minimize: isProd,
    //     minimizer: [new UglifyJsPlugin({
    //         // minimize: true,
    //         sourceMap: true,
    //         include: /\.min\.js$/,
    //     })]
    // },
    plugins: [envPlugin],
  },
];

const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const { compilerOptions } = require('./tsconfig.compile.json');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

const envPlugin = new webpack.EnvironmentPlugin({
  NODE_ENV: '',
  NODE_NO_WARNINGS: '',
});

const rules = [
  {
    test: /\.node$/,
    use: 'node-loader',
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|.webpack)/,
    rules: [
      {
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
];

module.exports = [
  {
    mode: isProd ? 'production' : 'development',
    entry: {
      cli: path.join(__dirname, 'src', 'cli', 'index.ts'),
      index: path.join(__dirname, 'src', 'index.ts'),
      test: path.join(__dirname, 'src', 'test.ts'),
    },
    target: 'node',
    devtool: 'source-map',
    // externals: [nodeExternals()],
    externals: {
      '@zk-kit/protocols': 'commonjs2 @zk-kit/protocols',
    },
    resolve: {
      extensions: ['.ts', '.js', '.png', '.svg'],
      // modules: [path.resolve('./node_modules'), path.resolve(__dirname, compilerOptions.baseUrl)],
    },
    node: {
      __dirname: true,
    },
    module: {
      rules: [...rules],
    },
    output: {
      path: __dirname + '/build',
      filename: `[name].js`,
    },
    plugins: [envPlugin],
  },
];

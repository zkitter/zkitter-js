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
            browser: path.join(__dirname, 'src', 'index.ts'),
        },
        devtool: 'source-map',
        externals: {
            'snarkjs': 'commonjs2 snarkjs',
            // '@zk-kit/protocols': 'commonjs2 @zk-kit/protocols',
        },
        resolve: {
            extensions: ['.ts', '.js', '.png', '.svg', '.wasm'],
            fallback: {
                "crypto": require.resolve("crypto-browserify"),
                "os": require.resolve("os-browserify/browser"),
                "stream": require.resolve("stream-browserify"),
                // "assert": require.resolve("assert"),
                // "url": require.resolve("url"),
                // "zlib": require.resolve("browserify-zlib"),
                // "http": require.resolve("stream-http"),
                // "https": require.resolve("https-browserify"),
                "constants": require.resolve("constants-browserify"),
                "fs": false,
            },
            // modules: [path.resolve('./node_modules'), path.resolve(__dirname, compilerOptions.baseUrl)],
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
                name: "zkitter-js",
                type: "umd"
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
        plugins: [
            envPlugin,
            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
            }),
            new webpack.ProvidePlugin({
                process: 'process',
            }),
        ],
    },
];

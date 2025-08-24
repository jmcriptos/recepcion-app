module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@components': './src/components',
          '@screens': './src/screens',
          '@services': './src/services',
          '@stores': './src/stores',
          '@navigation': './src/navigation',
          '@types': './src/types',
          '@utils': './src/utils',
        },
      },
    ],
  ],
};
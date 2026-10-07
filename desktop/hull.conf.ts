import path from 'path';

export default {
  projectType: 'react',
  entry: path.resolve(__dirname, './src/index'),
  htmlPluginOpts: {
    template: path.resolve(__dirname, './index.html'),
    inject: {
      title: 'Frontend Monitoring Platform',
    },
  },
  shouldUseSourceMap: true,
  extraModuleRules: [
    {
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    }],
};

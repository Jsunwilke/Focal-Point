const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      if (env === 'production') {
        // Find the CSS minimizer plugin
        const minimizerIndex = webpackConfig.optimization.minimizer.findIndex(
          minimizer => minimizer.constructor.name === 'CssMinimizerPlugin'
        );

        if (minimizerIndex !== -1) {
          // Replace with a custom configuration that preserves CSS layers
          webpackConfig.optimization.minimizer[minimizerIndex] = new CssMinimizerPlugin({
            minimizerOptions: {
              preset: [
                'default',
                {
                  // Preserve CSS layers from react-data-grid
                  discardUnused: false,
                  mergeRules: false,
                }
              ],
            },
          });
        }
      }
      return webpackConfig;
    },
  },
};

// Expo's preset (which also adds the Reanimated worklets plugin) with NativeWind's className support.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};

module.exports = ({ config }) => {
  return {
    ...config,
    userInterfaceStyle: 'dark',
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.travelsync.mobile',
      config: {
        ...(config.ios?.config || {}),
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY || '',
      },
    },
    android: {
      ...config.android,
      package: 'com.travelsync.mobile',
      config: {
        ...(config.android?.config || {}),
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || '',
        },
      },
    },
  };
};

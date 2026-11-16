describe('app.config.js Google Maps environment configuration', () => {
  const originalEnv = process.env;

  const setEnv = (key: string, val?: string) => {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    setEnv('EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY', undefined);
    setEnv('EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY', undefined);
    setEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses empty string when no Maps API keys are provided', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appConfig = require('../../app.config.js');
    const result = appConfig({ config: {} });

    expect(result.ios.config.googleMapsApiKey).toBe('');
    expect(result.android.config.googleMaps.apiKey).toBe('');
  });

  it('prefers platform-specific keys when provided', () => {
    setEnv('EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY', 'ios-key-123');
    setEnv('EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY', 'android-key-456');
    setEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', 'shared-key-fallback');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appConfig = require('../../app.config.js');
    const result = appConfig({ config: {} });

    expect(result.ios.config.googleMapsApiKey).toBe('ios-key-123');
    expect(result.android.config.googleMaps.apiKey).toBe('android-key-456');
  });

  it('falls back to EXPO_PUBLIC_GOOGLE_MAPS_API_KEY when platform-specific keys are missing', () => {
    setEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', 'shared-key-fallback');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appConfig = require('../../app.config.js');
    const result = appConfig({ config: {} });

    expect(result.ios.config.googleMapsApiKey).toBe('shared-key-fallback');
    expect(result.android.config.googleMaps.apiKey).toBe('shared-key-fallback');
  });
});

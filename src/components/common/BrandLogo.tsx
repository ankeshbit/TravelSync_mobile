import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  ImageStyle,
  TouchableOpacity,
} from 'react-native';
import { Theme } from '@/constants/theme';

export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

interface BrandLogoProps {
  /** Size preset or numeric pixel dimensions for the logo image */
  size?: BrandLogoSize;
  /** Primary brand text, defaults to 'TravelSync' */
  title?: string;
  /** Optional secondary subtitle text */
  subtitle?: string;
  /** Whether to render the brand text beside the logo (default: true) */
  showText?: boolean;
  /** Custom container styling */
  containerStyle?: StyleProp<ViewStyle>;
  /** Custom brand title text styling */
  textStyle?: StyleProp<TextStyle>;
  /** Custom subtitle text styling */
  subtitleStyle?: StyleProp<TextStyle>;
  /** Custom logo image styling */
  logoStyle?: StyleProp<ImageStyle>;
  /** Optional click/press callback */
  onPress?: () => void;
}

const SIZE_PRESETS = {
  xs: { imageSize: 16, titleFontSize: 12, subtitleFontSize: 9, gap: 6, letterSpacing: -0.2 },
  sm: { imageSize: 24, titleFontSize: 16, subtitleFontSize: 11, gap: 8, letterSpacing: -0.3 },
  md: { imageSize: 32, titleFontSize: 20, subtitleFontSize: 12, gap: 10, letterSpacing: -0.4 },
  lg: { imageSize: 40, titleFontSize: 24, subtitleFontSize: 13, gap: 12, letterSpacing: -0.5 },
  xl: { imageSize: 48, titleFontSize: 28, subtitleFontSize: 14, gap: 14, letterSpacing: -0.6 },
};

export function BrandLogo({
  size = 'md',
  title = 'TravelSync',
  subtitle,
  showText = true,
  containerStyle,
  textStyle,
  subtitleStyle,
  logoStyle,
  onPress,
}: BrandLogoProps) {
  const config =
    typeof size === 'number'
      ? {
          imageSize: size,
          titleFontSize: Math.round(size * 0.65),
          subtitleFontSize: Math.max(10, Math.round(size * 0.35)),
          gap: Math.max(4, Math.round(size * 0.25)),
          letterSpacing: -0.4,
        }
      : SIZE_PRESETS[size] || SIZE_PRESETS.md;

  const content = (
    <View style={[styles.container, { gap: config.gap }, containerStyle]}>
      <Image
        source={require('../../../assets/images/logo.png')}
        style={[
          styles.logo,
          {
            width: config.imageSize,
            height: config.imageSize,
          },
          logoStyle,
        ]}
        resizeMode="contain"
        accessibilityLabel={`${title} Logo`}
      />
      {showText && (
        <View style={styles.textWrapper}>
          <Text
            style={[
              styles.title,
              {
                fontSize: config.titleFontSize,
                letterSpacing: config.letterSpacing,
              },
              textStyle,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                { fontSize: config.subtitleFontSize },
                subtitleStyle,
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${title} Brand`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    // Preserve aspect ratio and crisp display across devices
  },
  textWrapper: {
    justifyContent: 'center',
  },
  title: {
    fontWeight: '800',
    color: Theme.colors.textPrimary,
  },
  subtitle: {
    fontWeight: '500',
    color: Theme.colors.textSecondary,
    marginTop: 1,
  },
});

export default BrandLogo;

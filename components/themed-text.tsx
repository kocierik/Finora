import { Brand } from '@/constants/branding';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'heading' | 'caption' | 'body' | 'label';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'heading' ? styles.heading : undefined,
        type === 'caption' ? styles.caption : undefined,
        type === 'body' ? styles.body : undefined,
        type === 'label' ? styles.label : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: Brand.typography.sizes.base,
    lineHeight: 24,
    fontWeight: Brand.typography.weights.regular,
  },
  defaultSemiBold: {
    fontSize: Brand.typography.sizes.base,
    lineHeight: 24,
    fontWeight: Brand.typography.weights.semibold,
  },
  title: {
    fontSize: Brand.typography.sizes['4xl'],
    fontWeight: Brand.typography.weights.black,
    lineHeight: 40,
    letterSpacing: Brand.typography.spacing.tighter,
  },
  subtitle: {
    fontSize: Brand.typography.sizes['2xl'],
    fontWeight: Brand.typography.weights.bold,
    lineHeight: 28,
    letterSpacing: Brand.typography.spacing.tight,
  },
  heading: {
    fontSize: Brand.typography.sizes.xl,
    fontWeight: Brand.typography.weights.bold,
    lineHeight: 24,
    letterSpacing: Brand.typography.spacing.tight,
  },
  body: {
    fontSize: Brand.typography.sizes.base,
    fontWeight: Brand.typography.weights.regular,
    lineHeight: 22,
  },
  label: {
    fontSize: Brand.typography.sizes.sm,
    fontWeight: Brand.typography.weights.medium,
    lineHeight: 18,
    letterSpacing: Brand.typography.spacing.wide,
  },
  caption: {
    fontSize: Brand.typography.sizes.xs,
    fontWeight: Brand.typography.weights.regular,
    lineHeight: 16,
    opacity: 0.7,
  },
  link: {
    lineHeight: 30,
    fontSize: Brand.typography.sizes.base,
    color: Brand.colors.primary.cyan,
    fontWeight: Brand.typography.weights.medium,
  },
});

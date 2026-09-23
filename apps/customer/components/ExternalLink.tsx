import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

/** External HTTP(S) URLs accepted by Expo Router typed routes. */
export type ExternalHref = `http://${string}` | `https://${string}`;

export function ExternalLink(
  props: Omit<ComponentProps<typeof Link>, 'href'> & { href: ExternalHref }
) {
  const { href, onPress, ...rest } = props;

  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          e.preventDefault();
          void WebBrowser.openBrowserAsync(href);
        }
        onPress?.(e);
      }}
    />
  );
}

import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';

import { colors } from '@/lib/theme';

/**
 * A handful of 24x24 stroke icons drawn inline. Using react-native-svg (already
 * a dependency) rather than an icon font avoids adding a package and skips
 * font loading at startup.
 */
export type IconName =
  | 'home'
  | 'clock'
  | 'sliders'
  | 'camera'
  | 'image'
  | 'close'
  | 'check'
  | 'trash'
  | 'refresh'
  | 'plus'
  | 'minus'
  | 'alert'
  | 'info'
  | 'flip';

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color = colors.text, strokeWidth = 2 }: Props) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && (
        <>
          <Path d="M3 9.5 12 2l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...common} />
          <Polyline points="9 22 9 13 15 13 15 22" {...common} />
        </>
      )}

      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={9.5} {...common} />
          <Polyline points="12 6.5 12 12 16 14" {...common} />
        </>
      )}

      {name === 'sliders' && (
        <>
          <Path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" {...common} />
          <Circle cx={16} cy={6} r={2} {...common} />
          <Circle cx={8} cy={12} r={2} {...common} />
          <Circle cx={16} cy={18} r={2} {...common} />
        </>
      )}

      {name === 'camera' && (
        <>
          <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h7L17 7h3a2 2 0 0 1 2 2z" {...common} />
          <Circle cx={12} cy={13.5} r={4} {...common} />
        </>
      )}

      {name === 'image' && (
        <>
          <Path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...common} />
          <Circle cx={8.5} cy={8.5} r={1.8} {...common} />
          <Path d="m21 16-5-5L5 21" {...common} />
        </>
      )}

      {name === 'close' && <Path d="M18 6 6 18M6 6l12 12" {...common} />}

      {name === 'check' && <Polyline points="20 6.5 9 17.5 4 12.5" {...common} />}

      {name === 'trash' && (
        <>
          <Path d="M3 6h18" {...common} />
          <Path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" {...common} />
          <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" {...common} />
        </>
      )}

      {name === 'refresh' && (
        <>
          <Path d="M20 11a8 8 0 1 0-2.3 6" {...common} />
          <Polyline points="20 4 20 11 13 11" {...common} />
        </>
      )}

      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...common} />}

      {name === 'minus' && <Path d="M5 12h14" {...common} />}

      {name === 'alert' && (
        <>
          <Circle cx={12} cy={12} r={9.5} {...common} />
          <Path d="M12 7.5v5.5" {...common} />
          <Circle cx={12} cy={16.5} r={0.9} fill={color} stroke="none" />
        </>
      )}

      {name === 'info' && (
        <>
          <Circle cx={12} cy={12} r={9.5} {...common} />
          <Path d="M12 11v5.5" {...common} />
          <Circle cx={12} cy={7.8} r={0.9} fill={color} stroke="none" />
        </>
      )}

      {name === 'flip' && (
        <>
          <Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" {...common} />
          <Path d="M12 8v8" {...common} />
        </>
      )}
    </Svg>
  );
}

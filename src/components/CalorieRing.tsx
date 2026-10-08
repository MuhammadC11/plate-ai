import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/lib/theme';

type Props = {
  consumed: number;
  goal: number;
  size?: number;
};

const STROKE = 14;

export function CalorieRing({ consumed, goal, size = 200 }: Props) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = goal > 0 ? consumed / goal : 0;
  // The ring itself caps at a full circle; going over budget is communicated
  // by the colour change and the negative "left" figure instead.
  const progress = Math.min(Math.max(ratio, 0), 1);
  const over = consumed > goal;
  const remaining = Math.round(goal - consumed);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceHigh}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={over ? colors.danger : colors.accent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <Text style={styles.value}>{Math.abs(remaining).toLocaleString()}</Text>
        <Text style={styles.label}>{over ? 'kcal over' : 'kcal left'}</Text>
        <Text style={styles.sub}>
          {Math.round(consumed).toLocaleString()} of {goal.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { color: colors.text, fontSize: 44, fontWeight: '700', letterSpacing: -1 },
  label: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 8 },
});

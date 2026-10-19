import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Ellipse, Line } from 'react-native-svg';
import { ThemeColors } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

/* Smooth back-and-forth value between 0 and 1 */
function useLoop(duration: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return value;
}

/* ---------- Soft pastel blob ---------- */
function Blob({ color, size, duration, style }: { color: string; size: number; duration: number; style: object }) {
  const t = useLoop(duration);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
        { transform: [{ translateY }, { scale }] },
      ]}
    />
  );
}

/* ---------- Floating mini card ---------- */
function FloatCard({
  icon, bg, fg, duration, rotate, style,
}: {
  icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string; duration: number; rotate: string; style: object;
}) {
  const t = useLoop(duration);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  return (
    <Animated.View style={[s.card, { backgroundColor: bg }, style, { transform: [{ translateY }, { rotate }] }]}>
      <Ionicons name={icon} size={22} color={fg} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <View style={[s.bar, { backgroundColor: fg, width: '80%' }]} />
        <View style={[s.bar, { backgroundColor: fg, width: '55%', marginTop: 5 }]} />
      </View>
    </Animated.View>
  );
}

/* ---------- Walking pose skeleton ---------- */
type P = { x: number; y: number };
const DEG = Math.PI / 180;
const move = (from: P, len: number, angle: number): P => ({
  x: from.x + len * Math.sin(angle),
  y: from.y + len * Math.cos(angle),
});

function WalkingFigure({ height, colors }: { height: number; colors: ThemeColors }) {
  const [phase, setPhase] = useState(0);

  // ~30 fps animation loop; one full stride ≈ 1.2 s
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    let last = 0;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      if (ts - last > 33) {
        last = ts;
        setPhase(((ts - start) / 1200) * Math.PI * 2);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bob = Math.abs(Math.sin(phase)) * 4;
  const hip = { x: 100, y: 150 - bob };
  const shoulder = { x: 104, y: 80 - bob };
  const head = { x: 108, y: 52 - bob };

  const leg = (p: number) => {
    const thigh = 28 * Math.sin(p) * DEG;
    const kneeBend = (Math.max(0, -Math.cos(p)) * 45 + 5) * DEG;
    const knee = move(hip, 62, thigh);
    const ankle = move(knee, 60, thigh - kneeBend);
    return { knee, ankle, toe: { x: ankle.x + 16, y: ankle.y + 2 } };
  };
  const arm = (p: number) => {
    const upper = -22 * Math.sin(p) * DEG;
    const elbow = move(shoulder, 42, upper);
    const wrist = move(elbow, 36, upper + 25 * DEG);
    return { elbow, wrist };
  };

  const near = leg(phase);
  const far = leg(phase + Math.PI);
  const nearArm = arm(phase + Math.PI);
  const farArm = arm(phase);

  const bone = (a: P, b: P, color: string, opacity = 1) => (
    <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={5} strokeLinecap="round" opacity={opacity} />
  );
  const joint = (p: P, color: string, key: string) => [
    <Circle key={key + 'g'} cx={p.x} cy={p.y} r={10} fill={color} opacity={0.35} />,
    <Circle key={key} cx={p.x} cy={p.y} r={5} fill="#FFFFFF" stroke={color} strokeWidth={2.5} />,
  ];

  return (
    <Svg width={(height * 200) / 310} height={height} viewBox="0 0 200 310">
      <Ellipse cx={100} cy={292} rx={70} ry={8} fill={colors.lavender} opacity={0.5} />

      {/* far side (faded) */}
      {bone(shoulder, farArm.elbow, colors.peach, 0.45)}
      {bone(farArm.elbow, farArm.wrist, colors.peach, 0.45)}
      {bone(hip, far.knee, colors.mint, 0.45)}
      {bone(far.knee, far.ankle, colors.mint, 0.45)}
      {bone(far.ankle, far.toe, colors.mint, 0.45)}

      {/* body */}
      {bone(shoulder, hip, colors.lavender)}
      <Circle cx={head.x} cy={head.y} r={16} fill={colors.lavender} />

      {/* near side */}
      {bone(hip, near.knee, colors.pink)}
      {bone(near.knee, near.ankle, colors.pink)}
      {bone(near.ankle, near.toe, colors.pink)}
      {bone(shoulder, nearArm.elbow, colors.peach)}
      {bone(nearArm.elbow, nearArm.wrist, colors.peach)}

      {/* glowing joints */}
      {joint(shoulder, colors.yellow, 'sh')}
      {joint(hip, colors.pink, 'hip')}
      {joint(near.knee, colors.primary, 'kn')}
      {joint(near.ankle, colors.mint, 'an')}
      {joint(nearArm.elbow, colors.peach, 'el')}
    </Svg>
  );
}

/* ---------- Full background ---------- */
export default function AnimatedBackground({ showFigure = true }: { showFigure?: boolean }) {
  const { colors, mode } = useTheme();
  const { width, height } = useWindowDimensions();
  const blobOpacity = mode === 'dark' ? 0.3 : 0.7;
  const cardOpacity = mode === 'dark' ? 0.75 : 0.9;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      <Blob color={colors.pink} size={width * 0.8} duration={4200}
        style={{ top: -width * 0.35, left: -width * 0.3, opacity: blobOpacity }} />
      <Blob color={colors.peach} size={width * 0.55} duration={5000}
        style={{ top: height * 0.1, right: -width * 0.3, opacity: blobOpacity }} />
      <Blob color={colors.lavender} size={width * 0.85} duration={4600}
        style={{ bottom: -width * 0.4, right: -width * 0.35, opacity: blobOpacity }} />
      <Blob color={colors.mint} size={width * 0.5} duration={5400}
        style={{ bottom: height * 0.2, left: -width * 0.3, opacity: blobOpacity }} />

      <FloatCard icon="body" bg={colors.pink} fg={colors.onPastel} duration={2600} rotate="-6deg"
        style={{ top: height * 0.32, left: 16, opacity: cardOpacity }} />
      <FloatCard icon="pulse" bg={colors.mint} fg={colors.onPastel} duration={3000} rotate="5deg"
        style={{ top: height * 0.46, right: 16, opacity: cardOpacity }} />
      <FloatCard icon="bar-chart" bg={colors.yellow} fg={colors.onPastel} duration={2800} rotate="-4deg"
        style={{ bottom: height * 0.34, left: 16, opacity: cardOpacity }} />

      {showFigure && (
        <View style={{ position: 'absolute', top: height * 0.2, left: 0, right: 0, alignItems: 'center' }}>
          <WalkingFigure height={height * 0.55} colors={colors} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'absolute',
    width: 120,
    height: 60,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bar: { height: 5, borderRadius: 3, opacity: 0.45 },
});
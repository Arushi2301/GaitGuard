import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getMovement } from '../constants/movements';
import { colors, ui } from '../constants/theme';
import { analyzeVideo } from '../services/analysis';
import { processAnalysisResult, ScreeningOutcome } from '../services/screening';
import { getVideoUri } from '../services/videoStore';

export default function Result() {
  const { movement } = useLocalSearchParams<{ movement: string }>();
  const uri = getVideoUri() ?? '';
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<ScreeningOutcome | null>(null);
  const requestRef = useRef<{ key: string; promise: ReturnType<typeof analyzeVideo> } | null>(null);

  const movementDetails = getMovement(movement);
  const movementName = movementDetails?.name ?? (movement ? movement.charAt(0).toUpperCase() + movement.slice(1) : 'Movement Screening');

  useEffect(() => {
    if (!uri) {
      setLoading(false);
      setOutcome({
        success: false,
        errorMessage: 'No video was found to analyze. Please record or choose a video first.',
        reason: 'missing_video_uri',
      });
      return;
    }

    let isMounted = true;
    const requestKey = `${uri}:${movement}`;

    // Prevent duplicate network calls in Strict Mode or re-renders
    if (!requestRef.current || requestRef.current.key !== requestKey) {
      requestRef.current = {
        key: requestKey,
        promise: analyzeVideo(uri, movement),
      };
    }

    requestRef.current.promise
      .then(res => {
        if (isMounted) {
          const processed = processAnalysisResult(res, movement);
          setOutcome(processed);
        }
      })
      .catch(() => {
        if (isMounted) {
          setOutcome({
            success: false,
            errorMessage: 'Analysis failed. Please try again.',
            reason: 'unhandled_client_error',
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [uri, movement]);

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={ui.title}>{movementName}</Text>

        {loading && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[ui.text, { marginTop: 16, fontWeight: '600' }]}>Analyzing video…</Text>
            <Text style={[ui.muted, { marginTop: 6, textAlign: 'center' }]}>
              Tracking body landmarks and calculating knee angles.
            </Text>
          </View>
        )}

        {!loading && outcome && (
          outcome.success ? (
            <View style={styles.section}>
              {/* Analysis Status */}
              <View style={[ui.card, styles.statusCard]}>
                <Text style={styles.statusLabel}>Analysis Status</Text>
                <Text style={styles.statusValue}>Analysis Complete</Text>
              </View>

              {/* Movement & Metric Header */}
              <View style={ui.card}>
                <Text style={ui.muted}>Movement Type</Text>
                <Text style={[ui.text, styles.headline]}>{outcome.measurement.movement}</Text>
                <Text style={[ui.muted, { marginTop: 4 }]}>
                  Metric: Minimum Knee Flexion Angle ({outcome.measurement.unit})
                </Text>
              </View>

              {/* Left Knee Angle */}
              <View style={ui.card}>
                <Text style={ui.muted}>Left Knee</Text>
                {outcome.measurement.hasLeftAngle ? (
                  <Text style={styles.angleText}>
                    {outcome.measurement.leftKneeMinAngle}
                    <Text style={styles.unitText}>° ({outcome.measurement.unit})</Text>
                  </Text>
                ) : (
                  <Text style={[ui.muted, styles.unmeasuredText]}>
                    Not measured — leg was not clearly visible in the video
                  </Text>
                )}
              </View>

              {/* Right Knee Angle */}
              <View style={ui.card}>
                <Text style={ui.muted}>Right Knee</Text>
                {outcome.measurement.hasRightAngle ? (
                  <Text style={styles.angleText}>
                    {outcome.measurement.rightKneeMinAngle}
                    <Text style={styles.unitText}>° ({outcome.measurement.unit})</Text>
                  </Text>
                ) : (
                  <Text style={[ui.muted, styles.unmeasuredText]}>
                    Not measured — leg was not clearly visible in the video
                  </Text>
                )}
              </View>

              {/* Educational Explanation */}
              <View style={ui.card}>
                <Text style={[ui.text, { fontWeight: '600', marginBottom: 4 }]}>
                  Understanding Knee Angle
                </Text>
                <Text style={ui.muted}>
                  Smaller knee angles indicate deeper knee bending during the movement.
                </Text>
              </View>

              {/* Scientific Integrity Disclaimer */}
              <View style={[ui.card, styles.disclaimerCard]}>
                <Text style={[ui.text, styles.disclaimerTitle]}>Scientific Notice</Text>
                <Text style={[ui.muted, styles.disclaimerText]}>
                  Injury risk has not been assessed. GaitGuard provides kinematic measurements only and does not provide a medical diagnosis, clinical evaluation, or substitute for a qualified healthcare professional.
                </Text>
              </View>

              {/* Frame summary if available */}
              {outcome.measurement.framesAnalyzed !== undefined && outcome.measurement.framesWithPose !== undefined && (
                <Text style={[ui.muted, styles.frameStats]}>
                  Pose tracked in {outcome.measurement.framesWithPose} of {outcome.measurement.framesAnalyzed} analyzed frames.
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <View style={[ui.card, styles.statusCard]}>
                <Text style={styles.statusLabel}>Analysis Status</Text>
                <Text style={styles.statusFailedValue}>Analysis Incomplete</Text>
              </View>

              <View style={[ui.card, styles.errorCard]}>
                <Text style={[ui.text, styles.errorTitle]}>Notice</Text>
                <Text style={[ui.text, styles.errorMessage]}>{outcome.errorMessage}</Text>
              </View>

              <Pressable style={ui.btn} onPress={() => router.back()}>
                <Text style={ui.btnText}>Retake / Record Again</Text>
              </Pressable>
            </View>
          )
        )}
      </ScrollView>

      {!loading && (
        <View style={styles.footer}>
          <Pressable style={ui.btn} onPress={() => router.dismissAll()}>
            <Text style={ui.btnText}>Back to Home</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginTop: 16,
  },
  centerContainer: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  statusLabel: {
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  statusFailedValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f87171',
    marginTop: 4,
  },
  headline: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  angleText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  unitText: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.muted,
  },
  unmeasuredText: {
    marginTop: 6,
    fontStyle: 'italic',
  },
  disclaimerCard: {
    backgroundColor: '#111c30',
    borderColor: '#334155',
    borderWidth: 1,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  disclaimerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  frameStats: {
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 8,
  },
  errorCard: {
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f87171',
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  footer: {
    paddingTop: 8,
  },
});
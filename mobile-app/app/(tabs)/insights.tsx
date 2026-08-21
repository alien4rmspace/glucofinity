import { Info, Lightbulb } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { palette, spacing } from '@/constants/design';
import { useAppData } from '@/hooks/use-app-data';
import { useGlucoseReadings } from '@/hooks/use-glucose-readings';
import { insightEngine } from '@/services/insight-engine';

export default function InsightsScreen() {
  const { meals, settings } = useAppData();
  const { readings, isLoading, error, refresh } = useGlucoseReadings(
    24,
    settings.glucoseDataSource
  );
  const observations = insightEngine.generate(readings, meals);

  return (
    <Screen testID="insights-screen" refreshing={isLoading} onRefresh={() => void refresh()}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Lightbulb size={23} color={palette.amber} />
        </View>
        <View style={styles.flex}>
          <AppText variant="title" color={palette.navy}>
            Insights
          </AppText>
          <AppText color={palette.textMuted}>Preliminary, rule-based observations.</AppText>
        </View>
      </View>

      {isLoading ? (
        <StatePanel loading title="Reviewing patterns" message="Comparing displayed readings and locally stored meals." />
      ) : error ? (
        <StatePanel title="Insights unavailable" message={error} />
      ) : observations.length === 0 ? (
        <StatePanel
          icon={<Lightbulb size={32} color={palette.textMuted} />}
          title="Not enough information"
          message="Choose a glucose data source and add meal context to generate preliminary observations."
        />
      ) : (
        <View style={styles.list}>
          {observations.map((observation, index) => (
            <Card key={observation.id} style={styles.observation}>
              <View style={styles.number}>
                <AppText variant="bodyStrong" color={palette.blue}>
                  {index + 1}
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="subtitle">{observation.title}</AppText>
                <AppText color={palette.textMuted}>{observation.description}</AppText>
                <AppText variant="label" color={palette.purple}>
                  Preliminary observation · n = {observation.evidence.sampleSize}
                </AppText>
              </View>
            </Card>
          ))}
        </View>
      )}

      <Card style={styles.disclaimer}>
        <Info size={20} color={palette.navy} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color={palette.navy}>
            Medical decisions need professional guidance
          </AppText>
          <AppText variant="caption" color={palette.textMuted}>
            These observations may be incomplete or inaccurate. Consult a qualified healthcare professional for medical decisions, and do not change medication or insulin based only on these observations.
          </AppText>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.amberSoft },
  flex: { flex: 1, gap: spacing.xs },
  list: { gap: spacing.md },
  observation: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  number: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: palette.surfaceMuted },
});

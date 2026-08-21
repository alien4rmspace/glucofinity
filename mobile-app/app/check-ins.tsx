import { router, type Href } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { FeelingCheckInCard } from '@/components/feeling-check-in-card';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatePanel } from '@/components/ui/state-panel';
import { palette, spacing } from '@/constants/design';
import { useAppData } from '@/hooks/use-app-data';

export default function FeelingCheckInHistoryScreen() {
  const { feelingCheckIns, isLoading, error, refresh } = useAppData();

  return (
    <Screen testID="feeling-check-in-history" refreshing={isLoading} onRefresh={() => void refresh()}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <ArrowLeft size={24} color={palette.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText variant="title" color={palette.navy}>Feeling check-ins</AppText>
          <AppText variant="caption" color={palette.textMuted}>Saved on this device.</AppText>
        </View>
      </View>

      <SectionHeader
        title="Your check-ins"
        description="Review or edit what you recorded at each time."
        action={
          <AppButton
            label="Add"
            variant="secondary"
            icon={<Plus size={18} color={palette.blue} />}
            onPress={() => router.push('/check-in/new' as Href)}
          />
        }
      />

      {isLoading ? (
        <StatePanel loading title="Loading check-ins" message="Reading locally saved entries." />
      ) : error ? (
        <StatePanel
          title="Check-ins unavailable"
          message={error}
          action={<AppButton label="Try again" variant="secondary" onPress={() => void refresh()} />}
        />
      ) : feelingCheckIns.length === 0 ? (
        <StatePanel
          title="No feeling check-ins yet"
          message="Record how you feel now to begin building a timestamped history for future pattern comparisons."
          action={<AppButton label="Create a check-in" onPress={() => router.push('/check-in/new' as Href)} />}
        />
      ) : (
        <View style={styles.list}>
          {feelingCheckIns.map((checkIn) => (
            <FeelingCheckInCard
              key={checkIn.id}
              checkIn={checkIn}
              onPress={() => router.push(`/check-in/${checkIn.id}` as Href)}
            />
          ))}
        </View>
      )}

      <AppText variant="caption" color={palette.textMuted}>
        Check-ins are self-reported observations. Future comparisons must account for available glucose timing and cannot establish what caused a feeling.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  list: { gap: spacing.md },
  pressed: { opacity: 0.72 },
});

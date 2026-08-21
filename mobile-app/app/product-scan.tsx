import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import {
  Barcode,
  CheckCircle2,
  ExternalLink,
  ImageOff,
  Info,
  ListChecks,
  PackageCheck,
  ScanBarcode,
  TriangleAlert,
  Wheat,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { StatePanel } from '@/components/ui/state-panel';
import { palette, radii, spacing } from '@/constants/design';
import { useAppData } from '@/hooks/use-app-data';
import {
  buildProductMealEntry,
  normalizeServingQuantity,
  scaleProductNutrition,
} from '@/services/product-consumption';
import { localProductLookupService } from '@/services/product-lookup-service';
import { scoreProduct } from '@/services/product-score-engine';
import type {
  ProductBarcodeLookup,
  ProductBarcodeRecord,
} from '@/services/nutrition-catalog';
import {
  barcodeDigits,
  supportedProductBarcodeType,
  type ProductBarcodeType,
} from '@/services/product-barcode';
import type {
  FoodScoreResult,
  ProductProcessingLevel,
  ScoreContribution,
} from '@/types/product-scoring';

const SCANNED_BARCODE_TYPES = ['ean13', 'ean8', 'itf14', 'upc_a', 'upc_e'] as const;

export default function ProductScanScreen() {
  const { saveMeal } = useAppData();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualBarcode, setManualBarcode] = useState('');
  const [lookup, setLookup] = useState<ProductBarcodeLookup>();
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isScannerArmed, setIsScannerArmed] = useState(true);
  const [isLoggingProduct, setIsLoggingProduct] = useState(false);
  const [lastSavedProductName, setLastSavedProductName] = useState<string>();

  async function findProduct(value: string, type: ProductBarcodeType = 'unknown') {
    if (isLookingUp) return;
    setIsLookingUp(true);
    setIsScannerArmed(false);
    try {
      setLookup(await localProductLookupService.lookupBarcode(value, type));
    } finally {
      setIsLookingUp(false);
    }
  }

  function handleScannedBarcode(result: BarcodeScanningResult) {
    if (!isScannerArmed) return;
    setManualBarcode(result.data);
    void findProduct(result.data, supportedProductBarcodeType(result.type));
  }

  function resetScan() {
    setLookup(undefined);
    setManualBarcode('');
    setIsScannerArmed(true);
    setLastSavedProductName(undefined);
  }

  async function logProduct(product: ProductBarcodeRecord, quantity: number) {
    setIsLoggingProduct(true);
    try {
      const meal = buildProductMealEntry(product, quantity);
      await saveMeal(meal);
      setLastSavedProductName(product.name);
    } catch (error) {
      Alert.alert(
        'Product was not logged',
        error instanceof Error ? error.message : 'Review the serving quantity and try again.',
      );
    } finally {
      setIsLoggingProduct(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close product scanner"
            hitSlop={10}
            onPress={() => router.back()}
            style={styles.closeButton}>
            <X size={24} color={palette.text} />
          </Pressable>
          <AppText variant="subtitle">Scan a product</AppText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <Card style={styles.introCard} accessibilityRole="summary">
            <View style={styles.rowStart}>
              <View style={styles.infoIcon}>
                <Info size={20} color={palette.blue} />
              </View>
              <View style={styles.flexGap}>
                <AppText variant="bodyStrong">Transparent product scoring</AppText>
                <AppText variant="caption" color={palette.textMuted}>
                  GlucoFinity uses available USDA label nutrition and ingredients to calculate explainable general and estimated glucose-impact scores on this device.
                </AppText>
              </View>
            </View>
          </Card>

          {lookup?.state === 'found' ? (
            <ProductResult
              lookup={lookup}
              isLogging={isLoggingProduct}
              lastSavedProductName={lastSavedProductName}
              onLog={logProduct}
              onReset={resetScan}
            />
          ) : (
            <>
              <View style={styles.section}>
                <AppText variant="subtitle">Camera scanner</AppText>
                {!permission ? (
                  <StatePanel
                    loading
                    title="Checking camera access"
                    message="Preparing the on-device barcode scanner."
                  />
                ) : permission.granted ? (
                  isFocused && !lookup ? (
                    <View style={styles.cameraWrap}>
                      <CameraView
                        accessibilityLabel="Product barcode camera preview"
                        barcodeScannerSettings={{ barcodeTypes: [...SCANNED_BARCODE_TYPES] }}
                        facing="back"
                        onBarcodeScanned={isScannerArmed ? handleScannedBarcode : undefined}
                        style={styles.camera}>
                        <View style={styles.cameraOverlay}>
                          <View style={styles.scanFrame} />
                          <AppText variant="caption" color="#FFFFFF" style={styles.cameraHint}>
                            Center the UPC or EAN barcode inside the frame
                          </AppText>
                        </View>
                      </CameraView>
                    </View>
                  ) : null
                ) : (
                  <StatePanel
                    icon={<ScanBarcode size={32} color={palette.blue} />}
                    title="Camera access is off"
                    message="Camera access is used only to read the barcode. Camera frames are not saved. You can also enter the numbers below."
                    action={permission.canAskAgain
                      ? <AppButton label="Allow camera" onPress={() => void requestPermission()} />
                      : <AppButton label="Open settings" onPress={() => void Linking.openSettings()} />}
                  />
                )}
              </View>

              <Card style={styles.manualCard}>
                <View style={styles.rowStart}>
                  <Barcode size={22} color={palette.cyan} />
                  <View style={styles.flexGap}>
                    <AppText variant="bodyStrong">Enter barcode numbers</AppText>
                    <AppText variant="caption" color={palette.textMuted}>
                      Enter the 8, 12, 13, or 14 digits printed below the barcode.
                    </AppText>
                  </View>
                </View>
                <FormField
                  label="UPC or GTIN"
                  value={manualBarcode}
                  onChangeText={(value) => {
                    setManualBarcode(value);
                    if (lookup) setLookup(undefined);
                    setIsScannerArmed(true);
                  }}
                  placeholder="Example: 012345678905"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={lookup?.state === 'invalid'
                    ? 'Enter a complete barcode with a valid check digit.'
                    : undefined}
                />
                <AppButton
                  label="Review product"
                  loading={isLookingUp}
                  disabled={!barcodeDigits(manualBarcode)}
                  onPress={() => void findProduct(manualBarcode)}
                />
              </Card>

              {lookup && lookup.state !== 'invalid' ? (
                <LookupState lookup={lookup} onRetry={resetScan} />
              ) : null}
            </>
          )}

          <AppText variant="caption" color={palette.textMuted} style={styles.centerText}>
            USDA branded-food records are submitted from product labels and may lag behind package changes. Always verify the current package label, especially for allergens.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LookupState({
  lookup,
  onRetry,
}: {
  lookup: ProductBarcodeLookup;
  onRetry: () => void;
}) {
  if (lookup.state === 'found' || lookup.state === 'invalid') return null;
  if (lookup.state === 'catalog-preparing') {
    return (
      <StatePanel
        loading
        title="Product catalog is downloading"
        message="The verified USDA catalog is downloading in the background. You can leave this screen and try again after preparation finishes."
      />
    );
  }
  if (lookup.state === 'catalog-unavailable') {
    return (
      <StatePanel
        icon={<TriangleAlert size={32} color={palette.amber} />}
        title="Product catalog unavailable"
        message={lookup.message ?? 'This build does not yet have a verified USDA branded catalog configured. The generic meal-estimation catalog is still available.'}
        action={<AppButton label="Try again" variant="secondary" onPress={onRetry} />}
      />
    );
  }
  return (
    <StatePanel
      icon={<Barcode size={32} color={palette.textMuted} />}
      title="Product not found"
      message="No current matching barcode was found in the downloaded USDA branded-food catalog. Check the digits and the package label."
      action={<AppButton label="Scan another" variant="secondary" onPress={onRetry} />}
    />
  );
}

function ProductResult({
  lookup,
  isLogging,
  lastSavedProductName,
  onLog,
  onReset,
}: {
  lookup: Extract<ProductBarcodeLookup, { state: 'found' }>;
  isLogging: boolean;
  lastSavedProductName?: string;
  onLog: (product: ProductBarcodeRecord, quantity: number) => Promise<void>;
  onReset: () => void;
}) {
  const { product } = lookup;
  const [quantityText, setQuantityText] = useState('1');
  const servingQuantity = normalizeServingQuantity(Number(quantityText));
  const selectedNutrition = useMemo(
    () => scaleProductNutrition(product.nutrition, servingQuantity ?? 1),
    [product.nutrition, servingQuantity],
  );
  const scores = useMemo(
    () => scoreProduct({
      productId: product.productId,
      nutrition: selectedNutrition,
      ingredients: product.ingredients,
    }),
    [product.ingredients, product.productId, selectedNutrition],
  );
  const importantIngredients = [
    ...scores.ingredientAnalysis.addedSugars,
    ...scores.ingredientAnalysis.refinedCarbohydrates,
    ...scores.ingredientAnalysis.wholeFoods,
    ...scores.ingredientAnalysis.processingSignals,
  ];
  return (
    <View style={styles.section}>
      <Card style={styles.productCard}>
        <View style={styles.productHeader}>
          <View style={styles.productImageWrap}>
            {product.imageUrl ? (
              <Image
                accessibilityLabel={`Package image for ${product.name}`}
                contentFit="contain"
                source={{ uri: product.imageUrl }}
                style={styles.productImage}
              />
            ) : (
              <View style={styles.imageUnavailable}>
                <ImageOff size={25} color={palette.textMuted} />
                <AppText variant="caption" color={palette.textMuted} style={styles.centerText}>
                  USDA image unavailable
                </AppText>
              </View>
            )}
          </View>
          <View style={styles.productCopy}>
            <AppText variant="title" color={palette.navy}>{product.name}</AppText>
            {product.brand ? <AppText color={palette.textMuted}>{product.brand}</AppText> : null}
            <AppText variant="caption" color={palette.textMuted}>GTIN {product.gtin14}</AppText>
            <AppText variant="caption" color={palette.textMuted}>
              Serving: {product.nutrition?.servingLabel ?? 'Not available in this USDA record'}
            </AppText>
          </View>
        </View>
      </Card>

      <Card style={styles.servingCard}>
        <AppText variant="subtitle">Serving quantity</AppText>
        <FormField
          label="Number of servings"
          value={quantityText}
          onChangeText={setQuantityText}
          placeholder="1"
          keyboardType="decimal-pad"
          error={servingQuantity === undefined
            ? 'Enter a quantity greater than 0 and no more than 20.'
            : undefined}
          helper={product.nutrition?.servingLabel
            ? `Scores and nutrition update from ${product.nutrition.servingLabel}.`
            : 'USDA did not provide enough serving information to scale nutrition.'}
        />
      </Card>

      <View style={styles.scoreGrid}>
        <ScoreCard
          title="Overall Food Score"
          result={scores.overallScore}
          helper="General nutritional quality"
        />
        <ScoreCard
          title="Estimated Glucose Impact"
          result={scores.glucoseImpactScore}
          helper="Higher means more glucose-friendly"
        />
      </View>

      <Card style={styles.processingCard}>
        <View style={styles.rowStart}>
          <ListChecks size={22} color={palette.purple} />
          <View style={styles.flexGap}>
            <AppText variant="label" color={palette.purple}>Processing level</AppText>
            <AppText variant="subtitle">
              {processingLevelLabel(scores.processingLevel)}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" color={palette.textMuted}>
          {scores.ingredientAnalysis.processingExplanation}
        </AppText>
        <AppText variant="caption" color={palette.textMuted}>
          Additives such as citric acid, lecithin, gums, preservatives, flavors, colors, and artificial sweeteners are not automatically labeled harmful or given standalone deductions.
        </AppText>
      </Card>

      <Card style={styles.highlightsCard}>
        <View style={styles.flexGap}>
          <AppText variant="subtitle">Key nutrition highlights</AppText>
          <AppText variant="caption" color={palette.textMuted}>
            Amounts for the selected serving quantity
          </AppText>
        </View>
        <View style={styles.highlightGrid}>
          {nutritionHighlightRows(selectedNutrition).map(({ label, value }) => (
            <View key={label} style={styles.highlightItem}>
              <AppText variant="caption" color={palette.textMuted}>{label}</AppText>
              <AppText
                variant="bodyStrong"
                color={value === 'Unavailable' ? palette.textMuted : palette.navy}>
                {value}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.nutritionCard}>
        <View style={styles.rowStart}>
          <Wheat size={22} color={palette.cyan} />
          <View style={styles.flexGap}>
            <AppText variant="subtitle">Nutrition Facts used</AppText>
            <AppText variant="caption" color={palette.textMuted}>
              {selectedNutrition?.servingLabel ?? 'Serving nutrition unavailable'}
            </AppText>
          </View>
        </View>
        <View style={styles.nutritionRows}>
          {nutritionFactRows(selectedNutrition).map(({ label, value }) => (
            <View key={label} style={styles.nutritionRow}>
              <AppText>{label}</AppText>
              <AppText variant="bodyStrong" color={value === 'Unavailable' ? palette.textMuted : palette.navy}>
                {value}
              </AppText>
            </View>
          ))}
        </View>
        {scores.estimatedNetCarbohydratesGrams !== undefined ? (
          <AppText variant="caption" color={palette.textMuted}>
            Estimated net carbohydrates: {formatNutritionNumber(scores.estimatedNetCarbohydratesGrams)} g. Fiber is subtracted; sugar alcohols are not subtracted.
          </AppText>
        ) : null}
      </Card>

      <Card style={styles.breakdownCard}>
        <AppText variant="subtitle">Why the scores changed</AppText>
        <ScoreBreakdown title="Overall Food Score" result={scores.overallScore} />
        <View style={styles.divider} />
        <ScoreBreakdown
          title="Estimated Glucose Impact"
          result={scores.glucoseImpactScore}
        />
      </Card>

      <Card style={styles.ingredientCard}>
        <AppText variant="subtitle">Ingredient analysis</AppText>
        {importantIngredients.length > 0 ? (
          <View style={styles.findingList}>
            {importantIngredients.map((finding) => (
              <View key={finding.id} style={styles.findingRow}>
                {finding.category === 'whole-food'
                  ? <CheckCircle2 size={19} color={palette.green} />
                  : <Info size={19} color={palette.cyan} />}
                <View style={styles.flexGap}>
                  <AppText variant="bodyStrong">{finding.ingredient}</AppText>
                  <AppText variant="caption" color={palette.textMuted}>
                    {finding.explanation} Position {finding.position} in the ingredient list.
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <AppText color={palette.textMuted}>
            {product.ingredients
              ? 'No ingredients matched the reviewed scoring categories.'
              : 'No ingredient list is available, so ingredient and processing analysis is limited.'}
          </AppText>
        )}
        <View style={styles.divider} />
        <AppText variant="label" color={palette.textMuted}>Full USDA ingredient list</AppText>
        <AppText color={product.ingredients ? palette.text : palette.textMuted}>
          {product.ingredients ?? 'No ingredient list is available in this USDA product record.'}
        </AppText>
        <View style={styles.divider} />
        <AppText variant="caption" color={palette.textMuted}>
          FoodData Central ID {product.fdcId} · record published {formatPublicationDate(product.publicationDate)}
        </AppText>
        <AppButton
          label="Open USDA record"
          variant="ghost"
          icon={<ExternalLink size={18} color={palette.text} />}
          onPress={() => void Linking.openURL(
            `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${product.fdcId}/nutrients`,
          )}
        />
      </Card>

      <Card style={styles.limitationCard}>
        <AppText variant="bodyStrong" color={palette.navy}>Important limitation</AppText>
        <AppText variant="caption" color={palette.textMuted}>
          These deterministic scores use available label nutrition and ingredient characteristics for general wellness information. Estimated glucose impact does not predict your individual response, determine whether a food is safe, or provide medical or treatment advice. Package data may be incomplete or outdated.
        </AppText>
      </Card>

      {lastSavedProductName ? (
        <Card style={styles.savedCard} accessibilityRole="summary">
          <PackageCheck size={21} color={palette.green} />
          <View style={styles.flexGap}>
            <AppText variant="bodyStrong" color={palette.green}>Product logged as a meal</AppText>
            <AppText variant="caption" color={palette.textMuted}>
              {lastSavedProductName} was saved with the reviewed serving quantity. Its GTIN is retained locally for future observed-response associations.
            </AppText>
          </View>
        </Card>
      ) : null}

      <AppButton
        label="Log product as a meal"
        loading={isLogging}
        disabled={servingQuantity === undefined}
        onPress={() => servingQuantity === undefined
          ? undefined
          : void onLog(product, servingQuantity)}
      />
      <AppButton label="Scan another product" variant="secondary" onPress={onReset} />
    </View>
  );
}

function ScoreCard({
  title,
  result,
  helper,
}: {
  title: string;
  result: FoodScoreResult;
  helper: string;
}) {
  const colors = scoreColors(result.score);
  return (
    <Card
      style={[styles.scoreCard, { backgroundColor: colors.background }]}
      accessibilityRole="summary"
      accessibilityLabel={result.score === undefined
        ? `${title}: not rated`
        : `${title}: ${result.score} out of 100, ${result.label}`}>
      <AppText variant="label" color={colors.foreground}>{title}</AppText>
      <AppText variant="display" color={colors.foreground}>
        {result.score === undefined ? '—' : result.score}
      </AppText>
      <AppText variant="bodyStrong" color={colors.foreground}>{result.label}</AppText>
      <AppText variant="caption" color={palette.textMuted}>{helper}</AppText>
    </Card>
  );
}

function ScoreBreakdown({ title, result }: { title: string; result: FoodScoreResult }) {
  return (
    <View style={styles.breakdownSection}>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText variant="caption" color={palette.textMuted}>{result.summary}</AppText>
      {result.baseline !== undefined ? (
        <AppText variant="caption" color={palette.textMuted}>
          Starting baseline: {result.baseline} points.
        </AppText>
      ) : null}
      {result.negativeContributions.length > 0 ? (
        <ContributionList title="Score lowered by" contributions={result.negativeContributions} />
      ) : null}
      {result.positiveContributions.length > 0 ? (
        <ContributionList title="Score improved by" contributions={result.positiveContributions} />
      ) : null}
      {result.unavailableData.length > 0 ? (
        <AppText variant="caption" color={palette.textMuted}>
          Unavailable and not scored: {result.unavailableData.join(', ')}.
        </AppText>
      ) : null}
    </View>
  );
}

function ContributionList({
  title,
  contributions,
}: {
  title: string;
  contributions: readonly ScoreContribution[];
}) {
  return (
    <View style={styles.contributionSection}>
      <AppText variant="label" color={palette.textMuted}>{title}</AppText>
      {contributions.map((item) => (
        <View key={item.id} style={styles.contributionRow}>
          <AppText
            variant="bodyStrong"
            color={item.value < 0 ? palette.amber : palette.green}
            style={styles.contributionPoints}>
            {item.value > 0 ? `+${item.value}` : item.value}
          </AppText>
          <View style={styles.flexGap}>
            <AppText variant="bodyStrong">{item.label}</AppText>
            <AppText variant="caption" color={palette.textMuted}>{item.explanation}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

function nutritionFactRows(nutrition: ReturnType<typeof scaleProductNutrition>) {
  return [
    { label: 'Calories', value: nutritionValue(nutrition?.calories) },
    { label: 'Total carbohydrate', value: nutritionValue(nutrition?.totalCarbohydratesGrams, 'g') },
    { label: 'Dietary fiber', value: nutritionValue(nutrition?.dietaryFiberGrams, 'g') },
    { label: 'Total sugar', value: nutritionValue(nutrition?.totalSugarGrams, 'g') },
    { label: 'Added sugar', value: nutritionValue(nutrition?.addedSugarGrams, 'g') },
    { label: 'Protein', value: nutritionValue(nutrition?.proteinGrams, 'g') },
    { label: 'Total fat', value: nutritionValue(nutrition?.totalFatGrams, 'g') },
    { label: 'Saturated fat', value: nutritionValue(nutrition?.saturatedFatGrams, 'g') },
    { label: 'Trans fat', value: nutritionValue(nutrition?.transFatGrams, 'g') },
    { label: 'Sodium', value: nutritionValue(nutrition?.sodiumMilligrams, 'mg') },
  ];
}

function nutritionHighlightRows(nutrition: ReturnType<typeof scaleProductNutrition>) {
  return [
    { label: 'Total carbs', value: nutritionValue(nutrition?.totalCarbohydratesGrams, 'g') },
    { label: 'Fiber', value: nutritionValue(nutrition?.dietaryFiberGrams, 'g') },
    { label: 'Added sugar', value: nutritionValue(nutrition?.addedSugarGrams, 'g') },
    { label: 'Protein', value: nutritionValue(nutrition?.proteinGrams, 'g') },
  ];
}

function nutritionValue(value: number | undefined, unit = 'kcal'): string {
  return value === undefined ? 'Unavailable' : `${formatNutritionNumber(value)} ${unit}`;
}

function formatNutritionNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function processingLevelLabel(level: ProductProcessingLevel): string {
  if (level === 'minimal') return 'Minimally processed';
  if (level === 'moderate') return 'Moderately processed';
  if (level === 'high') return 'Highly processed';
  return 'Not enough ingredient data';
}

function scoreColors(score: number | undefined) {
  if (score === undefined) {
    return { foreground: palette.textMuted, background: palette.surfaceMuted };
  }
  if (score >= 80) return { foreground: palette.green, background: palette.greenSoft };
  if (score >= 60) return { foreground: palette.blue, background: palette.blueSoft };
  if (score >= 40) return { foreground: palette.amber, background: palette.amberSoft };
  return { foreground: palette.red, background: palette.redSoft };
}

function formatPublicationDate(value: string): string {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(timestamp);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  flexGap: { flex: 1, gap: spacing.xs },
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  headerSpacer: { width: 44 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  section: { gap: spacing.md },
  introCard: { gap: spacing.md, backgroundColor: palette.blueSoft },
  rowStart: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrap: {
    minHeight: 300,
    overflow: 'hidden',
    borderRadius: radii.sm,
    backgroundColor: palette.navy,
  },
  camera: { minHeight: 300 },
  cameraOverlay: {
    pointerEvents: 'none',
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: 'rgba(16, 42, 67, 0.18)',
  },
  scanFrame: {
    width: '82%',
    maxWidth: 360,
    height: 128,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: radii.sm,
  },
  cameraHint: {
    backgroundColor: 'rgba(16, 42, 67, 0.82)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: 'center',
    overflow: 'hidden',
  },
  manualCard: { gap: spacing.lg },
  productCard: { gap: spacing.lg },
  productHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  productCopy: { flex: 1, gap: spacing.xs },
  productImageWrap: {
    width: 104,
    height: 104,
    overflow: 'hidden',
    borderRadius: radii.sm,
    backgroundColor: palette.surfaceMuted,
  },
  productImage: { width: '100%', height: '100%' },
  imageUnavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.border },
  servingCard: { gap: spacing.md },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  scoreCard: {
    flex: 1,
    minWidth: 145,
    gap: spacing.xs,
  },
  processingCard: { gap: spacing.md, backgroundColor: palette.purpleSoft },
  highlightsCard: { gap: spacing.md },
  highlightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  highlightItem: {
    minWidth: 118,
    flexGrow: 1,
    flexBasis: '45%',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: palette.surfaceMuted,
  },
  nutritionCard: { gap: spacing.lg },
  nutritionRows: { gap: spacing.sm },
  nutritionRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  breakdownCard: { gap: spacing.lg },
  breakdownSection: { gap: spacing.md },
  contributionSection: { gap: spacing.sm },
  contributionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  contributionPoints: { width: 34, textAlign: 'right' },
  ingredientCard: { gap: spacing.lg },
  findingList: { gap: spacing.md },
  findingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  limitationCard: { gap: spacing.sm, backgroundColor: palette.surfaceMuted },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: palette.greenSoft,
  },
  centerText: { textAlign: 'center', paddingHorizontal: spacing.md },
});

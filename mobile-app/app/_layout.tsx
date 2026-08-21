import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { palette } from '@/constants/design';
import { FormKeyboardAccessory } from '@/components/ui/form-keyboard-accessory';
import { AppDataProvider } from '@/providers/app-data-provider';
import { LocalMealModelProvider } from '@/providers/local-meal-model-provider';
import { NutritionCatalogProvider } from '@/providers/nutrition-catalog-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: palette.blue,
      background: palette.background,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
      notification: palette.red,
    },
  };

  return (
    <SafeAreaProvider>
      <LocalMealModelProvider>
        <NutritionCatalogProvider>
          <AppDataProvider>
            <ThemeProvider value={navigationTheme}>
              <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background } }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="meal/[id]"
                  options={{ presentation: 'modal', headerShown: false, gestureEnabled: false }}
                />
                <Stack.Screen name="check-ins" options={{ headerShown: false }} />
                <Stack.Screen
                  name="check-in/[id]"
                  options={{ presentation: 'modal', headerShown: false, gestureEnabled: false }}
                />
                <Stack.Screen
                  name="medication/[id]"
                  options={{ presentation: 'modal', headerShown: false, gestureEnabled: false }}
                />
                <Stack.Screen
                  name="product-scan"
                  options={{ presentation: 'modal', headerShown: false }}
                />
              </Stack>
              <FormKeyboardAccessory />
              <StatusBar style="dark" />
            </ThemeProvider>
          </AppDataProvider>
        </NutritionCatalogProvider>
      </LocalMealModelProvider>
    </SafeAreaProvider>
  );
}

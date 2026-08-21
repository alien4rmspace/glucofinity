import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { palette, radii, spacing } from '@/constants/design';
import { AppText } from './app-text';
import { FORM_KEYBOARD_ACCESSORY_ID } from './form-keyboard-accessory';

interface FormFieldProps extends TextInputProps {
  label: string;
  helper?: string;
  error?: string;
}

export function FormField({
  label,
  helper,
  error,
  style,
  inputAccessoryViewID,
  ...props
}: FormFieldProps) {
  return (
    <View style={styles.group}>
      <AppText variant="bodyStrong">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        inputAccessoryViewID={inputAccessoryViewID ?? (
          Platform.OS === 'ios' ? FORM_KEYBOARD_ACCESSORY_ID : undefined
        )}
        placeholderTextColor={palette.textMuted}
        {...props}
        style={[styles.input, props.multiline && styles.multiline, error && styles.inputError, style]}
      />
      {error ? (
        <AppText variant="caption" color={palette.red}>
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color={palette.textMuted}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

export function FormRow({ children }: PropsWithChildren) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    flex: 1,
    gap: spacing.sm,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.sm,
    backgroundColor: palette.surface,
    color: palette.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: palette.red,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});

import { StyleSheet } from "react-native";

// Theme constants for consistent styling
export const theme = {
  colors: {
    primary: "#007bff",
    primaryLight: "#81b0ff",
    secondary: "#6c757d",
    danger: "#dc3545",
    success: "#28a745",
    background: "#f8f9fa",
    card: "#ffffff",
    text: "#343a40",
    textSecondary: "#495057",
    textMuted: "#6c757d",
    border: "#ced4da",
    borderLight: "#e9ecef",
    disabled: "#adb5bd",
  },
  spacing: {
    xs: 5,
    sm: 8,
    md: 10,
    lg: 15,
    xl: 20,
    xxl: 25,
    section: 20,
  },
  radius: {
    sm: 3,
    md: 5,
    lg: 10,
    circle: 25,
  },
  typography: {
    title: {
      fontSize: 26,
      fontWeight: "bold" as const,
    },
    heading: {
      fontSize: 18,
      fontWeight: "bold" as const,
    },
    label: {
      fontSize: 16,
      fontWeight: "600" as const,
    },
    body: {
      fontSize: 15,
    },
    small: {
      fontSize: 12,
    },
  },
  shadows: {
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 3,
    },
    elevated: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
  },
  buttons: {
    primary: {
      backgroundColor: "#007bff",
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 5,
    },
    secondary: {
      backgroundColor: "#6c757d",
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 5,
    },
    danger: {
      backgroundColor: "#dc3545",
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 5,
    },
  },
};

export const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 30,
  },
  scrollContent: {
    padding: theme.spacing.xl,
    paddingBottom: 50,
  },
  section: {
    marginBottom: theme.spacing.section,
  },

  // Typography
  title: {
    ...theme.typography.title,
    marginBottom: theme.spacing.xxl,
    textAlign: "center",
    color: theme.colors.text,
  },
  label: {
    ...theme.typography.label,
    marginBottom: theme.spacing.sm,
    color: theme.colors.textSecondary,
  },
  activeText: {
    fontWeight: "bold",
    color: theme.colors.primary,
  },
  inactiveText: {
    color: theme.colors.textMuted,
  },
  disabledText: {
    color: theme.colors.disabled,
  },
  resultText: {
    ...theme.typography.body,
    color: theme.colors.text,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },

  // Components
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.xs,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    minHeight: 50,
  },
  statusText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.xs,
  },
  buttonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
  },
  picker: {
    height: 50,
  },

  // History section
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  historyButtons: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  historyList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
  },
  historyItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  historyQuestion: {
    ...theme.typography.body,
    fontWeight: "500",
    marginBottom: 3,
  },
  historyTimestamp: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  historyEmptyText: {
    textAlign: "center",
    marginTop: 15,
    color: theme.colors.textMuted,
    fontStyle: "italic",
  },

  // Connection status
  connectionStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  connectionStatusTextContainer: {
    flex: 1,
  },
  connectionStatusText: {
    color: "white",
    fontWeight: "bold",
  },
  connectionStatusSubtext: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: theme.typography.small.fontSize,
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  reconnectButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    marginLeft: theme.spacing.md,
  },
  reconnectButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: theme.typography.small.fontSize,
  },

  // Form elements
  textArea: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: 14,
    textAlignVertical: "top",
    backgroundColor: theme.colors.card,
    minHeight: 60,
  },
  loader: {
    marginLeft: theme.spacing.xs,
  },
  loadingText: {
    fontSize: 14,
    marginLeft: theme.spacing.xs,
    color: theme.colors.textSecondary,
  },

  // Floating action button
  scrollTopButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    backgroundColor: theme.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.elevated,
  },
  scrollTopButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },

  // Custom button styles
  customButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.default,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.secondary,
  },
  buttonDanger: {
    backgroundColor: theme.colors.danger,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },

  // Card styles for consistent elevation and appearance
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: theme.spacing.md,
    ...theme.shadows.default,
  },
  cardTitle: {
    ...theme.typography.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },

  // Form inputs with consistent styling
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    fontSize: 16,
    color: theme.colors.text,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  inputLabel: {
    ...theme.typography.label,
    marginBottom: theme.spacing.xs,
    color: theme.colors.textSecondary,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    marginTop: theme.spacing.xs,
  },
});

export const markdownStyles = StyleSheet.create({
  body: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  heading1: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    color: "#0056b3",
  },
  heading2: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    color: "#0056b3",
  },
  list_item: { marginBottom: theme.spacing.xs },
  bullet_list: { marginLeft: theme.spacing.lg },
  ordered_list: { marginLeft: theme.spacing.lg },
  code_inline: {
    backgroundColor: theme.colors.borderLight,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    fontFamily: "monospace",
  },
  code_block: {
    backgroundColor: theme.colors.borderLight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    fontFamily: "monospace",
    marginVertical: theme.spacing.xs,
  },
  fence: {
    backgroundColor: theme.colors.borderLight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    fontFamily: "monospace",
    marginVertical: theme.spacing.xs,
  },
});

import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingTop: 20,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 25,
    textAlign: "center",
    color: "#343a40",
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#495057",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  activeText: {
    fontWeight: "bold",
    color: "#007bff",
  },
  inactiveText: {
    color: "#6c757d",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    marginBottom: 15,
    backgroundColor: "#e9ecef",
    borderRadius: 5,
    minHeight: 50,
  },
  statusText: {
    fontSize: 16,
    color: "#495057",
    marginRight: 5,
  },
  buttonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: 20,
    gap: 10,
  },
  resultText: {
    fontSize: 15,
    color: "#212529",
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ced4da",
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  picker: {
    height: 50,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  historyButtons: {
    flexDirection: "row",
    gap: 10, // Add gap between buttons
  },
  historyList: {
    maxHeight: 200, // Limit height to prevent taking too much space
    borderWidth: 1,
    borderColor: "#e9ecef",
    borderRadius: 4,
    backgroundColor: "#fff", // White background for the list
  },
  historyItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  historyQuestion: {
    fontSize: 14,
    fontWeight: "500", // Medium weight
    marginBottom: 3,
  },
  historyTimestamp: {
    fontSize: 12,
    color: "#6c757d", // Grey color for timestamp
  },
  historyEmptyText: {
    textAlign: "center",
    marginTop: 15,
    color: "#6c757d",
    fontStyle: "italic",
  },
  // Connection status styles
  connectionStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
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
    fontSize: 12,
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  reconnectButton: {
    backgroundColor: "#007bff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 10,
  },
  reconnectButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#ced4da",
    borderRadius: 4,
    padding: 10,
    fontSize: 14,
    textAlignVertical: "top",
    backgroundColor: "#fff",
    minHeight: 60,
  },
  loader: {
    marginLeft: 5,
  },
  loadingText: {
    fontSize: 14,
    marginLeft: 5,
    color: "#495057",
  },
  disabledText: {
    color: "#adb5bd",
  },
});

export const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    color: "#212529",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  heading1: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
    color: "#0056b3",
  },
  heading2: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 4,
    color: "#0056b3",
  },
  list_item: { marginBottom: 5 },
  bullet_list: { marginLeft: 15 },
  ordered_list: { marginLeft: 15 },
  code_inline: {
    backgroundColor: "#e9ecef",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: "monospace",
  },
  code_block: {
    backgroundColor: "#e9ecef",
    padding: 10,
    borderRadius: 4,
    fontFamily: "monospace",
    marginVertical: 5,
  },
  fence: {
    backgroundColor: "#e9ecef",
    padding: 10,
    borderRadius: 4,
    fontFamily: "monospace",
    marginVertical: 5,
  },
});

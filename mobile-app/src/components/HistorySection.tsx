import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { styles, markdownStyles, theme } from "../screens/MainScreen.style";
import { HistoryEntry } from "../types/history";
import Markdown from "react-native-markdown-display";

interface HistorySectionProps {
  history: HistoryEntry[];
  showHistory: boolean;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  onClearHistory: () => void;
}

const HistorySection: React.FC<HistorySectionProps> = ({
  history,
  showHistory,
  setShowHistory,
  onClearHistory,
}) => {
  const [selectedItem, setSelectedItem] = useState<HistoryEntry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Reset selected item when history changes
  useEffect(() => {
    if (history.length === 0) {
      setSelectedItem(null);
      setModalVisible(false);
    }
  }, [history]);

  const handleItemPress = (item: HistoryEntry) => {
    console.log("Item pressed:", JSON.stringify(item, null, 2));
    setSelectedItem(item);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedItem(null), 300); // Clear selected item after modal animation completes
  };

  const renderHistoryItem = ({ item }: { item: HistoryEntry }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => handleItemPress(item)}
    >
      <Text style={styles.historyQuestion} numberOfLines={2}>
        Q: {item.question}
      </Text>
      <Text style={styles.historyTimestamp}>
        {new Date(item.timestamp).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  const handleToggleHistory = () => {
    setShowHistory(!showHistory);
  };

  return (
    <View style={styles.section}>
      <View style={styles.historyHeader}>
        <Text style={styles.label}>History</Text>
        <View style={styles.historyButtons}>
          <TouchableOpacity
            style={[
              styles.customButton,
              styles.buttonPrimary,
              { paddingVertical: theme.spacing.xs },
              history.length === 0 && { opacity: 0.6 },
            ]}
            onPress={handleToggleHistory}
            disabled={history.length === 0}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>
              {showHistory ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.customButton,
              styles.buttonDanger,
              { paddingVertical: theme.spacing.xs },
              history.length === 0 && { opacity: 0.6 },
            ]}
            onPress={onClearHistory}
            disabled={history.length === 0}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>
      {showHistory && history.length > 0 && (
        <View style={{ height: 200 }}>
          <FlatList
            data={history}
            renderItem={renderHistoryItem}
            keyExtractor={(item) => item.id}
            style={styles.historyList}
          />
        </View>
      )}
      {showHistory && history.length === 0 && (
        <Text style={styles.historyEmptyText}>No history saved yet.</Text>
      )}

      {/* History Detail Modal with Markdown Support */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={modalStyles.centeredView}>
          <View style={modalStyles.modalView}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.modalTitle}>History Detail</Text>
              <TouchableOpacity
                onPress={closeModal}
                style={modalStyles.closeButton}
              >
                <Text style={modalStyles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedItem ? (
              <ScrollView
                style={modalStyles.content}
                contentContainerStyle={modalStyles.contentContainer}
              >
                <View style={modalStyles.section}>
                  <Text style={modalStyles.questionLabel}>Question:</Text>
                  <Text style={modalStyles.questionText}>
                    {selectedItem.question || "No question available"}
                  </Text>
                </View>

                <View style={modalStyles.section}>
                  <Text style={modalStyles.answerLabel}>Answer:</Text>
                  {selectedItem.answer ? (
                    <View style={modalStyles.markdownContainer}>
                      <Markdown style={markdownStyles}>
                        {selectedItem.answer}
                      </Markdown>
                    </View>
                  ) : (
                    <Text>No answer available</Text>
                  )}
                </View>
              </ScrollView>
            ) : (
              <Text style={modalStyles.errorText}>No item selected</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const { width, height } = Dimensions.get("window");

const modalStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    ...theme.shadows.elevated,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    paddingBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: theme.typography.heading.fontSize,
    fontWeight: "bold",
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    maxHeight: height * 0.6,
  },
  contentContainer: {
    paddingBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  questionLabel: {
    fontSize: theme.typography.label.fontSize,
    fontWeight: "bold",
    marginBottom: theme.spacing.xs,
    color: theme.colors.primary,
  },
  questionText: {
    fontSize: theme.typography.body.fontSize,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  answerLabel: {
    fontSize: theme.typography.label.fontSize,
    fontWeight: "bold",
    marginBottom: theme.spacing.xs,
    color: theme.colors.primary,
  },
  markdownContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    overflow: "hidden",
  },
  errorText: {
    color: theme.colors.danger,
    textAlign: "center",
    padding: theme.spacing.xl,
  },
});

export default HistorySection;

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import { styles, markdownStyles, theme } from "../screens/MainScreen.style";

interface QuestionAnswerDisplayProps {
  questionText: string;
  answerText: string;
}

const QuestionAnswerDisplay: React.FC<QuestionAnswerDisplayProps> = ({
  questionText,
  answerText,
}) => {
  return (
    <>
      {/* Question Area */}
      {questionText ? (
        <View style={styles.section}>
          <View style={qaStyles.header}>
            <Text style={styles.label}>Question:</Text>
          </View>
          <Text style={styles.resultText}>{questionText}</Text>
        </View>
      ) : null}

      {/* Answer Area */}
      {answerText ? (
        <View style={styles.section}>
          <Text style={styles.label}>Answer:</Text>
          <View style={qaStyles.markdownWrapper}>
            <Markdown style={markdownStyles}>{answerText}</Markdown>
          </View>
        </View>
      ) : null}
    </>
  );
};

const qaStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  markdownWrapper: {
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
});

export default QuestionAnswerDisplay;

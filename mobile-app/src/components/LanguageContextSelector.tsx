import React from "react";
import { View, Text, Switch, TextInput } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { styles, theme } from "../screens/MainScreen.style";
import { Language, QuestionContext } from "../types/interfaces";

interface LanguageContextSelectorProps {
  language: Language;
  setLanguage: React.Dispatch<React.SetStateAction<Language>>;
  questionContext: QuestionContext;
  setQuestionContext: React.Dispatch<React.SetStateAction<QuestionContext>>;
  customContext: string;
  setCustomContext: React.Dispatch<React.SetStateAction<string>>;
}

const LanguageContextSelector: React.FC<LanguageContextSelectorProps> = ({
  language,
  setLanguage,
  questionContext,
  setQuestionContext,
  customContext,
  setCustomContext,
}) => {
  return (
    <>
      {/* Language Selection */}
      <View style={styles.section}>
        <Text style={styles.label}>Language:</Text>
        <View style={styles.switchContainer}>
          <Text
            style={language === "en" ? styles.activeText : styles.inactiveText}
          >
            English
          </Text>
          <Switch
            value={language === "vi"}
            onValueChange={(value) => setLanguage(value ? "vi" : "en")}
            trackColor={{
              false: theme.colors.secondary,
              true: theme.colors.primaryLight,
            }}
            thumbColor={language === "vi" ? theme.colors.primary : "#f4f3f4"}
            ios_backgroundColor={theme.colors.borderLight}
          />
          <Text
            style={language === "vi" ? styles.activeText : styles.inactiveText}
          >
            Vietnamese
          </Text>
        </View>
      </View>

      {/* Context Selection */}
      <View style={styles.section}>
        <Text style={styles.label}>Question Context:</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={questionContext}
            onValueChange={(value) =>
              setQuestionContext(value as QuestionContext)
            }
            style={styles.picker}
            dropdownIconColor={theme.colors.primary}
          >
            <Picker.Item label="General" value="general" />
            <Picker.Item label="Interview" value="interview" />
            <Picker.Item
              label="HTML/CSS/JavaScript"
              value="html/css/javascript"
            />
            <Picker.Item label="TypeScript" value="typescript" />
            <Picker.Item label="React.js" value="reactjs" />
            <Picker.Item label="Next.js" value="nextjs" />
          </Picker>
        </View>
      </View>

      {/* Custom Context */}
      <View style={styles.section}>
        <Text style={styles.label}>Custom Context:</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Enter custom context instructions for the AI..."
          placeholderTextColor={theme.colors.disabled}
          value={customContext}
          onChangeText={setCustomContext}
          multiline={true}
          numberOfLines={3}
        />
      </View>
    </>
  );
};

export default LanguageContextSelector;

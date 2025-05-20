import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Language, QuestionContext } from "../types/interfaces";

export const usePreferences = () => {
  const [language, setLanguage] = useState<Language>("en");
  const [questionContext, setQuestionContext] =
    useState<QuestionContext>("general");
  const [customContext, setCustomContext] = useState<string>("");

  // Load preferences on initial mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedLang = await AsyncStorage.getItem("language");
        const savedQContext = await AsyncStorage.getItem("questionContext");
        const savedCustomCtx = await AsyncStorage.getItem("customContext");

        if (savedLang) setLanguage(savedLang as Language);
        if (savedQContext) setQuestionContext(savedQContext as QuestionContext);
        if (savedCustomCtx) setCustomContext(savedCustomCtx);

        console.log("Preferences loaded");
      } catch (e) {
        console.error("Failed to load preferences:", e);
      }
    };

    loadPreferences();
  }, []);

  // Save preferences when they change
  useEffect(() => {
    const savePreferences = async () => {
      try {
        await AsyncStorage.setItem("language", language);
        await AsyncStorage.setItem("questionContext", questionContext);
        await AsyncStorage.setItem("customContext", customContext);
      } catch (e) {
        console.error("Failed to save preferences:", e);
      }
    };

    savePreferences();
  }, [language, questionContext, customContext]);

  return {
    language,
    setLanguage,
    questionContext,
    setQuestionContext,
    customContext,
    setCustomContext,
  };
};

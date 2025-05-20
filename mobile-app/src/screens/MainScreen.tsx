import React, { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  SafeAreaView,
  Alert,
  Button,
  SectionList,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useSocket } from "../hooks/useSocket";
import {
  Status,
  ConnectionResult,
  Language,
  QuestionContext,
} from "../types/interfaces";
import { checkConnection } from "../utils/connectionHelper";

// Import custom hooks
import { usePreferences } from "../hooks/usePreferences";
import { useHistoryManager } from "../hooks/useHistoryManager";
import { useSocketEvents } from "../hooks/useSocketEvents";
import { useRecordingActions } from "../hooks/useRecordingActions";

// Import components
import ConnectionStatus from "../components/ConnectionStatus";
import AudioDeviceSelector from "../components/AudioDeviceSelector";
import LanguageContextSelector from "../components/LanguageContextSelector";
import StatusDisplay from "../components/StatusDisplay";
import FollowUpToggle from "../components/FollowUpToggle";
import ControlButtons from "../components/ControlButtons";
import QuestionAnswerDisplay from "../components/QuestionAnswerDisplay";
import HistorySection from "../components/HistorySection";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Import styles
import { styles } from "./MainScreen.style";
import { MaterialIcons } from "@expo/vector-icons";

const MainScreen: React.FC = () => {
  // --- State Variables ---
  const [status, setStatus] = useState<Status>("idle");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Processing...");
  const [isFollowUp, setIsFollowUp] = useState<boolean>(false);
  const [canFollowUp, setCanFollowUp] = useState<boolean>(false);
  const [canRetry, setCanRetry] = useState<boolean>(false);
  const [canUseGemini, setCanUseGemini] = useState<boolean>(false);
  const [canCancel, setCanCancel] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionResult | null>(null);
  const [questionText, setQuestionText] = useState<string>("");
  const [answerText, setAnswerText] = useState<string>("");
  const [lastAudioFile, setLastAudioFile] = useState<string | null>(null);
  const [showScrollTopButton, setShowScrollTopButton] =
    useState<boolean>(false);

  // --- Refs ---
  const sectionListRef = useRef<SectionList<any>>(null);

  // --- Custom Hooks ---
  const { socketInstance, isConnected } = useSocket();

  // Preferences hook
  const {
    language,
    setLanguage,
    questionContext,
    setQuestionContext,
    customContext,
    setCustomContext,
  } = usePreferences();

  // History hook
  const {
    history,
    showHistory,
    setShowHistory,
    addEntryToHistory,
    handleClearHistory,
  } = useHistoryManager(language, questionContext, customContext);

  // Debug logging
  useEffect(() => {
    console.log(
      `History entries: ${history.length}, showHistory: ${showHistory}`
    );
  }, [history, showHistory]);

  // Socket events hook
  const { isCancelledRef, getLastEventData } = useSocketEvents({
    socketInstance,
    setIsLoading,
    setCanCancel,
    setQuestionText,
    setAnswerText,
    setLastAudioFile,
    setCanRetry,
    setCanUseGemini,
    setCanFollowUp,
    setIsFollowUp,
    addEntryToHistory,
    questionText,
    answerText,
  });

  // Recording actions hook
  const {
    isRecording,
    permissionResponse,
    audioDevices,
    selectedDeviceId,
    setAudioDevice,
    refreshAudioDevices,
    audioSource,
    setAudioSource,
    isSystemAudioSupported,
    handleReconnectSocket,
    handleToggleRecording,
    handleRetry,
    handleGemini,
    handleCancel,
  } = useRecordingActions({
    language,
    questionContext,
    customContext,
    isFollowUp,
    setIsLoading,
    setLoadingMessage,
    setCanCancel,
    setStatus,
    setQuestionText,
    setAnswerText,
    setCanRetry,
    setCanUseGemini,
    setLastAudioFile,
    setCanFollowUp,
    setIsFollowUp,
    setConnectionStatus,
    lastAudioFile,
    canRetry,
    canUseGemini,
    canCancel,
    isCancelledRef,
  });

  useEffect(() => {
    // Load Preferences & Initial Status & History
    const loadInitialData = async () => {
      // Load preferences
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

      // Check connection to backend server
      const connection = await checkConnection();
      setConnectionStatus(connection);
      console.log("Connection check result:", connection);

      if (!connection.success) {
        Alert.alert(
          "Connection Error",
          `Could not connect to the backend server: ${connection.message}. Please check your network connection and server status.`,
          [
            {
              text: "View Details",
              onPress: () => {
                Alert.alert(
                  "Connection Details",
                  JSON.stringify(connection, null, 2),
                  [{ text: "OK" }]
                );
              },
            },
            {
              text: "Retry",
              onPress: loadInitialData,
            },
            {
              text: "OK",
            },
          ]
        );
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!isConnected) setStatus("connecting");
    else if (isRecording) setStatus("recording");
    else if (isLoading) setStatus("processing");
    else setStatus("idle");
  }, [isConnected, isRecording, isLoading]);

  const sections = [
    {
      key: "main",
      data: [{}], // Single item for the main content
      renderItem: () => (
        <>
          <Text style={styles.title}>Audio Listener AI</Text>

          {__DEV__ && (
            <ConnectionStatus
              connectionStatus={connectionStatus}
              setConnectionStatus={setConnectionStatus}
              isConnected={isConnected}
              socketId={socketInstance?.id}
            />
          )}

          <View style={styles.section}>
            <AudioDeviceSelector
              audioDevices={audioDevices}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={setAudioDevice}
              refreshDevices={refreshAudioDevices}
              audioSource={audioSource}
              onSelectSource={setAudioSource}
              isSystemAudioSupported={isSystemAudioSupported}
            />
          </View>

          <LanguageContextSelector
            language={language}
            setLanguage={setLanguage}
            questionContext={questionContext}
            setQuestionContext={setQuestionContext}
            customContext={customContext}
            setCustomContext={setCustomContext}
          />

          <StatusDisplay
            status={status}
            permissionGranted={permissionResponse?.status === "granted"}
            isLoading={isLoading}
            loadingMessage={loadingMessage}
            isConnected={isConnected}
            onReconnect={handleReconnectSocket}
          />

          <FollowUpToggle
            isFollowUp={isFollowUp}
            setIsFollowUp={setIsFollowUp}
            canFollowUp={canFollowUp}
          />

          <ControlButtons
            isRecording={isRecording}
            isLoading={isLoading}
            isConnected={isConnected}
            permissionGranted={permissionResponse?.status === "granted"}
            canRetry={canRetry}
            canUseGemini={canUseGemini}
            canCancel={canCancel}
            onToggleRecording={handleToggleRecording}
            onRetry={handleRetry}
            onGemini={handleGemini}
            onCancel={handleCancel}
          />

          <QuestionAnswerDisplay
            questionText={questionText}
            answerText={answerText}
          />
        </>
      ),
    },
    {
      key: "history",
      data: [{}], // Single item for history section
      renderItem: () => (
        <HistorySection
          history={history}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          onClearHistory={handleClearHistory}
        />
      ),
    },
  ];

  const scrollToTop = () => {
    sectionListRef.current?.scrollToLocation({
      animated: true,
      itemIndex: 0,
      sectionIndex: 0,
      viewOffset: 0,
    });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY > 300) {
      setShowScrollTopButton(true);
    } else {
      setShowScrollTopButton(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        ref={sectionListRef}
        sections={sections}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.scrollContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={() => null}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
      {showScrollTopButton && (
        <TouchableOpacity
          onPress={scrollToTop}
          style={styles.scrollTopButton}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-upward" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

export default MainScreen;

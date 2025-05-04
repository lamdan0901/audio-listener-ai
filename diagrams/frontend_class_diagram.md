# Frontend Class Diagram

```mermaid
classDiagram
    %% Shared Components
    class AudioControls {
        -isRecording: boolean
        -isCancelled: boolean
        -hasLastQuestion: boolean
        -originalQuestion: string
        +toggleRecording()
        +retryTranscription()
        +processWithGemini()
        +cancelRequest()
        +updateUI(state)
    }
    
    class SocketHandlers {
        -socket: Socket
        +initSocketHandlers(socket)
        +handleProcessing()
        +handleTranscript(data)
        +handleUpdate(data)
        +handleStreamChunk(data)
        +handleStreamEnd(data)
        +handleError(errorMessage)
        +handleProcessingCancelled(data)
    }
    
    class Animation {
        -streamedContent: string
        -previousContent: string
        -animationQueue: string[]
        -animationInProgress: boolean
        +queueAnimation(content)
        +processNextAnimation()
        +updateContentSmoothly(contentElement, newContent)
        +appendCursor(element)
    }
    
    class HistoryManager {
        -historyItems: HistoryItem[]
        +saveToHistory(question, answer, language, context)
        +loadHistory()
        +clearHistory()
        +displayHistory()
        +displayHistoryItem(item)
    }
    
    class MarkdownUtils {
        +renderMarkdown(text)
        +sanitizeHTML(html)
    }
    
    %% Desktop App Components
    class AudioDeviceManager {
        -currentAudioSource: string
        +initializeAudioDevices()
        +refreshAudioDevices()
        +selectAudioDevice(deviceId)
        +selectAudioSource(sourceType)
        +isSystemAudioSupported()
    }
    
    class AudioRecorder {
        -mediaRecorder: MediaRecorder
        -recordingStream: MediaStream
        -audioChunks: Blob[]
        -selectedDeviceId: string
        -audioSource: string
        +startRecording()
        +stopRecording()
        +getRecordedAudio()
        +setAudioDevice(deviceId)
        +getSelectedAudioDevice()
        +setAudioSource(source)
        +getAudioSource()
        +getSupportedMimeType()
    }
    
    class SocketClient {
        -socket: Socket
        -serverUrl: string
        -isConnected: boolean
        +connect(url)
        +disconnect()
        +getSocket()
        +isSocketConnected()
        +addDebugLog(message, type)
    }
    
    %% Mobile App Components
    class useAudioRecorder {
        -recordingInstance: Recording
        -isRecording: boolean
        -permissionResponse: PermissionResponse
        -recordingOptions: RecordingOptions
        +startRecording()
        +stopRecording()
        +getPermissionStatus()
    }
    
    class useSocket {
        -socketRef: Socket
        -isConnected: boolean
        +getSocketInstance()
        +getConnectionStatus()
    }
    
    class APIService {
        -API_BASE_URL: string
        +startRecordingApi(params)
        +stopRecordingApi(audioUri, params)
        +retryTranscriptionApi(params)
        +processWithGeminiApi(params)
        +cancelProcessingApi()
        +uploadAudioFile(uri, endpoint, params)
    }
    
    %% Chrome Extension Components
    class BackgroundScript {
        -socket: Socket
        -isRecording: boolean
        -lastAudioFile: string
        -hasLastQuestion: boolean
        -currentStatusText: string
        -lastQuestionPreview: string
        -currentOperationAbortController: AbortController
        +connectSocketIO()
        +makeApiRequest(endpoint, options, signal)
        +sendMessageToPopup(message)
        +updateLastQuestionState(data)
        +handlePopupMessage(message, sender, sendResponse)
    }
    
    class PopupScript {
        +initializeUI()
        +setupEventListeners()
        +requestAndUpdateUI()
        +sendMessageToBackground(action, payload, callback)
        +handleBackgroundResponse(message)
    }
    
    %% Relationships
    AudioControls --> SocketHandlers : uses
    AudioControls --> HistoryManager : uses
    SocketHandlers --> Animation : uses
    SocketHandlers --> MarkdownUtils : uses
    
    %% Desktop App Relationships
    AudioRecorder --> AudioDeviceManager : uses
    AudioControls --> AudioRecorder : uses
    AudioControls --> SocketClient : uses
    SocketClient --> SocketHandlers : uses
    
    %% Mobile App Relationships
    class MobileAudioControls {
        +handleToggleRecording()
        +handleRetry()
        +handleGemini()
        +handleCancel()
    }
    MobileAudioControls --> useAudioRecorder : uses
    MobileAudioControls --> useSocket : uses
    MobileAudioControls --> APIService : uses
    
    %% Chrome Extension Relationships
    PopupScript --> BackgroundScript : communicates with
    BackgroundScript --> SocketHandlers : uses
```

This class diagram illustrates the frontend components of the Audio Listener AI system across different platforms:

1. Shared components used across all platforms
2. Desktop application (Electron) specific components
3. Mobile application (React Native) specific components
4. Chrome extension specific components

The diagram shows the relationships between these components and their key methods and properties.

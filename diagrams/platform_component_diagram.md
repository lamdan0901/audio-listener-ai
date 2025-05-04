# Platform Component Diagram

```mermaid
graph TB
    subgraph "Backend Server"
        Express["Express Server"]
        SocketIO["Socket.IO Server"]
        APIRoutes["API Routes"]
        Controllers["Controllers"]
        AudioProcessing["Audio Processing"]
        AIIntegration["AI Integration"]
    end
    
    subgraph "External Services"
        AssemblyAI["AssemblyAI\n(Speech-to-Text)"]
        GeminiAI["Google Gemini AI\n(Text Processing)"]
    end
    
    subgraph "Web Application"
        WebUI["Web UI\n(HTML/CSS/JS)"]
        WebSocketClient["Socket.IO Client"]
        WebAudioRecorder["Audio Recorder"]
        WebHistory["History Manager"]
    end
    
    subgraph "Desktop Application"
        ElectronMain["Electron Main Process"]
        ElectronRenderer["Electron Renderer"]
        DesktopUI["Desktop UI"]
        DesktopSocketClient["Socket.IO Client"]
        DesktopAudioRecorder["Audio Recorder"]
        DesktopAudioDeviceManager["Audio Device Manager"]
        SystemAudioCapture["System Audio Capture"]
    end
    
    subgraph "Mobile Application"
        ReactNative["React Native App"]
        MobileUI["Mobile UI Components"]
        ExpoAudio["Expo Audio"]
        MobileSocketClient["Socket.IO Client"]
        MobileAPIService["API Service"]
        AsyncStorage["AsyncStorage"]
    end
    
    subgraph "Chrome Extension"
        ExtensionPopup["Extension Popup"]
        BackgroundScript["Background Script"]
        ExtensionSocketClient["Socket.IO Client"]
        ExtensionAudioRecorder["Audio Recorder"]
    end
    
    %% Backend connections
    Express --- SocketIO
    Express --- APIRoutes
    APIRoutes --- Controllers
    Controllers --- AudioProcessing
    Controllers --- AIIntegration
    
    %% External service connections
    AudioProcessing --- AssemblyAI
    AIIntegration --- GeminiAI
    
    %% Web app connections
    WebUI --- WebSocketClient
    WebUI --- WebAudioRecorder
    WebUI --- WebHistory
    WebSocketClient --- SocketIO
    
    %% Desktop app connections
    ElectronMain --- ElectronRenderer
    ElectronRenderer --- DesktopUI
    DesktopUI --- DesktopSocketClient
    DesktopUI --- DesktopAudioRecorder
    DesktopUI --- DesktopAudioDeviceManager
    DesktopAudioRecorder --- SystemAudioCapture
    DesktopSocketClient --- SocketIO
    
    %% Mobile app connections
    ReactNative --- MobileUI
    MobileUI --- ExpoAudio
    MobileUI --- MobileSocketClient
    MobileUI --- MobileAPIService
    MobileUI --- AsyncStorage
    MobileSocketClient --- SocketIO
    MobileAPIService --- APIRoutes
    
    %% Chrome extension connections
    ExtensionPopup --- BackgroundScript
    BackgroundScript --- ExtensionSocketClient
    BackgroundScript --- ExtensionAudioRecorder
    ExtensionSocketClient --- SocketIO
```

This component diagram illustrates the relationships between different platforms in the Audio Listener AI system:

1. Backend Server components
2. External Services
3. Web Application components
4. Desktop Application (Electron) components
5. Mobile Application (React Native) components
6. Chrome Extension components

The diagram shows how all platforms connect to the same backend server while implementing platform-specific features and capabilities.

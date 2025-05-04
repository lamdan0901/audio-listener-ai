# Deployment Diagram

```mermaid
graph TB
    subgraph "Cloud Platform"
        subgraph "Backend Server"
            NodeJS["Node.js Runtime"]
            ExpressApp["Express Application"]
            SocketIOServer["Socket.IO Server"]
            FFmpeg["FFmpeg Utility"]
        end
        
        subgraph "Storage"
            TempStorage["Temporary Storage\n(Audio Files)"]
        end
    end
    
    subgraph "External Services"
        AssemblyAI["AssemblyAI API"]
        GeminiAI["Google Gemini AI API"]
    end
    
    subgraph "Client Devices"
        WebBrowser["Web Browser\n(Web App)"]
        DesktopApp["Electron App\n(Windows/Mac/Linux)"]
        MobileApp["Mobile App\n(iOS/Android)"]
        ChromeExt["Chrome Extension"]
    end
    
    %% Connections
    NodeJS --- ExpressApp
    NodeJS --- SocketIOServer
    NodeJS --- FFmpeg
    ExpressApp --- TempStorage
    
    ExpressApp --- AssemblyAI
    ExpressApp --- GeminiAI
    
    WebBrowser --- ExpressApp
    WebBrowser --- SocketIOServer
    
    DesktopApp --- ExpressApp
    DesktopApp --- SocketIOServer
    
    MobileApp --- ExpressApp
    MobileApp --- SocketIOServer
    
    ChromeExt --- ExpressApp
    ChromeExt --- SocketIOServer
    
    %% Deployment notes
    WebBrowser -.- WebNote["Served via HTTPS\nStatic files on CDN"]
    DesktopApp -.- DesktopNote["Distributed as\ninstallable package"]
    MobileApp -.- MobileNote["Distributed via\nApp Stores"]
    ChromeExt -.- ExtNote["Distributed via\nChrome Web Store"]
    
    ExpressApp -.- ServerNote["Deployed on\nCloud VM or Container"]
    TempStorage -.- StorageNote["Ephemeral storage\nwith regular cleanup"]
```

This deployment diagram illustrates how the Audio Listener AI system would be deployed in a production environment:

1. Backend Server components deployed on a cloud platform
2. External Services (AssemblyAI and Google Gemini AI) accessed via APIs
3. Client applications distributed through appropriate channels
4. Communication between clients and server via HTTP/HTTPS and WebSockets

The diagram includes deployment notes for each component, indicating how they would be deployed and distributed.

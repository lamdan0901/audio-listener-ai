# Audio Recording and Processing Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Client as Frontend Client
    participant Server as Backend Server
    participant AssemblyAI
    participant GeminiAI
    
    User->>Client: Click "Start Listening"
    activate Client
    Client->>Client: Initialize audio recorder
    Client->>Client: Start recording audio
    Client-->>User: Update UI (recording state)
    
    User->>Client: Click "Stop Listening"
    Client->>Client: Stop recording
    Client->>Client: Create audio blob
    
    Client->>Server: POST /api/v1/recording/upload (audio file)
    activate Server
    Server->>Server: Save audio file
    Server-->>Client: 200 OK (file received)
    
    Server->>AssemblyAI: Send audio for transcription
    activate AssemblyAI
    Server-->>Client: Emit "processing" event
    Client-->>User: Show processing indicator
    
    AssemblyAI-->>Server: Return transcription
    deactivate AssemblyAI
    Server-->>Client: Emit "transcript" event (with text)
    Client-->>User: Display transcribed question
    
    Server->>GeminiAI: Send transcript for processing
    activate GeminiAI
    
    loop For each response chunk
        GeminiAI-->>Server: Stream response chunk
        Server-->>Client: Emit "streamChunk" event
        Client-->>User: Update answer with animation
    end
    
    GeminiAI-->>Server: Complete response
    deactivate GeminiAI
    Server-->>Client: Emit "streamEnd" event
    deactivate Server
    
    Client->>Client: Save to history
    Client-->>User: Complete answer display
    deactivate Client
```

This sequence diagram illustrates the main flow of audio recording and processing in the Audio Listener AI system:

1. User initiates recording
2. Client records and sends audio to server
3. Server processes audio with AssemblyAI for transcription
4. Server processes transcript with Gemini AI
5. Server streams response back to client
6. Client displays response to user

The diagram shows the asynchronous nature of the process and the real-time updates provided to the user.

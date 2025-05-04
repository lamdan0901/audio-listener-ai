# Direct Gemini Processing Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Client as Frontend Client
    participant Server as Backend Server
    participant GeminiAI
    
    User->>Client: Click "Try Gemini AI directly"
    activate Client
    
    Client->>Server: POST /api/v1/recording/gemini-upload (audio file)
    activate Server
    
    Server->>Server: Reset retry count
    Server-->>Client: Emit "processing" event
    Client-->>User: Show processing indicator
    
    Server->>GeminiAI: Send audio directly to Gemini
    activate GeminiAI
    
    GeminiAI-->>Server: Process audio and return response
    deactivate GeminiAI
    
    Server-->>Client: Emit "transcript" event (with placeholder or detected text)
    Client-->>User: Display question (original or detected)
    
    loop For each response chunk
        Server-->>Client: Emit "streamChunk" event
        Client-->>User: Update answer with animation
    end
    
    Server-->>Client: Emit "streamEnd" event
    deactivate Server
    
    Client->>Client: Save to history
    Client-->>User: Complete answer display
    deactivate Client
```

This sequence diagram illustrates the direct Gemini processing flow in the Audio Listener AI system:

1. User initiates direct Gemini processing
2. Client sends audio to server for Gemini processing
3. Server sends audio directly to Gemini AI (bypassing AssemblyAI)
4. Gemini processes the audio and generates a response
5. Server streams the response back to client
6. Client displays the response to user

The diagram shows how the system can bypass the separate transcription step and send audio directly to Gemini for processing, which may be useful in cases where the transcription service is struggling with certain audio inputs.

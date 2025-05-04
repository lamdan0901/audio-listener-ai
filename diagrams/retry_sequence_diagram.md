# Retry Transcription Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Client as Frontend Client
    participant Server as Backend Server
    participant AssemblyAI
    participant GeminiAI
    
    User->>Client: Click "Try Different Recognition"
    activate Client
    
    Client->>Server: POST /api/v1/recording/retry
    activate Server
    
    Server->>Server: Increment retry count
    Server->>Server: Select different transcription strategy
    Server-->>Client: Emit "processing" event
    Client-->>User: Show processing indicator
    
    Server->>AssemblyAI: Send audio with different settings
    activate AssemblyAI
    
    AssemblyAI-->>Server: Return new transcription
    deactivate AssemblyAI
    
    Server-->>Client: Emit "transcript" event (with new text)
    Client-->>User: Display new transcribed question
    
    Server->>GeminiAI: Send new transcript for processing
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
    
    Client->>Client: Update history
    Client-->>User: Complete answer display
    deactivate Client
```

This sequence diagram illustrates the retry transcription flow in the Audio Listener AI system:

1. User initiates retry
2. Server selects a different transcription strategy
3. Server reprocesses the audio with AssemblyAI using different settings
4. Server processes the new transcript with Gemini AI
5. Server streams the new response back to client
6. Client displays the new response to user

The diagram shows how the system attempts to improve transcription accuracy by trying different approaches when the initial transcription is unsatisfactory.

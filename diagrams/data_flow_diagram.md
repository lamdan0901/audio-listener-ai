# Data Flow Diagram

```mermaid
flowchart TD
    %% External entities
    User([User])
    AssemblyAI([AssemblyAI])
    GeminiAI([Google Gemini AI])
    
    %% Processes
    P1[Record Audio]
    P2[Upload Audio]
    P3[Transcribe Audio]
    P4[Process Text]
    P5[Stream Response]
    P6[Display Response]
    P7[Save to History]
    P8[Direct Gemini Processing]
    
    %% Data stores
    DS1[(Audio Files)]
    DS2[(History)]
    
    %% Data flows
    User -->|Speaks/Interacts| P1
    P1 -->|Audio Data| P2
    P2 -->|Audio File| DS1
    P2 -->|File Reference| P3
    DS1 -->|Audio File| P3
    P3 -->|Audio File| AssemblyAI
    AssemblyAI -->|Transcribed Text| P3
    P3 -->|Transcript| P4
    P4 -->|Question Text| GeminiAI
    GeminiAI -->|Response Text| P4
    P4 -->|Response Chunks| P5
    P5 -->|Streamed Content| P6
    P6 -->|Display to User| User
    P6 -->|Complete Interaction| P7
    P7 -->|Save Interaction| DS2
    DS2 -->|Load History| P6
    
    %% Alternative flow - Direct Gemini
    P2 -->|Audio File| P8
    DS1 -->|Audio File| P8
    P8 -->|Audio Data| GeminiAI
    P8 -->|Response| P5
    
    %% Styling
    classDef process fill:#f9f,stroke:#333,stroke-width:2px;
    classDef entity fill:#bbf,stroke:#33f,stroke-width:2px;
    classDef datastore fill:#dfd,stroke:#3a3,stroke-width:2px;
    
    class P1,P2,P3,P4,P5,P6,P7,P8 process;
    class User,AssemblyAI,GeminiAI entity;
    class DS1,DS2 datastore;
```

This data flow diagram illustrates how data moves through the Audio Listener AI system:

1. User interacts with the system to record audio
2. Audio data is uploaded to the server
3. Audio is transcribed using AssemblyAI
4. Transcript is processed with Google Gemini AI
5. Response is streamed back to the client
6. Response is displayed to the user
7. Interaction is saved to history

The diagram also shows the alternative flow for direct Gemini processing, where audio is sent directly to Gemini AI, bypassing the separate transcription step.

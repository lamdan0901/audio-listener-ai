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
    P3R[Retry Transcription]
    P4[Process Text]
    P5[Stream Response]
    P6[Display Response]
    P7[Save to History]
    P8[Direct Gemini Processing]
    P9[Audio Source Selection]

    %% Data stores
    DS1[(Audio Files)]
    DS2[(History)]

    %% Data flows - Main path
    User -->|Selects Audio Source| P9
    P9 -->|Microphone/System Audio| P1
    User -->|Speaks/Interacts| P1
    P1 -->|Audio Data| P2
    P2 -->|Audio File| DS1
    P2 -->|File Reference| P3
    DS1 -->|Audio File| P3
    P3 -->|Audio File + Model| AssemblyAI
    AssemblyAI -->|Transcribed Text| P3

    %% Retry flow
    P3 -->|Empty/Failed Transcript| P3R
    P3R -->|Audio + Different Model| AssemblyAI
    AssemblyAI -->|Transcribed Text| P3R
    P3R -->|Successful Transcript| P4

    %% Continue main flow
    P3 -->|Successful Transcript| P4
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

    %% Styling with improved visibility
    classDef process fill:#f9f,stroke:#333,stroke-width:3px;
    classDef retry fill:#f99,stroke:#933,stroke-width:3px;
    classDef entity fill:#bbf,stroke:#33f,stroke-width:3px;
    classDef datastore fill:#dfd,stroke:#3a3,stroke-width:3px;
    classDef selection fill:#ffd,stroke:#aa3,stroke-width:3px;

    class P1,P2,P3,P4,P5,P6,P7,P8 process;
    class P3R retry;
    class P9 selection;
    class User,AssemblyAI,GeminiAI entity;
    class DS1,DS2 datastore;

    %% Link styling for better visibility
    linkStyle default stroke-width:2px,fill:none,stroke:gray;
```

This data flow diagram illustrates how data moves through the Audio Listener AI system:

1. User selects audio source (microphone or system audio on desktop)
2. User interacts with the system to record audio
3. Audio data is uploaded to the server
4. Audio is transcribed using AssemblyAI with appropriate speech model
5. If transcription fails or returns empty, retry with different speech models:
   - First retry: Best model (higher quality)
   - Second retry: Nano model (lightweight)
   - Third retry: Universal model with different settings
6. Successful transcript is processed with Google Gemini AI
7. Response is streamed back to the client in real-time
8. Response is displayed to the user with markdown formatting
9. Complete interaction is saved to history

The diagram also shows the alternative flow for direct Gemini processing, where audio is sent directly to Gemini AI, bypassing the separate transcription step. This provides a fallback method when transcription is challenging.

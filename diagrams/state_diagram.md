# Application State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    state Idle {
        [*] --> Ready
        Ready --> HistoryView: View History
        HistoryView --> Ready: Return to Main
    }
    
    Idle --> Recording: Start Listening
    Recording --> Processing: Stop Listening
    
    state Processing {
        [*] --> Transcribing
        Transcribing --> GeneratingAnswer: Transcription Complete
        GeneratingAnswer --> StreamingResponse: Initial Response
        StreamingResponse --> ResponseComplete: All Chunks Received
    }
    
    Processing --> Idle: Error
    Processing --> Idle: Cancel
    
    state ResponseDisplayed {
        [*] --> ShowingResponse
        ShowingResponse --> FollowUpEnabled: Enable Follow-up
    }
    
    Processing --> ResponseDisplayed: Processing Complete
    ResponseDisplayed --> Idle: New Interaction
    ResponseDisplayed --> Recording: Follow-up Question
    
    state RetryFlow {
        [*] --> RetryTranscription
        RetryTranscription --> Processing: New Transcription Strategy
    }
    
    ResponseDisplayed --> RetryFlow: Try Different Recognition
    RetryFlow --> ResponseDisplayed: Retry Complete
    
    state GeminiFlow {
        [*] --> DirectGeminiProcessing
        DirectGeminiProcessing --> Processing: Send Audio to Gemini
    }
    
    ResponseDisplayed --> GeminiFlow: Try Gemini AI directly
    GeminiFlow --> ResponseDisplayed: Gemini Processing Complete
```

This state diagram illustrates the different states of the Audio Listener AI application:

1. Idle state (Ready or viewing History)
2. Recording state (capturing audio)
3. Processing state (transcribing, generating answer, streaming response)
4. Response Displayed state (showing response, enabling follow-up)
5. Retry Flow (trying different transcription strategy)
6. Gemini Flow (direct Gemini processing)

The diagram shows the transitions between these states based on user actions and system events.

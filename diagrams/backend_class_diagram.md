# Backend Class Diagram

```mermaid
classDiagram
    %% Core Server Classes
    class ExpressServer {
        -app: Express
        -server: HttpServer
        -io: SocketIO.Server
        -port: number
        +start()
        +setupRoutes()
        +setupSocketIO()
    }
    
    class EventEmitter {
        +on(event, callback)
        +emit(event, data)
    }
    
    class BackendEvents {
        +emit(event, data)
        +on(event, callback)
    }
    
    %% Controller Classes
    class BaseController {
        -isRecording: boolean
        -currentOutputFile: string
        -lastProcessedFile: string
        -retryCount: number
        -isProcessingCancelled: boolean
        -lastQuestion: string
        +getIsRecording()
        +setIsRecording(value)
        +getCurrentOutputFile()
        +setCurrentOutputFile(value)
        +getLastProcessedFile()
        +setLastProcessedFile(value)
        +getRetryCount()
        +setRetryCount(value)
        +incrementRetryCount()
        +isProcessingCancelled()
        +setCancelled(value)
        +getLastQuestion()
        +setLastQuestion(value)
        +prepareRequestParams(body)
        +handleProcessingError(error, lang, file)
    }
    
    class RecordingController {
        +startRecording(req, res)
        +handleAudioUpload(req, res)
    }
    
    class TranscriptionController {
        +stopRecording(req, res)
        +retryTranscription(req, res)
        -processTranscription(filePath, params, options)
    }
    
    class AIProcessingController {
        +processWithGemini(req, res)
        +streamResponse(req, res)
        +handleTranscriptionResult(transcriptionResult, params, filePath)
        -processAudioDirectlyWithGemini(filePath, lang, questionContext, customContext)
    }
    
    class ProcessingController {
        +cancelProcessing(req, res)
    }
    
    class FileController {
        +validateAudioFile(filePath)
        +convertAudioFormat(filePath, targetFormat)
    }
    
    %% Utility Classes
    class AudioProcessor {
        +transcribeAudio(filePath, languageCode, options, retries)
        +processAudioGeneric(filePath, processingFunction)
        -validateAndReadAudioFile(filePath)
    }
    
    class AIClient {
        +createSpeechClient()
        +createGenAIClient(apiKey)
        +getGeminiModel(genAI, config)
    }
    
    class AIUtils {
        +transcribeAudio(filePath, languageCode, options, retries)
        +generateAnswer(question, lang, questionContext, previousQuestion, streaming, customContext)
        +streamGeneratedAnswer(question, lang, questionContext, previousQuestion, customContext)
        +processAudioWithGemini(filePath, lang, questionContext, customContext)
        -getConfiguredGeminiModel(withSafetySettings)
        -buildPrompt(question, lang, contextPrompt, previousQuestion, customContext)
    }
    
    class FFmpegUtils {
        +checkFFmpegAvailability()
        +cleanupAudioFiles(directory)
        +convertAudioFormat(inputPath, outputPath, format)
    }
    
    %% External Service Clients
    class AssemblyAIClient {
        +transcripts: TranscriptResource
        +transcribe(params)
    }
    
    class GeminiAIClient {
        +generateContent(prompt)
        +generateContentStream(prompt)
    }
    
    %% Relationships
    ExpressServer --> BackendEvents : uses
    BackendEvents --|> EventEmitter : extends
    
    BaseController <-- RecordingController : uses
    BaseController <-- TranscriptionController : uses
    BaseController <-- AIProcessingController : uses
    BaseController <-- ProcessingController : uses
    
    TranscriptionController --> AudioProcessor : uses
    AIProcessingController --> AIUtils : uses
    FileController --> FFmpegUtils : uses
    
    AudioProcessor --> AssemblyAIClient : uses
    AIUtils --> GeminiAIClient : uses
    AIUtils --> AudioProcessor : uses
    
    AIClient --> AssemblyAIClient : creates
    AIClient --> GeminiAIClient : creates
```

This class diagram shows the main backend components of the Audio Listener AI system, including:

1. Core server classes
2. Controller classes
3. Utility classes
4. External service clients

The diagram illustrates the relationships between these components and their key methods and properties.

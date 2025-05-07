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
        -lastProcessedFile: string
        -retryCount: number
        -isProcessingCancelled: boolean
        -lastQuestion: string
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
        +cleanupAfterProcessing(filePath)
    }

    class RecordingController {
        +startRecording(req, res)
        +uploadAudio(req, res)
        +stopRecording(req, res)
        +clearAudioFiles(req, res)
    }

    class TranscriptionController {
        +stopRecording(req, res)
        +retryTranscription(req, res)
        +processTranscription(filePath, params, options)
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
        -getSpeechModel(isRetryAttempt, attemptNumber)
    }

    class AIClient {
        +createSpeechClient()
        +createGenAIClient(apiKey)
        +getGeminiModel(genAI, config)
    }

    class AIUtils {
        +generateAnswer(question, lang, questionContext, previousQuestion, streaming, customContext)
        +streamGeneratedAnswer(question, lang, questionContext, previousQuestion, customContext)
        +processAudioWithGemini(filePath, lang, questionContext, customContext)
        -getConfiguredGeminiModel(withAudioSupport)
        -buildPrompt(question, lang, contextPrompt, previousQuestion, customContext)
    }

    class FFmpegUtils {
        +checkFFmpegAvailability()
        +cleanupAudioFiles(directory)
        +convertAudioFormat(inputPath, outputPath, format)
    }

    %% External Service Clients
    class AssemblyAIClient {
        +files.upload(audioBuffer)
        +transcripts.transcribe(params)
        +transcripts.waitUntilReady(id)
    }

    class GeminiAIClient {
        +generateContent(prompt)
        +generateContentStream(prompt)
    }

    %% Relationships
    ExpressServer --> BackendEvents : uses
    BackendEvents --|> EventEmitter : extends

    BaseController <|-- RecordingController : extends
    BaseController <|-- TranscriptionController : extends
    BaseController <|-- AIProcessingController : extends
    BaseController <|-- ProcessingController : extends

    RecordingController --> FileController : uses
    RecordingController --> TranscriptionController : uses

    TranscriptionController --> AudioProcessor : uses
    TranscriptionController --> AIProcessingController : uses

    AIProcessingController --> AIUtils : uses

    FileController --> FFmpegUtils : uses

    AudioProcessor --> AssemblyAIClient : uses
    AIUtils --> GeminiAIClient : uses

    AIClient --> AssemblyAIClient : creates
    AIClient --> GeminiAIClient : creates
```

This class diagram shows the main backend components of the Audio Listener AI system, including:

1. **Core Server Classes**: ExpressServer, EventEmitter, and BackendEvents for handling HTTP requests and real-time communication
2. **Controller Classes**: BaseController and its specialized extensions for handling different aspects of the application
3. **Utility Classes**: AudioProcessor, AIUtils, and FFmpegUtils for handling specific functionality
4. **External Service Clients**: AssemblyAIClient for speech-to-text and GeminiAIClient for AI processing

Key features illustrated in the diagram:

- Inheritance relationships between BaseController and specialized controllers
- Clear separation of concerns between different components
- Integration with external services (AssemblyAI and Google Gemini)
- Speech model selection logic in AudioProcessor
- Audio file validation and conversion in FileController
- Event-based communication through BackendEvents

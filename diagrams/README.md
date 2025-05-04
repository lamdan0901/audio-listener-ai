# Audio Listener AI - System Diagrams

This folder contains various diagrams that illustrate the architecture, components, and behavior of the Audio Listener AI system.

## Class Diagrams

- [Backend Class Diagram](backend_class_diagram.md) - Shows the classes and relationships in the backend server
- [Frontend Class Diagram](frontend_class_diagram.md) - Shows the classes and relationships in the frontend clients

## Sequence Diagrams

- [Recording Sequence Diagram](recording_sequence_diagram.md) - Illustrates the flow of recording and processing audio
- [Retry Sequence Diagram](retry_sequence_diagram.md) - Shows the flow of retrying transcription with different settings
- [Gemini Sequence Diagram](gemini_sequence_diagram.md) - Illustrates the flow of direct Gemini processing

## Component and Deployment Diagrams

- [Platform Component Diagram](platform_component_diagram.md) - Shows the components across different platforms
- [Deployment Diagram](deployment_diagram.md) - Illustrates how the system would be deployed in production

## Data and State Diagrams

- [Data Flow Diagram](data_flow_diagram.md) - Shows how data moves through the system
- [State Diagram](state_diagram.md) - Illustrates the different states of the application

## Viewing the Diagrams

These diagrams are written in Mermaid markdown syntax. To view them:

1. Use a Markdown viewer that supports Mermaid diagrams (like GitHub, GitLab, or VS Code with the Markdown Preview Mermaid Support extension)
2. Use the [Mermaid Live Editor](https://mermaid.live/) by copying the diagram code
3. Render them as high-quality images using the provided scripts

### Rendering High-Quality Images

To render the diagrams as high-quality images:

1. Make sure you have Node.js installed
2. Run one of the following scripts:
   - Windows: `render_diagrams.bat`
   - macOS/Linux: `./render_diagrams.sh` (make it executable first with `chmod +x render_diagrams.sh`)

This will generate:

- SVG files (vector format, best quality for viewing and embedding)
- PNG files (high-resolution bitmap format, 3x scale for better detail)

The rendered images will be saved in the `images` directory.

## Updating the Diagrams

To update these diagrams:

1. Edit the Mermaid code in the respective Markdown files
2. Preview the changes using one of the methods mentioned above
3. Commit the updated files to the repository

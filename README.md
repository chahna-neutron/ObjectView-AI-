# ObjectView-AI — Image to 3D

**Turn 2D images into interactive 3D models.**

ObjectView-AI is a web application that converts an uploaded 2D image into a 3D model using the TRELLIS AI model. Users can preview the generated model in an interactive 3D viewer, rotate it, zoom in and out, and download it as a `.glb` file.

## Live Demo

🌐 **Try it here:** https://objectview-ai-frontend.vercel.app

## Features

- **Image Upload:** Upload JPG, PNG, or WebP images.
- **AI-Powered 3D Generation:** Generate 3D models from 2D images using TRELLIS.
- **Interactive 3D Viewer:** View, rotate, and zoom into generated models.
- **GLB Export:** Download generated models in `.glb` format.
- **Responsive Web Interface:** Access the application through a web browser.
- **Cloud Deployment:** Frontend and backend hosted separately.

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript, Three.js
- **Backend:** Python, FastAPI
- **AI Model:** TRELLIS by Hugging Face
- **AI Integration:** `gradio_client`
- **3D Model Loading:** Three.js GLTFLoader
- **Frontend Hosting:** Vercel
- **Backend Hosting:** Railway

## How It Works

1. The user uploads a 2D image through the web interface.
2. The frontend sends the image to the FastAPI backend.
3. The backend connects to the TRELLIS AI service.
4. TRELLIS generates a 3D model and returns a GLB file.
5. The frontend loads the model into the Three.js viewer.
6. The user can interact with the model and download it.

## Getting Started

Open the live application:

https://objectview-ai-frontend.vercel.app

1. Upload a JPG, PNG, or WebP image.
2. Click **Generate 3D**.
3. Wait for the AI model to finish generating.
4. Rotate or zoom into the result.
5. Download the generated `.glb` file.

## Deployment

- **Frontend:** Vercel
- **Backend API:** Railway
- **AI inference:** Hugging Face TRELLIS

## Limitations

3D generation depends on the availability and usage limits of the hosted AI service. Generation may take time or fail when the service is unavailable or its free GPU quota is exhausted.

## Future Improvements

- Improve 3D model orientation and initial camera positioning.
- Add generation progress and clearer error messages.
- Improve model quality and rendering.
- Explore alternative AI inference providers for better scalability.

## Author
Chahna Sri G

Developed as an AI-powered 3D generation web application.

**Live Demo:** https://objectview-ai-frontend.vercel.app

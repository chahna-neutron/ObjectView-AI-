
from pathlib import Path
import tempfile

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from gradio_client import Client, handle_file

app = FastAPI(title="ObjectView-AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "https://objectview-ai-frontend.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_IMAGE_SIZE = 10 * 1024 * 1024


@app.get("/")
def home():
    return {
        "project": "ObjectView-AI",
        "message": "FastAPI backend is running!",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.post("/api/generate")
def generate_3d(file: UploadFile = File(...)):
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    if file.content_type not in allowed_types:
        file.file.close()
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, PNG, or WebP image.",
        )

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in [".jpg", ".jpeg", ".png", ".webp"]:
        suffix = allowed_types[file.content_type]

    temp_path = None

    try:
        # Save the uploaded image and enforce the 10 MB limit.
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            dir=UPLOAD_DIR,
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            total_size = 0

            while True:
                chunk = file.file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_IMAGE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Image is too large. Maximum size is 10 MB.",
                    )

                temp_file.write(chunk)

        # Connect to the TRELLIS AI service.
        print("Connecting to TRELLIS...")
        client = Client("trellis-community/TRELLIS")

        print("Starting TRELLIS session...")
        client.predict(api_name="/start_session")

        # Generate the 3D model.
        print("Generating 3D model...")
        result = client.predict(
            image=handle_file(str(temp_path)),
            multiimages=[],
            seed=0,
            ss_guidance_strength=7.5,
            ss_sampling_steps=12,
            slat_guidance_strength=3,
            slat_sampling_steps=12,
            multiimage_algo="stochastic",
            mesh_simplify=0.95,
            texture_size=1024,
            api_name="/generate_and_extract_glb",
        )

        # Validate the returned result.
        if not isinstance(result, (tuple, list)) or len(result) < 3:
            raise RuntimeError(
                "TRELLIS returned an unexpected result."
            )

        glb_value = result[2]

        if isinstance(glb_value, dict):
            glb_value = glb_value.get("path")

        if not glb_value:
            raise RuntimeError("TRELLIS returned no GLB file.")

        glb_path = Path(str(glb_value))

        if not glb_path.is_file():
            raise RuntimeError("The generated GLB file was not found.")

        print("3D model generated successfully.")

        # Return the generated 3D model to the frontend.
        return FileResponse(
            path=str(glb_path),
            media_type="model/gltf-binary",
            filename="generated-model.glb",
        )

    except HTTPException:
        # Preserve validation errors, including the file-size limit.
        raise

    except Exception as error:
        error_text = str(error)
        lower_error = error_text.lower()
        error_name = type(error).__name__.lower()

        print(
            f"3D generation failed: "
            f"{type(error).__name__}: {error_text}"
        )

        # Handle free AI quota errors.
        if any(word in lower_error for word in [
            "quota",
            "rate limit",
            "too many requests",
            "resource exhausted",
            "exceeded your free zerogpu",
            "zerogpu quota",
        ]):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Free AI generation limit reached. "
                    "Please try again after the quota resets."
                ),
            )

        # Handle connection timeouts.
        elif (
            "timeout" in error_name
            or "timeout" in lower_error
            or "timed out" in lower_error
        ):
            raise HTTPException(
                status_code=504,
                detail=(
                    "TRELLIS AI is taking too long to respond. "
                    "This may be a temporary connection issue. "
                    "Please try again later."
                ),
            )

        # Handle SSL and connection errors.
        elif any(word in lower_error for word in [
            "connect",
            "ssl",
            "handshake",
            "connection error",
        ]):
            raise HTTPException(
                status_code=502,
                detail=(
                    "Could not connect to TRELLIS AI. "
                    "Please check your connection and try again later."
                ),
            )

        # Handle other unexpected errors.
        else:
            raise HTTPException(
                status_code=502,
                detail=(
                    "3D generation failed. The AI service may be "
                    "temporarily unavailable. Please try again later."
                ),
            )

    finally:
        # Always clean up the temporary uploaded image.
        if temp_path and temp_path.exists():
            temp_path.unlink()

        file.file.close()


import * as THREE from "https://esm.sh/three@0.180.0";
import { GLTFLoader } from "https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js";

const API_URL = "https://objectview-ai-production.up.railway.app";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const uploadMessage = document.getElementById("uploadMessage");
const fileName = document.getElementById("fileName");
const uploadButton = document.getElementById("uploadButton");
const status = document.getElementById("status");
const glbInput = document.getElementById("glbInput");
const downloadButton = document.getElementById("downloadButton");
const resetViewButton = document.getElementById("resetViewButton");
const rotationButton = document.getElementById("rotationButton");
const viewer = document.getElementById("viewer");
const viewerMessage = document.getElementById("viewerMessage");

let selectedImage = null;
let glbFile = null;
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let currentModel = null;
let imagePreviewURL = null;
let initialCameraPosition = null;
let initialCameraTarget = new THREE.Vector3(0, 0, 0);
let rotationPaused = false;
let animationStarted = false;

const loader = new GLTFLoader();

function setStatus(message, type = "info") {
    status.textContent = message;
    status.style.color =
        type === "error" ? "#ff9baf" :
            type === "success" ? "#a9f3d0" :
                "";
}

// IMAGE SELECTION AND VALIDATION

imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setStatus("Please select a JPG, PNG or WebP image.", "error");
        imageInput.value = "";
        return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
        setStatus("Image must be 10 MB or smaller.", "error");
        imageInput.value = "";
        return;
    }

    if (imagePreviewURL) {
        URL.revokeObjectURL(imagePreviewURL);
    }

    selectedImage = file;
    imagePreviewURL = URL.createObjectURL(file);

    imagePreview.src = imagePreviewURL;
    imagePreview.hidden = false;
    uploadMessage.hidden = true;
    fileName.textContent = file.name;

    uploadButton.disabled = false;
    setStatus("Image selected successfully.", "success");
});

// GENERATE 3D MODEL

uploadButton.addEventListener("click", async () => {
    if (!selectedImage) {
        setStatus("Please choose an image first.", "error");
        return;
    }

    const formData = new FormData();
    formData.append("file", selectedImage);

    uploadButton.disabled = true;
    uploadButton.textContent = "Generating 3D model...";
    setStatus("Connecting to TRELLIS AI. Generation may take several minutes...");

    try {
        const response = await fetch(`${API_URL}/api/generate`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            let message = `Generation failed (${response.status}).`;

            try {
                const data = await response.json();
                if (data.detail) message = data.detail;
            } catch {
                // Keep the fallback error message.
            }

            throw new Error(message);
        }

        const blob = await response.blob();

        if (!blob.size) {
            throw new Error("The server returned an empty GLB file.");
        }

        const generatedFile = new File(
            [blob],
            `${selectedImage.name.replace(/\.[^.]+$/, "")}-3d.glb`,
            { type: "model/gltf-binary" }
        );

        await displayGLB(generatedFile);

        setStatus("3D model generated successfully. Drag to rotate and scroll to zoom.", "success");

    } catch (error) {
        console.error("3D generation error:", error);

        if (error instanceof TypeError) {
            setStatus(
                "Cannot connect to the backend. Make sure FastAPI is running on port 8000.",
                "error"
            );
        } else {
            setStatus(error.message || "Generation failed. Please try again.", "error");
        }
    } finally {
        uploadButton.disabled = !selectedImage;
        uploadButton.textContent = "Generate 3D →";
    }
});

// INITIALIZE THREE.JS VIEWER

function initializeViewer() {
    if (renderer) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#18243a");

    camera = new THREE.PerspectiveCamera(
        40,
        Math.max(viewer.clientWidth / Math.max(viewer.clientHeight, 1), 0.1),
        0.01,
        10000
    );

    camera.position.set(2, 1.5, 3);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.35;

    renderer.setSize(viewer.clientWidth, viewer.clientHeight);
    viewer.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9ba8c7, 2.2));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb9c8ff, 2.2);
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 2.5);
    rimLight.position.set(0, 5, -6);
    scene.add(rimLight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enableZoom = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.minDistance = 0.01;
    controls.maxDistance = 10000;

    if (!animationStarted) {
        animationStarted = true;

        function animate() {
            requestAnimationFrame(animate);
            if (controls) controls.update();
            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
        }

        animate();
    }

    window.addEventListener("resize", resizeViewer);
}

function resizeViewer() {
    if (!renderer || !camera) return;

    const width = viewer.clientWidth;
    const height = viewer.clientHeight;

    if (!width || !height) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// FRAME THE MODEL SO IT IS LARGE ENOUGH TO SEE

function frameModel(model) {
    const box = new THREE.Box3().setFromObject(model);

    if (box.isEmpty()) {
        throw new Error("This GLB does not contain a visible 3D model.");
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);

    if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
        throw new Error("The 3D model has invalid dimensions.");
    }

    // Center the object around the viewer origin.
    model.position.sub(center);
    model.updateMatrixWorld(true);

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(
        Math.tan(verticalFov / 2) * camera.aspect
    );
    const limitingFov = Math.min(verticalFov, horizontalFov);

    // Fit the complete model, then bring the camera closer for a larger view.
    const fitDistance = (maxDimension / 2) / Math.tan(limitingFov / 2);
    const distance = fitDistance * 1.22;

    const direction = new THREE.Vector3(1, 0.68, 1).normalize();

    camera.position.copy(direction.multiplyScalar(distance));
    camera.near = Math.max(maxDimension / 10000, 0.001);
    camera.far = Math.max(maxDimension * 100, distance * 100);
    camera.updateProjectionMatrix();

    controls.target.set(0, 0, 0);
    controls.minDistance = Math.max(maxDimension * 0.15, 0.001);
    controls.maxDistance = Math.max(maxDimension * 15, distance * 4);

    initialCameraPosition = camera.position.clone();
    initialCameraTarget.set(0, 0, 0);

    controls.update();
}

// LOAD AND DISPLAY A GLB

async function displayGLB(file) {
    setStatus("Loading your 3D model...");

    downloadButton.disabled = true;
    resetViewButton.disabled = true;
    rotationButton.disabled = true;

    try {
        initializeViewer();

        const arrayBuffer = await file.arrayBuffer();

        const gltf = await new Promise((resolve, reject) => {
            loader.parse(arrayBuffer, "", resolve, reject);
        });

        const newModel = gltf.scene;

        newModel.traverse((object) => {
            if (!object.isMesh) return;

            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];

            materials.forEach((material) => {
                if (!material || !material.color) return;

                const brightness =
                    (material.color.r + material.color.g + material.color.b) / 3;

                // Slightly lift very dark material colors without changing textures.
                if (brightness > 0 && brightness < 0.16) {
                    material.color.multiplyScalar(1.45);
                    material.needsUpdate = true;
                }
            });
        });

        // Remove the previous model only after the new file has parsed.
        if (currentModel) {
            scene.remove(currentModel);
        }

        currentModel = newModel;
        scene.add(currentModel);

        frameModel(currentModel);

        glbFile = file;
        rotationPaused = false;
        controls.autoRotate = true;

        rotationButton.textContent = "Pause Rotation";
        downloadButton.disabled = false;
        resetViewButton.disabled = false;
        rotationButton.disabled = false;

        if (viewerMessage) viewerMessage.hidden = true;

        setStatus("3D model loaded. Drag to rotate and scroll to zoom.", "success");

    } catch (error) {
        console.error("GLB viewer error:", error);

        if (!currentModel && viewerMessage) {
            viewerMessage.hidden = false;
        }

        throw new Error(
            error.message || "Could not display this GLB. Please try another file."
        );
    }
}

// PAUSE OR RESUME ROTATION

rotationButton.addEventListener("click", () => {
    if (!controls || !currentModel) return;

    rotationPaused = !rotationPaused;
    controls.autoRotate = !rotationPaused;

    rotationButton.textContent = rotationPaused
        ? "Resume Rotation"
        : "Pause Rotation";

    setStatus(
        rotationPaused ? "Automatic rotation paused." : "Automatic rotation resumed.",
        "info"
    );
});

// RESET CAMERA

resetViewButton.addEventListener("click", () => {
    if (!camera || !controls || !initialCameraPosition) return;

    camera.position.copy(initialCameraPosition);
    controls.target.copy(initialCameraTarget);
    controls.update();

    setStatus("View reset successfully.", "success");
});

// LOAD AN EXISTING GLB

glbInput.addEventListener("change", async () => {
    const file = glbInput.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".glb") &&
        file.type !== "model/gltf-binary") {
        setStatus("Please select a valid .glb file.", "error");
        glbInput.value = "";
        return;
    }

    try {
        await displayGLB(file);
    } catch (error) {
        setStatus(error.message, "error");
    } finally {
        glbInput.value = "";
    }
});

// DOWNLOAD THE CURRENT MODEL

downloadButton.addEventListener("click", () => {
    if (!glbFile) {
        setStatus("Load or generate a model before downloading.", "error");
        return;
    }

    const downloadURL = URL.createObjectURL(glbFile);
    const link = document.createElement("a");

    link.href = downloadURL;
    link.download = glbFile.name.toLowerCase().endsWith(".glb")
        ? glbFile.name
        : "ObjectView-model.glb";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(downloadURL), 60000);

    setStatus("Your GLB download has started.", "success");
});

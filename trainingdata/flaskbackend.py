from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2
import base64
from io import BytesIO
from PIL import Image
import os


from keras.models import load_model

app = Flask(__name__)
CORS(app)


FIXED_MODEL_PATH = r"D:\fogreact\fogremovalpro\trainingdata\fog_removal_model.h5.keras"
MODELS = {}
ACTIVE_MODEL = 'fixed'

try:
    print(f"🔍 Loading fixed model from {FIXED_MODEL_PATH} ...")
    MODELS[ACTIVE_MODEL] = load_model(FIXED_MODEL_PATH, compile=False)
    model = MODELS[ACTIVE_MODEL]
    print("✅ Fixed model loaded successfully")
except Exception as e:
    model = None
    print(f"❌ Failed to load fixed model: {e}")



def get_model_input_size():
    """Infer spatial input size (height, width) from loaded model, fallback to 256x256."""
    try:
        active = MODELS.get(ACTIVE_MODEL) if ACTIVE_MODEL else model
        if hasattr(active, 'input_shape') and active.input_shape is not None:
            
            h, w = active.input_shape[1], active.input_shape[2]
            if isinstance(h, int) and isinstance(w, int) and h > 0 and w > 0:
                return (h, w)
    except Exception:
        pass
    return (256, 256)


def preprocess_image(image):
    """Resize and normalize input image to the model's expected size."""
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    target_h, target_w = get_model_input_size()
    image = cv2.resize(image, (target_w, target_h))
    image = image.astype(np.float32) / 255.0
    return np.expand_dims(image, axis=0)


def postprocess_image(output, original_shape):
    """Return raw model output (RGB) resized to original frame, no extra filters."""
    img = np.squeeze(output)
    
    if img.dtype != np.uint8:
        if img.max() <= 1.5:
            img = np.clip(img, 0.0, 1.0) * 255.0
        img = img.astype(np.uint8)
    
    img = cv2.resize(img, (original_shape[1], original_shape[0]))
    
    if len(img.shape) == 3 and img.shape[2] == 3:
        return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    return img


def base64_to_image(base64_str):
    """Decode base64 image to OpenCV format"""
    base64_str = base64_str.split(",")[-1]  
    img_data = base64.b64decode(base64_str)
    img = Image.open(BytesIO(img_data))
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def image_to_base64(image):
    """Encode OpenCV image to base64"""
    _, buffer = cv2.imencode('.jpg', image)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')



@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "Fog Removal Server Running",
        "model_loaded": (MODELS.get(ACTIVE_MODEL) is not None),
        "active_model": "fixed",
        "model_path": FIXED_MODEL_PATH
    })


@app.route("/process_frame", methods=["POST"])
def process_frame():
    try:
        data = request.get_json()
        if not data or "frame" not in data:
            return jsonify({"error": "No frame provided"}), 400

        
        active_model = MODELS.get(ACTIVE_MODEL)

    
        image = base64_to_image(data["frame"])
        original_shape = image.shape

        if active_model is None:
            return jsonify({"error": "Model not loaded"}), 500

        
        input_tensor = preprocess_image(image)
        prediction = active_model.predict(input_tensor, verbose=0)
        
        print(f"DEBUG: image={image.shape} val=[{image.min()},{image.max()}] | "
              f"in_tensor=[{input_tensor.min()},{input_tensor.max()}] | "
              f"pred=[{prediction.min()},{prediction.max()}] shape={prediction.shape}", flush=True)

        output_image = postprocess_image(prediction, original_shape)

    
        output_base64 = image_to_base64(output_image)

        return jsonify({"status": "success", "frame": output_base64})

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

import cv2
import numpy as np
from keras.models import load_model

# 🔹 Load trained model
MODEL_PATH = r"D:\fogreact\fogremovalpro\trainingdata\fog_removal_model.h5.keras"
model = load_model(MODEL_PATH, compile=False)

print("✅ Model Loaded")

# 🔹 Get model input size
input_h, input_w = model.input_shape[1], model.input_shape[2]

# 🔹 Start webcam
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ Cannot open camera")
    exit()

print("🎥 Camera Started (Press Q to quit)")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    original = frame.copy()

    # Resize to model input size
    resized = cv2.resize(frame, (input_w, input_h))

    # Normalize
    resized = resized.astype(np.float32) / 255.0
    input_tensor = np.expand_dims(resized, axis=0)

    # Predict
    prediction = model.predict(input_tensor, verbose=0)

    # Postprocess
    output = np.squeeze(prediction)
    output = np.clip(output, 0, 1)
    output = (output * 255).astype(np.uint8)

    # Resize back to original frame size
    output = cv2.resize(output, (original.shape[1], original.shape[0]))

    # Show both side-by-side
    combined = np.hstack((original, output))

    cv2.imshow("Fog Removal (Left=Original | Right=Output)", combined)

    # Press Q to exit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
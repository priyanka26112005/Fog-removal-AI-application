
import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from sklearn.model_selection import train_test_split
from tensorflow.keras.callbacks import ModelCheckpoint
from tensorflow.keras import layers, models

IMG_SIZE = (128, 128)


input_dir = r"C:\Users\PRIYANKA\Downloads\archive (2)\Foggy_Cityscapes\Dense_Fog"
output_dir = r"C:\Users\PRIYANKA\Downloads\archive (2)\Foggy_Cityscapes\No_Fog"
def load_images(input_path, output_path):
    input_images, output_images = [], []
    filenames = os.listdir(input_path)

    for filename in filenames:
        try:
            foggy_path = os.path.join(input_path, filename)
            clear_path = os.path.join(output_path, filename)

            foggy = load_img(foggy_path, target_size=IMG_SIZE)
            clear = load_img(clear_path, target_size=IMG_SIZE)

            foggy_arr = img_to_array(foggy) / 255.0
            clear_arr = img_to_array(clear) / 255.0

            input_images.append(foggy_arr)
            output_images.append(clear_arr)
        except Exception as e:
            print(f"⚠️ Skipping {filename}: {e}")

    return np.array(input_images), np.array(output_images)
def build_unet(input_shape):
    inputs = layers.Input(shape=input_shape)

    
    def conv_block(x, filters):
        x = layers.Conv2D(filters, (3, 3), activation='relu', padding='same')(x)
        x = layers.Conv2D(filters, (3, 3), activation='relu', padding='same')(x)
        return x

    c1 = conv_block(inputs, 64)
    p1 = layers.MaxPooling2D((2, 2))(c1)

    c2 = conv_block(p1, 128)
    p2 = layers.MaxPooling2D((2, 2))(c2)

    c3 = conv_block(p2, 256)
    p3 = layers.MaxPooling2D((2, 2))(c3)

    c4 = conv_block(p3, 512)
    p4 = layers.MaxPooling2D((2, 2))(c4)


    c5 = conv_block(p4, 1024)

    
    u6 = layers.UpSampling2D((2, 2))(c5)
    u6 = layers.Concatenate()([u6, c4])
    c6 = conv_block(u6, 512)

    u7 = layers.UpSampling2D((2, 2))(c6)
    u7 = layers.Concatenate()([u7, c3])
    c7 = conv_block(u7, 256)

    u8 = layers.UpSampling2D((2, 2))(c7)
    u8 = layers.Concatenate()([u8, c2])
    c8 = conv_block(u8, 128)

    u9 = layers.UpSampling2D((2, 2))(c8)
    u9 = layers.Concatenate()([u9, c1])
    c9 = conv_block(u9, 64)

    outputs = layers.Conv2D(3, (1, 1), activation='sigmoid')(c9)

    model = models.Model(inputs, outputs)
    return model


X, Y = load_images(input_dir, output_dir)
print(f"Loaded {len(X)} image pairs.")


X_train, X_test, Y_train, Y_test = train_test_split(X, Y, test_size=0.2, random_state=42)


model = build_unet((IMG_SIZE[0], IMG_SIZE[1], 3))
model.compile(optimizer='adam', loss='mean_squared_error', metrics=['mae'])
model.summary()


model_path = r"D:\fogreact\fogremovalpro\trainingdata\fog_removal_model.h5.keras"


checkpoint = ModelCheckpoint(model_path, save_best_only=True, monitor='val_loss', verbose=1)


model.fit(X_train, Y_train, epochs=20, batch_size=8, validation_data=(X_test, Y_test), callbacks=[checkpoint])

print(f" UNet model saved at: {model_path}")
            
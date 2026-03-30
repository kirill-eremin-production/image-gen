import requests
import base64
import json
from datetime import datetime
import os
import mimetypes

# ========== НАСТРОЙКИ ==========
API_KEY = "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"
URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-3-pro-image-preview"
PROMPT = "Изобрази следующий кадр работы над стройкой, чтобы можно было сделать gif с анимацией работы"

# Разрешение: "1K", "2K", "4K"
RESOLUTION = "1K"

# Соотношение сторон: "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
ASPECT_RATIO = "16:9"

# Референсные изображения (список путей к файлам)
# Например: ["reference1.jpg", "reference2.png"]
REFERENCE_IMAGES = ["./r/ref1.png"]
# ===============================

def load_image_as_base64(image_path):
    """Загружает изображение и конвертирует в base64."""
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Файл не найден: {image_path}")
    
    # Определяем MIME-тип
    mime_type, _ = mimetypes.guess_type(image_path)
    if not mime_type or not mime_type.startswith("image/"):
        mime_type = "image/jpeg"  # По умолчанию
    
    # Читаем и конвертируем в base64
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")
    
    return f"data:{mime_type};base64,{image_data}"

# Формирование контента сообщения
content = []

# Добавляем референсные изображения
if REFERENCE_IMAGES:
    print(f"Загрузка {len(REFERENCE_IMAGES)} референсных изображений...")
    for img_path in REFERENCE_IMAGES:
        try:
            base64_url = load_image_as_base64(img_path)
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": base64_url
                }
            })
            print(f"  ✓ Загружено: {img_path}")
        except Exception as e:
            print(f"  ✗ Ошибка при загрузке {img_path}: {e}")
            exit(1)

# Добавляем текстовый промпт
content.append({
    "type": "text",
    "text": PROMPT
})

# Заголовки запроса
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Тело запроса с параметрами для Gemini 3
payload = {
    "model": MODEL,
    "messages": [
        {
            "role": "user",
            "content": content
        }
    ],
    "modalities": ["image", "text"],
    "image_config": {
        # "aspect_ratio": ASPECT_RATIO,
        "image_size": RESOLUTION
    }
}

print(f"Генерация изображения: {PROMPT}")
print(f"Разрешение: {RESOLUTION}, Соотношение сторон: {ASPECT_RATIO}")
print("Отправка запроса...")

# Отправка запроса
try:
    response = requests.post(URL, headers=headers, json=payload, timeout=300)
    
    # Проверка статуса ответа
    print(f"Статус ответа: {response.status_code}")
    
    if response.status_code != 200:
        print(f"Ошибка HTTP {response.status_code}")
        print(f"Ответ сервера: {response.text[:1000]}")
        exit(1)
    
    # Попытка парсинга JSON
    try:
        result = response.json()
    except json.JSONDecodeError as e:
        print(f"Ошибка парсинга JSON: {e}")
        print(f"Длина ответа: {len(response.text)} символов")
        print(f"Первые 500 символов: {response.text[:500]}")
        print(f"Последние 500 символов: {response.text[-500:]}")
        exit(1)
        
except requests.exceptions.RequestException as e:
    print(f"Ошибка при отправке запроса: {e}")
    exit(1)

# Обработка ответа
if result.get("choices"):
    message = result["choices"][0]["message"]
    
    if message.get("images"):
        for idx, image in enumerate(message["images"]):
            image_url = image["image_url"]["url"]
            
            # Извлечение base64 данных
            if image_url.startswith("data:image"):
                # Формат: data:image/png;base64,iVBORw0KGgo...
                base64_data = image_url.split(",")[1]
                image_bytes = base64.b64decode(base64_data)
                
                # Сохранение в файл
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"generated_image_{timestamp}_{idx}.png"
                
                with open(filename, "wb") as f:
                    f.write(image_bytes)
                
                print(f"✓ Изображение сохранено: {filename}")
            else:
                print(f"URL изображения: {image_url}")
    else:
        print("Изображения не найдены в ответе")
        print(f"Ответ: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    print(f"\n✓ Успешно сохранено изображений: {len(message.get('images', []))}")
else:
    print("Ошибка при генерации:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
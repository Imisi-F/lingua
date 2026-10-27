from openai import OpenAI

from ..config import settings

client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)


def chat_completion(messages: list[dict]) -> str:
    response = client.chat.completions.create(
        model=settings.deepseek_model,
        messages=messages,
    )
    return response.choices[0].message.content

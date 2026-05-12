from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.llm.factory import LLMFactory
from app.config import settings

router = APIRouter(prefix="/generate", tags=["generate"])

class EchoRequest(BaseModel):
    memory_content: str = Field(..., min_length=1, max_length=2000)
    style: str = Field(default="warm", pattern=r"^(warm|humorous|concise|poetic)$")
    years_ago: int = Field(default=0, ge=0, le=100)
    llm_config: dict = Field(default=None)

class EchoResponse(BaseModel):
    echo_message: str

@router.post("/echo", response_model=EchoResponse)
async def generate_echo(request: EchoRequest):
    try:
        protocol = request.llm_config.get("llm_protocol") if request.llm_config else None
        model = request.llm_config.get("llm_model") if request.llm_config else None
        temperature = request.llm_config.get("llm_temperature") if request.llm_config else None
        api_key = request.llm_config.get("api_key") if request.llm_config else None
        base_url = request.llm_config.get("base_url") if request.llm_config else None

        llm = LLMFactory.create(
            protocol=protocol or settings.llm_protocol,
            model=model or settings.llm_model,
            temperature=temperature if temperature is not None else settings.llm_temperature,
            api_key=api_key,
            base_url=base_url,
        )

        echo_message = await llm.generate_echo(
            memory_content=request.memory_content,
            style=request.style,
            years_ago=request.years_ago,
        )

        return EchoResponse(echo_message=echo_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate echo: {str(e)}")

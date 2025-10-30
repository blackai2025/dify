from enum import StrEnum
from typing import Any, Union

from pydantic import BaseModel, Field

from core.tools.entities.tool_entities import ToolInvokeMessage, ToolProviderType


class AgentToolEntity(BaseModel):
    """
    Agent Tool Entity.
    """

    provider_type: ToolProviderType
    provider_id: str
    tool_name: str
    tool_parameters: dict[str, Any] = Field(default_factory=dict)
    plugin_unique_identifier: str | None = None
    credential_id: str | None = None


class AgentPromptEntity(BaseModel):
    """
    Agent Prompt Entity.
    """

    first_prompt: str
    next_iteration: str


class AgentScratchpadUnit(BaseModel):
    """
    Agent First Prompt Entity.
    """

    class Action(BaseModel):
        """
        Action Entity.
        """

        action_name: str
        action_input: Union[dict, str]

        def to_dict(self):
            """
            Convert to dictionary.
            """
            return {
                "action": self.action_name,
                "action_input": self.action_input,
            }

    agent_response: str | None = None
    thought: str | None = None
    action_str: str | None = None
    observation: str | None = None
    action: Action | None = None

    def is_final(self) -> bool:
        """
        Check if the scratchpad unit is final.
        """
        return self.action is None or (
            "final" in self.action.action_name.lower() and "answer" in self.action.action_name.lower()
        )


class AgentEntity(BaseModel):
    """
    Agent Entity.
    """

    class Strategy(StrEnum):
        """
        Agent Strategy.
        """

        CHAIN_OF_THOUGHT = "chain-of-thought"
        FUNCTION_CALLING = "function-calling"

    provider: str
    model: str
    strategy: Strategy
    prompt: AgentPromptEntity | None = None
    tools: list[AgentToolEntity] | None = None
    max_iteration: int = 10
    clear_history_tool_response: bool = False
    keep_user_query_as_kb_query: bool = False
    force_rag: bool = False
    put_recall_into_system_prompt: bool = False
    always_trigger_rag: bool = Field(
        default=False,
        description="Always trigger RAG at the beginning of each user message. "
        "The LLM will generate an optimized query based on conversation context, "
        "then perform RAG retrieval and inject results into the first iteration."
    )


class AgentInvokeMessage(ToolInvokeMessage):
    """
    Agent Invoke Message.
    """

    pass

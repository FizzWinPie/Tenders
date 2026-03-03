from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, Sequence
import operator
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

# 1. Load API Keys
load_dotenv()

# 2. Initialize Models
# Gemini for complex reasoning
gemini_llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0)

# Llama via Groq for speed
llama_llm = ChatGroq(model="llama3-70b-8192", temperature=0)

# 3. Define the State
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    next_agent: str

# 4. Define Agent Nodes
def manager_node(state):
    messages = state["messages"]
    system_prompt = HumanMessage(content="""You are a manager. Analyze the user request.
    If it is about coding or complex logic, say 'PRO'.
    If it is a simple query, say 'LLAMA'.""")
    
    response = gemini_llm.invoke([system_prompt] + messages)
    decision = response.content.strip()
    return {"next_agent": decision}

def gemini_node(state):
    messages = state["messages"]
    response = gemini_llm.invoke(messages)
    return {"messages": [response]}

def llama_node(state):
    messages = state["messages"]
    response = llama_llm.invoke(messages)
    return {"messages": [response]}

# 5. Build the Graph
workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("manager", manager_node)
workflow.add_node("gemini_agent", gemini_node)
workflow.add_node("llama_agent", llama_node)

# Define Logic (Edges)
workflow.set_entry_point("manager")

workflow.add_conditional_edges(
    "manager",
    lambda x: x["next_agent"],
    {
        "PRO": "gemini_agent",
        "LLAMA": "llama_agent"
    }
)

workflow.add_edge("gemini_agent", END)
workflow.add_edge("llama_agent", END)

# Compile the Graph
app = workflow.compile()

# 6. Run the Agent
inputs = {"messages": [HumanMessage(content="Explain quantum physics simply.")]}
result = app.invoke(inputs)

print(result["messages"][-1].content)
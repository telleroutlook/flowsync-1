import { GoogleGenAI, Type, FunctionDeclaration, Tool } from "@google/genai";
import { TaskActionArgs } from "../types";

// Tool: Manage Tasks
const manageTasksTool: FunctionDeclaration = {
  name: "manageTasks",
  description: "Create, update, move, or delete tasks. Supports advanced project management fields like WBS, Start Dates, Progress, and Assignees.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ["create", "move", "delete", "update"],
        description: "The action to perform on a task."
      },
      title: {
        type: Type.STRING,
        description: "The title of the task. Required for creation."
      },
      description: {
        type: Type.STRING,
        description: "A brief description of the task."
      },
      status: {
        type: Type.STRING,
        enum: ["todo", "in-progress", "done"],
        description: "The column/status the task belongs to."
      },
      priority: {
        type: Type.STRING,
        enum: ["low", "medium", "high"],
        description: "The priority level of the task."
      },
      oldTitle: {
        type: Type.STRING,
        description: "The current title of the task if trying to find it to move or update."
      },
      startDate: {
        type: Type.STRING,
        description: "Planned start date (ISO 8601 or natural language)."
      },
      dueDate: {
        type: Type.STRING,
        description: "Planned finish date / Due date (ISO 8601 or natural language)."
      },
      completion: {
        type: Type.NUMBER,
        description: "Percentage complete (0-100)."
      },
      assignee: {
        type: Type.STRING,
        description: "Responsible unit or person (e.g., 'Construction Unit', 'Design Institute')."
      },
      wbs: {
        type: Type.STRING,
        description: "WBS Code (e.g., '1.1', '2.3')."
      },
      isMilestone: {
        type: Type.BOOLEAN,
        description: "True if this task is a milestone (0 duration significant event)."
      }
    },
    required: ["action"]
  }
};

// Tool: Manage Projects
const manageProjectsTool: FunctionDeclaration = {
  name: "manageProjects",
  description: "Create, select (switch to), update, or delete entire projects. Use this when the user mentions a 'Project' explicitly.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ["create", "select", "delete", "update"],
        description: "The action to perform on a project."
      },
      name: {
        type: Type.STRING,
        description: "The name of the project."
      },
      description: {
        type: Type.STRING,
        description: "Description of the project."
      },
      oldName: {
        type: Type.STRING,
        description: "The current name of the project if renaming or selecting."
      }
    },
    required: ["action"]
  }
};

const tools: Tool[] = [{ functionDeclarations: [manageTasksTool, manageProjectsTool] }];

export class GeminiService {
  private ai: GoogleGenAI;
  private modelName = "gemini-3-flash-preview";

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async sendMessage(
    history: { role: string; parts: { text: string }[] }[],
    newMessage: string,
    systemContext?: string
  ): Promise<{ text: string; toolCalls?: { name: string; args: any }[] }> {
    try {
      const systemInstruction = `You are FlowSync AI, an expert project manager.
      ${systemContext || ''}
      You manage projects with professional detail (WBS, Gantt schedules, Responsibility).
      Current Date: ${new Date().toISOString().split('T')[0]}`;

      const chat = this.ai.chats.create({
        model: this.modelName,
        config: {
          systemInstruction,
          tools: tools,
          temperature: 0.5, // Lower temperature for more precise data handling
        },
        history: history.map(h => ({
            role: h.role,
            parts: h.parts
        }))
      });

      const result = await chat.sendMessage({ message: newMessage });
      const candidate = result.candidates?.[0];
      
      if (!candidate) return { text: "Error: No response from model." };

      const modelText = candidate.content?.parts?.find(p => p.text)?.text || "";
      
      const parts = candidate.content?.parts || [];
      const functionCalls = parts
        .filter(part => part.functionCall)
        .map(part => ({
          name: part.functionCall!.name,
          args: part.functionCall!.args
        }));

      return {
        text: modelText,
        toolCalls: functionCalls.length > 0 ? functionCalls : undefined
      };

    } catch (error) {
      console.error("Gemini API Error:", error);
      return { text: "Sorry, I encountered an error processing your request." };
    }
  }
}

export const geminiService = new GeminiService();

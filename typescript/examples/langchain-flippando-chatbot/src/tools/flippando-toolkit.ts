import { type StructuredToolInterface, BaseToolkit as Toolkit } from "@langchain/core/tools"
import { FLIPPANDO_ACTIONS } from "../actions/flippando/index"
import type { FlippandoAgentkit } from "../flippando-agentkit"
import { FlippandoTool } from "./flippando-tool"

export class FlippandoToolkit extends Toolkit {
  tools: StructuredToolInterface[]

  constructor(agentkit: FlippandoAgentkit) {
    super()
    const actions = FLIPPANDO_ACTIONS
    const tools = actions.map((action) => new FlippandoTool(action, agentkit))
    this.tools = tools
  }
}

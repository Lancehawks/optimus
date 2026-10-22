import { ASSISTANT_SYSTEM_PROMPT } from "./prompt.js";
import { ToolInputError, validateToolInput } from "./schema.js";
import { ASSISTANT_TOOLS, toolDefinitions } from "./tools.js";

// A live check that a model can do the assistant's job: given the real
// instructions and tools, it must look up a fixed day and answer from what
// the lookup returned. It runs against a made-up workspace, never anyone's
// data, and nothing is stored.

const CHECK_DATE = "2026-10-22";
const MAX_CALLS = 4;
const QUESTION = "What's on my plate today?";
const CONTEXT = `Context: it is Thursday ${CHECK_DATE}, 09:00 in the member's timezone (UTC).`;

const AGENDA = {
  timezone: "UTC",
  range: `Thu ${CHECK_DATE}`,
  events: [{ title: "Design review", starts: `Thu ${CHECK_DATE} 11:00`, ends: "12:00", calendar: "Work", href: "/calendar" }],
  tasks_due: [{
    id: "00000000-0000-4000-8000-000000000001",
    title: "Send the Q4 invoice",
    status: "todo",
    priority: "high",
    due: `Thu ${CHECK_DATE}`,
    href: "/tasks?task_id=00000000-0000-4000-8000-000000000001",
  }],
  overdue: { total: 0, tasks: [] },
  in_progress_without_due_date_in_range: [],
  routines: [],
};

const TOOLS_BY_NAME = new Map(ASSISTANT_TOOLS.map((tool) => [tool.name, tool]));

function coversCheckDate(input) {
  const end = input.end_date || input.start_date;
  return input.start_date <= CHECK_DATE && CHECK_DATE <= end;
}

function answerToolCall(call, findings) {
  const tool = TOOLS_BY_NAME.get(call.name);
  if (!tool) {
    findings.badCalls += 1;
    return { output: { error: `There is no tool called ${call.name}.` }, isError: true };
  }
  try {
    const input = validateToolInput(tool.parameters, call.input);
    if (call.name === "get_agenda" && coversCheckDate(input)) {
      findings.calledAgenda = true;
      return { output: AGENDA, isError: false };
    }
    return { output: { note: "Nothing else is in this workspace." }, isError: false };
  } catch (error) {
    if (!(error instanceof ToolInputError)) throw error;
    findings.badCalls += 1;
    return { output: { error: error.message }, isError: true };
  }
}

export async function runModelCheck({ provider, model, apiKey = null, signal }) {
  const tools = toolDefinitions();
  const history = [{ kind: "input", content: QUESTION, payload: { context: CONTEXT } }];
  const findings = { calledAgenda: false, badCalls: 0 };
  let costUsd = 0;

  for (let call = 1; call <= MAX_CALLS; call += 1) {
    let turn = null;
    for await (const event of provider.streamTurn({
      model,
      system: ASSISTANT_SYSTEM_PROMPT,
      memory: null,
      tools,
      history,
      finalStep: call === MAX_CALLS,
      signal,
      apiKey,
    })) {
      if (event.type === "turn") turn = event.turn;
    }
    if (!turn) return { passed: false, detail: "The model returned nothing.", costUsd };
    costUsd += turn.usage?.costUsd || 0;

    if (turn.stopReason === "tool_calls" && turn.toolCalls.length > 0) {
      const results = turn.toolCalls.map((toolCall) => ({ id: toolCall.id, name: toolCall.name, ...answerToolCall(toolCall, findings) }));
      history.push(
        { kind: "model", provider: model.provider, model: model.id, content: turn.text, payload: turn.payload },
        { kind: "tool_results", provider: model.provider, model: model.id, content: "", payload: { results } }
      );
      continue;
    }

    const answer = turn.text || "";
    const problems = [];
    if (!findings.calledAgenda) problems.push(`it didn't look up the agenda for ${CHECK_DATE}`);
    if (findings.badCalls > 0) problems.push(`${findings.badCalls} lookup${findings.badCalls === 1 ? " had" : "s had"} invalid input`);
    if (!/invoice/i.test(answer)) problems.push("the answer left out the task that was due");
    if (!/design review/i.test(answer)) problems.push("the answer left out the scheduled event");
    if (turn.stopReason !== "end") problems.push(`it stopped early (${turn.stopReason})`);

    // One invalid call the model recovered from is fine; it still has to
    // finish with a correct answer.
    const passed = findings.calledAgenda && /invoice/i.test(answer) && /design review/i.test(answer)
      && turn.stopReason === "end" && findings.badCalls <= 1;
    const detail = passed
      ? `Passed in ${call} call${call === 1 ? "" : "s"}: it looked up the day and answered with the task and event.`
      : `Failed: ${problems.join("; ")}.`;
    return { passed, detail, costUsd };
  }
  return { passed: false, detail: `Failed: it kept calling tools without answering after ${MAX_CALLS} calls.`, costUsd };
}

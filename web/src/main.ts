import "./styles.css";

type PendingDelete = {
  id: string;
  date?: string;
  reason?: string;
};

type ToolResultNotification = {
  structuredContent?: {
    pendingDelete?: PendingDelete;
    deleted?: boolean;
    message?: string;
  };
  _meta?: {
    pendingDelete?: PendingDelete;
  };
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    message?: string;
  };
};

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("Root element not found.");
}

const rootElement = root;
const parentOrigin = getConfiguredParentOrigin() ?? getReferrerOrigin();
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

let pendingDelete: PendingDelete | undefined;
let requestId = 1;
const callbacks = new Map<
  number,
  {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timer: number;
  }
>();

if (parentOrigin) {
  renderIdle();
} else {
  renderError("Parent origin is not configured.");
}

window.addEventListener(
  "message",
  (event) => {
    if (event.source !== window.parent) return;
    if (!parentOrigin || event.origin !== parentOrigin) return;
    const message = event.data;
    if (!message || message.jsonrpc !== "2.0") return;

    if (message.method === "ui/notifications/tool-result") {
      handleToolResult(message.params as ToolResultNotification);
      return;
    }

    if (typeof message.id === "number" && callbacks.has(message.id)) {
      const callback = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (!callback) return;
      window.clearTimeout(callback.timer);
      settleToolCall(callback, message as JsonRpcResponse);
    }
  },
);

function handleToolResult(result: ToolResultNotification) {
  const nextPendingDelete =
    result._meta?.pendingDelete ?? result.structuredContent?.pendingDelete;
  if (nextPendingDelete) {
    pendingDelete = nextPendingDelete;
    renderPending(nextPendingDelete);
    return;
  }

  if (result.structuredContent?.deleted) {
    renderDone(result.structuredContent.message ?? "Food entry deleted.");
  }
}

function renderIdle() {
  rootElement.innerHTML = `
    <main class="shell">
      <div class="status">Waiting for a deletion request.</div>
    </main>
  `;
}

function renderPending(entry: PendingDelete) {
  rootElement.innerHTML = `
    <main class="shell">
      <section class="panel">
        <div>
          <p class="label">Food entry deletion</p>
          <h1>Confirm deletion</h1>
        </div>
        <dl>
          <div>
            <dt>Entry ID</dt>
            <dd>${escapeHtml(entry.id)}</dd>
          </div>
          ${
            entry.date
              ? `<div><dt>Date</dt><dd>${escapeHtml(entry.date)}</dd></div>`
              : ""
          }
          ${
            entry.reason
              ? `<div><dt>Reason</dt><dd>${escapeHtml(entry.reason)}</dd></div>`
              : ""
          }
        </dl>
        <div class="actions">
          <button class="danger" id="confirm" type="button">Delete</button>
          <button id="cancel" type="button">Cancel</button>
        </div>
      </section>
    </main>
  `;

  document.querySelector("#confirm")?.addEventListener("click", confirmDelete);
  document.querySelector("#cancel")?.addEventListener("click", () => {
    pendingDelete = undefined;
    renderDone("Deletion cancelled.");
  });
}

async function confirmDelete() {
  if (!pendingDelete) return;
  const id = pendingDelete.id;
  renderBusy();

  const result = await callTool("sparkyfitness.confirm_delete_food_entry", {
    id,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Deletion failed.";
    renderError(message);
    return undefined;
  });

  if (!result) return;

  const message =
    readNestedString(result, ["structuredContent", "message"]) ??
    readNestedString(result, ["message"]) ??
    "Food entry deleted.";
  renderDone(message);
}

function renderBusy() {
  rootElement.innerHTML = `
    <main class="shell">
      <div class="status">Deleting food entry...</div>
    </main>
  `;
}

function renderDone(message: string) {
  rootElement.innerHTML = `
    <main class="shell">
      <div class="status">${escapeHtml(message)}</div>
    </main>
  `;
}

function renderError(message: string) {
  rootElement.innerHTML = `
    <main class="shell">
      <div class="status error">${escapeHtml(message)}</div>
    </main>
  `;
}

function callTool(name: string, args: Record<string, unknown>) {
  if (!parentOrigin) {
    return Promise.reject(new Error("Parent origin is not configured."));
  }

  const id = requestId++;
  const message = {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  };

  return new Promise<unknown>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      callbacks.delete(id);
      reject(new Error(`Tool call "${name}" timed out.`));
    }, 30_000);
    callbacks.set(id, { resolve, reject, timer });
    window.parent.postMessage(message, parentOrigin);
  });
}

function settleToolCall(
  callback: {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  },
  message: JsonRpcResponse,
) {
  if (message.error) {
    callback.reject(new Error(message.error.message ?? "Tool call failed."));
    return;
  }
  callback.resolve(message.result);
}

function readNestedString(value: unknown, path: string[]) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

function escapeHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

function getConfiguredParentOrigin() {
  const configuredOrigin = import.meta.env.VITE_PARENT_ORIGIN;
  if (!configuredOrigin) return undefined;
  return new URL(configuredOrigin).origin;
}

function getReferrerOrigin() {
  if (!document.referrer) return undefined;
  try {
    return new URL(document.referrer).origin;
  } catch {
    return undefined;
  }
}

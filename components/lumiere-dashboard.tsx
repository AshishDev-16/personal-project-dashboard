"use client";

import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  LayoutDashboard,
  ListTodo,
  Menu,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { ProjectSwitcher } from "@/components/project-switcher";
import type { LumiereSettings, LumiereState, LumiereTask, LumiereTaskStatus } from "@/lib/types";

const STORAGE_KEY = "lumiere-engineering-state-v1";
const STATUS_ORDER: LumiereTaskStatus[] = ["In Review", "Fixing in Progress", "Accepted", "Rejected"];

const DEFAULT_SETTINGS: LumiereSettings = {
  amountPerAcceptedTask: 0,
  currency: "USD",
};

type LumiereView = "board" | "tasks" | "settings";
type LumiereFilter = "All" | LumiereTaskStatus;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `lum-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function money(value: number, currency: "USD" | "INR") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function shortDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function statusSlug(status: LumiereTaskStatus) {
  return status.toLowerCase().replaceAll(" ", "-");
}

export function LumiereDashboard({ onSwitchProject }: { onSwitchProject: () => void }) {
  const [view, setView] = useState<LumiereView>("board");
  const [tasks, setTasks] = useState<LumiereTask[]>([]);
  const [settings, setSettings] = useState<LumiereSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LumiereFilter>("All");
  const [editingTask, setEditingTask] = useState<LumiereTask | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [rejectingTask, setRejectingTask] = useState<LumiereTask | null>(null);
  const [toast, setToast] = useState("Manual workspace ready");
  const importRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  let cancelled = false;

  async function loadState() {
    try {
      const response = await fetch(
        "/api/lumiere/state",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "MongoDB load failed"
        );
      }

      const data =
        await response.json();

      const databaseState =
        data.state as
          | LumiereState
          | null;

      let localState:
        | LumiereState
        | null = null;

      try {
        const saved =
          window.localStorage.getItem(
            STORAGE_KEY
          );

        if (saved) {
          const parsed =
            JSON.parse(
              saved
            ) as LumiereState;

          if (
            Array.isArray(
              parsed.tasks
            ) &&
            parsed.settings
          ) {
            localState =
              parsed;
          }
        }
      } catch {
        localState = null;
      }

      /*
       * Database is the primary source.
       *
       * If database is empty but old
       * browser data exists, migrate it.
       */
      const state =
        databaseState ??
        localState ?? {
          tasks: [],
          settings:
            DEFAULT_SETTINGS,
        };

      if (cancelled) {
        return;
      }

      setTasks(
        state.tasks
      );

      setSettings({
        ...DEFAULT_SETTINGS,
        ...state.settings,
      });

      /*
       * One-time migration.
       */
      if (
        !databaseState &&
        localState
      ) {
        const migrateResponse =
          await fetch(
            "/api/lumiere/state",
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  localState
                ),
            }
          );

        if (
          !migrateResponse.ok
        ) {
          throw new Error(
            "Lumiere migration failed"
          );
        }
      }

      /*
       * Browser storage is no longer
       * our source of truth.
       */
      if (
        databaseState ||
        localState
      ) {
        window.localStorage.removeItem(
          STORAGE_KEY
        );
      }

      setToast(
        "MongoDB workspace loaded"
      );
    } catch (error) {
      console.error(error);

      /*
       * Emergency fallback:
       * don't destroy local data if
       * Atlas temporarily fails.
       */
      try {
        const saved =
          window.localStorage.getItem(
            STORAGE_KEY
          );

        if (saved) {
          const parsed =
            JSON.parse(
              saved
            ) as LumiereState;

          if (
            Array.isArray(
              parsed.tasks
            )
          ) {
            setTasks(
              parsed.tasks
            );
          }

          if (
            parsed.settings
          ) {
            setSettings({
              ...DEFAULT_SETTINGS,
              ...parsed.settings,
            });
          }
        }
      } catch {
        // Ignore fallback failure.
      }

      setToast(
        "MongoDB connection failed"
      );
    } finally {
      if (!cancelled) {
        setHydrated(true);
      }
    }
  }

  void loadState();

  return () => {
    cancelled = true;
  };
}, []);

useEffect(() => {
  if (!hydrated) {
    return;
  }

  /*
   * Small debounce so typing a prompt
   * doesn't write to MongoDB on every
   * single keystroke.
   */
  const timeout =
    window.setTimeout(() => {
      const state: LumiereState = {
        tasks,
        settings,
      };

      void fetch(
        "/api/lumiere/state",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              state
            ),
        }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error();
          }

          setToast(
            "Saved to MongoDB"
          );
        })
        .catch(() => {
          setToast(
            "MongoDB save failed"
          );
        });
    }, 400);

  return () => {
    window.clearTimeout(
      timeout
    );
  };
}, [
  tasks,
  settings,
  hydrated,
]);

  const stats = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, tasks.filter((task) => task.status === status).length])) as Record<
      LumiereTaskStatus,
      number
    >;
    const earned = counts.Accepted * settings.amountPerAcceptedTask;
    const decided = counts.Accepted + counts.Rejected;
    const acceptanceRate = decided ? Math.round((counts.Accepted / decided) * 100) : 0;
    return { total: tasks.length, counts, earned, acceptanceRate };
  }, [tasks, settings.amountPerAcceptedTask]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...tasks]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .filter((task) => {
        const matchesStatus = filter === "All" || task.status === filter;
        const matchesQuery =
          !q ||
          task.taskId.toLowerCase().includes(q) ||
          task.category.toLowerCase().includes(q) ||
          task.prompt.toLowerCase().includes(q) ||
          task.rejectionReason.toLowerCase().includes(q);
        return matchesStatus && matchesQuery;
      });
  }, [tasks, query, filter]);

  const recentTasks = useMemo(
    () => [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [tasks],
  );

  function createTask(input: Pick<LumiereTask, "taskId" | "submissionDate" | "category" | "prompt">) {
    const duplicate = tasks.some((task) => task.taskId.trim().toLowerCase() === input.taskId.trim().toLowerCase());
    if (duplicate) return "A task with this Task ID already exists.";
    const now = new Date().toISOString();
    setTasks((current) => [
      {
        id: uid(),
        ...input,
        taskId: input.taskId.trim(),
        category: input.category.trim(),
        prompt: input.prompt.trim(),
        status: "In Review",
        rejectionReason: "",
        createdAt: now,
        updatedAt: now,
      },
      ...current,
    ]);
    setCreatingTask(false);
    setToast(`Task ${input.taskId.trim()} added`);
    return null;
  }

  function editTask(taskId: string, input: Pick<LumiereTask, "taskId" | "submissionDate" | "category" | "prompt">) {
    const duplicate = tasks.some(
      (task) => task.id !== taskId && task.taskId.trim().toLowerCase() === input.taskId.trim().toLowerCase(),
    );
    if (duplicate) return "A task with this Task ID already exists.";
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
            ...task,
            ...input,
            taskId: input.taskId.trim(),
            category: input.category.trim(),
            prompt: input.prompt.trim(),
            updatedAt: new Date().toISOString(),
          }
          : task,
      ),
    );
    setEditingTask(null);
    setToast(`Task ${input.taskId.trim()} updated`);
    return null;
  }

  function requestStatusChange(task: LumiereTask, nextStatus: LumiereTaskStatus) {
    if (nextStatus === task.status) return;
    if (nextStatus === "Rejected") {
      setRejectingTask(task);
      return;
    }
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item,
      ),
    );
    setToast(`${task.taskId} → ${nextStatus}${nextStatus === "Accepted" ? " · counted as paid" : ""}`);
  }

  function confirmRejection(task: LumiereTask, reason: string) {
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, status: "Rejected", rejectionReason: reason.trim(), updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    setRejectingTask(null);
    setToast(`${task.taskId} marked Rejected`);
  }

  function deleteTask(task: LumiereTask) {
    if (!window.confirm(`Delete ${task.taskId}? This only removes it from your Lumière tracker.`)) return;
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setEditingTask(null);
    setToast(`${task.taskId} deleted`);
  }

  function exportBackup() {
    const payload = JSON.stringify(
      { version: 1, project: "Project Lumière (Engineering)", exportedAt: new Date().toISOString(), tasks, settings },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lumiere-engineering-backup-${today()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Lumière backup exported");
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as LumiereState;
        if (!Array.isArray(parsed.tasks) || !parsed.settings) throw new Error("Invalid backup");
        setTasks(parsed.tasks);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
        setToast("Lumière backup imported");
      } catch {
        setToast("That Lumière backup is not valid");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="lumiere-shell">
      <aside className={`lumiere-sidebar project-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="lum-brand-row">
          <div className="lum-brand-mark"><Sparkles size={18} /></div>
          <div>
            <div className="lum-brand-title">LUMIÈRE<span>/ENG</span></div>
            <div className="lum-brand-subtitle">AI training task board</div>
          </div>
          <button className="lum-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>




        <nav className="lum-nav-stack">
          <LumNavButton icon={<LayoutDashboard size={17} />} label="Review Board" active={view === "board"} onClick={() => { setView("board"); setSidebarOpen(false); }} />
          <LumNavButton icon={<ListTodo size={17} />} label="Task Registry" badge={String(stats.total)} active={view === "tasks"} onClick={() => { setView("tasks"); setSidebarOpen(false); }} />
          <LumNavButton icon={<Settings2 size={17} />} label="Rate & Settings" active={view === "settings"} onClick={() => { setView("settings"); setSidebarOpen(false); }} />
        </nav>

        <div className="lum-sidebar-bottom">
          <ProjectSwitcher
            active="lumiere"
            onDynamo={onSwitchProject}
            onLumiere={() => undefined}
          />
          <div className="lum-rate-mini">
            <span>ACCEPTED TASK RATE</span>
            <strong>{money(settings.amountPerAcceptedTask, settings.currency)}</strong>
            <small>{stats.counts.Accepted} accepted · {money(stats.earned, settings.currency)} earned</small>
          </div>
          <div className="lum-identity-card">
            <div className="lum-avatar">AK</div>
            <div><strong>Ashish</strong><span>Personal workspace</span></div>
            <span className="lum-online-dot" />
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="lum-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}

      <main className="lumiere-main project-main">
        <header className="lumiere-topbar">
          <button className="lum-mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div>
            <p className="lum-eyebrow">PROJECT LUMIÈRE · ENGINEERING</p>
            <h1>{view === "board" ? "Task Review Board" : view === "tasks" ? "Submission Registry" : "Workspace Settings"}</h1>
          </div>
          <div className="lum-top-actions">
            <div className="lum-save-state"><span className="lum-online-dot" /><div><strong>{toast}</strong><small>Persistent MongoDB workspace</small></div></div>
            <button className="lum-ghost-button" onClick={exportBackup}><Download size={16} /> Backup</button>
            <button className="lum-primary-button" onClick={() => setCreatingTask(true)}><Plus size={17} /> Add task</button>
          </div>
        </header>

        {view === "board" && (
          <div className="lumiere-content">
            <section className="lum-kpi-grid">
              <LumMetric label="TOTAL TASKS" value={stats.total} helper="manual submissions" icon={<ListTodo size={18} />} tone="neutral" />
              <LumMetric label="IN REVIEW" value={stats.counts["In Review"]} helper="waiting for decision" icon={<Clock3 size={18} />} tone="review" />
              <LumMetric label="FIXING" value={stats.counts["Fixing in Progress"]} helper="returned for changes" icon={<Wrench size={18} />} tone="fixing" />
              <LumMetric label="ACCEPTED" value={stats.counts.Accepted} helper="accepted = paid" icon={<CheckCircle2 size={18} />} tone="accepted" />
              <LumMetric label="REJECTED" value={stats.counts.Rejected} helper="reason stored per task" icon={<XCircle size={18} />} tone="rejected" />
              <LumMetric label="EARNED" value={money(stats.earned, settings.currency)} helper={`${money(settings.amountPerAcceptedTask, settings.currency)} each accepted`} icon={<CircleDollarSign size={18} />} tone="money" wide />
            </section>

            <section className="lum-overview-grid">
              <article className="lum-panel lum-progress-panel">
                <div className="lum-panel-title"><span>ACCEPTANCE</span><strong>Outcome velocity</strong></div>
                <div className="lum-progress-body">
                  <div className="lum-ring" style={{ "--lum-progress": `${stats.acceptanceRate * 3.6}deg` } as CSSProperties}>
                    <div><strong>{stats.acceptanceRate}%</strong><span>accepted</span></div>
                  </div>
                  <div className="lum-progress-copy">
                    <p>Calculated only from tasks that already have a final decision.</p>
                    <div><span><i className="accepted" /> Accepted</span><strong>{stats.counts.Accepted}</strong></div>
                    <div><span><i className="rejected" /> Rejected</span><strong>{stats.counts.Rejected}</strong></div>
                  </div>
                </div>
              </article>

              <article className="lum-panel lum-rate-panel">
                <div className="lum-panel-title"><span>PAYMENT MODEL</span><strong>Accepted-task rate</strong></div>
                <div className="lum-rate-editor">
                  <label><span>Currency</span><select value={settings.currency} onChange={(event) => setSettings((current) => ({ ...current, currency: event.target.value as "USD" | "INR" }))}><option value="USD">USD</option><option value="INR">INR</option></select></label>
                  <label className="amount"><span>Amount / accepted task</span><input type="number" min="0" step="0.01" value={settings.amountPerAcceptedTask || ""} placeholder="0.00" onChange={(event) => setSettings((current) => ({ ...current, amountPerAcceptedTask: event.target.value === "" ? 0 : Number(event.target.value) }))} /></label>
                </div>
                <div className="lum-earned-line"><span>Total earned</span><strong>{money(stats.earned, settings.currency)}</strong></div>
                <p className="lum-panel-note"><BadgeCheck size={14} /> The moment a task becomes Accepted, it is automatically counted as paid at this global rate.</p>
              </article>

              <article className="lum-panel lum-activity-panel">
                <div className="lum-panel-title"><span>ACTIVITY</span><strong>Recently updated</strong></div>
                <div className="lum-activity-list">
                  {recentTasks.length ? recentTasks.map((task) => (
                    <button key={task.id} onClick={() => setEditingTask(task)}>
                      <StatusDot status={task.status} />
                      <span><strong>{task.taskId}</strong><small>{task.category}</small></span>
                      <em>{task.status}</em>
                    </button>
                  )) : <EmptyMini text="Your recent task activity will appear here." />}
                </div>
              </article>
            </section>

            <section className="lum-board-section">
              <div className="lum-board-heading">
                <div><span>ALL TASKS</span><h2>Review pipeline</h2></div>
                <div className="lum-board-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task ID, category or prompt…" /></div>
              </div>
              <div className="lum-kanban">
                {STATUS_ORDER.map((status) => {
                  const statusTasks = tasks
                    .filter((task) => task.status === status)
                    .filter((task) => {
                      const q = query.trim().toLowerCase();
                      return !q || task.taskId.toLowerCase().includes(q) || task.category.toLowerCase().includes(q) || task.prompt.toLowerCase().includes(q);
                    })
                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
                  return (
                    <div className={`lum-column status-${statusSlug(status)}`} key={status}>
                      <div className="lum-column-head"><span><StatusDot status={status} /> {status}</span><em>{statusTasks.length}</em></div>
                      <div className="lum-card-stack">
                        {statusTasks.map((task) => (
                          <LumiereTaskCard key={task.id} task={task} rate={settings.amountPerAcceptedTask} currency={settings.currency} onEdit={() => setEditingTask(task)} onStatus={(next) => requestStatusChange(task, next)} />
                        ))}
                        {!statusTasks.length && <div className="lum-empty-column"><span>+</span><p>No {status.toLowerCase()} tasks</p></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {view === "tasks" && (
          <div className="lumiere-content">
            <section className="lum-registry-toolbar lum-panel">
              <div className="lum-board-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task ID, category, prompt or rejection reason…" /></div>
              <div className="lum-filter-tabs">
                {(["All", ...STATUS_ORDER] as LumiereFilter[]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
              </div>
              <span>{filteredTasks.length} tasks</span>
            </section>

            <section className="lum-panel lum-table-panel">
              <div className="lum-table-wrap">
                <table className="lum-table">
                  <thead><tr><th>Task</th><th>Submitted</th><th>Prompt</th><th>Status</th><th>Payment</th><th /></tr></thead>
                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr key={task.id}>
                        <td><div className="lum-task-identity"><span><Sparkles size={14} /></span><div><strong>{task.taskId}</strong><small>{task.category}</small></div></div></td>
                        <td>{shortDate(task.submissionDate)}</td>
                        <td><p className="lum-prompt-cell">{task.prompt}</p>{task.rejectionReason && <small className="lum-reject-note">Reason: {task.rejectionReason}</small>}</td>
                        <td><StatusSelect task={task} onStatus={(next) => requestStatusChange(task, next)} /></td>
                        <td>{task.status === "Accepted" ? <span className="lum-paid-badge"><CheckCircle2 size={13} /> {money(settings.amountPerAcceptedTask, settings.currency)}</span> : <span className="lum-unpaid-text">—</span>}</td>
                        <td><button className="lum-icon-button" onClick={() => setEditingTask(task)} aria-label={`Edit ${task.taskId}`}><Pencil size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredTasks.length && <div className="lum-empty-registry"><Sparkles size={22} /><h3>No tasks found</h3><p>Add your first Lumière submission or change the current filter.</p><button className="lum-primary-button" onClick={() => setCreatingTask(true)}><Plus size={16} /> Add task</button></div>}
              </div>
            </section>
          </div>
        )}

        {view === "settings" && (
          <div className="lumiere-content lum-settings-content">
            <section className="lum-panel lum-settings-card">
              <div className="lum-panel-title"><span>PAYMENT</span><strong>Accepted-task rate</strong></div>
              <p>Project Lumière uses one global rate. Only <b>Accepted</b> tasks are counted as paid; In Review, Fixing and Rejected tasks contribute zero.</p>
              <div className="lum-settings-fields">
                <label><span>Currency</span><select value={settings.currency} onChange={(event) => setSettings((current) => ({ ...current, currency: event.target.value as "USD" | "INR" }))}><option value="USD">USD</option><option value="INR">INR</option></select></label>
                <label><span>Amount for each accepted task</span><input type="number" min="0" step="0.01" value={settings.amountPerAcceptedTask || ""} placeholder="0.00" onChange={(event) => setSettings((current) => ({ ...current, amountPerAcceptedTask: event.target.value === "" ? 0 : Number(event.target.value) }))} /></label>
              </div>
              <div className="lum-settings-summary"><span>{stats.counts.Accepted} accepted × {money(settings.amountPerAcceptedTask, settings.currency)}</span><strong>{money(stats.earned, settings.currency)}</strong></div>
            </section>

            <section className="lum-panel lum-settings-card">
              <div className="lum-panel-title"><span>DATA</span><strong>Backup & restore</strong></div>
              <p>Dynamo and Lumière use separate browser-storage keys. Exporting or importing Lumière data never changes your Dynamo payment records.</p>
              <div className="lum-settings-actions"><button className="lum-ghost-button" onClick={exportBackup}><Download size={16} /> Export Lumière backup</button><button className="lum-ghost-button" onClick={() => importRef.current?.click()}><Upload size={16} /> Import backup</button></div>
            </section>
          </div>
        )}
      </main>

      {(creatingTask || editingTask) && (
        <TaskEditorModal
          task={editingTask}
          onClose={() => { setCreatingTask(false); setEditingTask(null); }}
          onCreate={createTask}
          onEdit={editTask}
          onDelete={deleteTask}
        />
      )}

      {rejectingTask && (
        <RejectionModal
          task={rejectingTask}
          onClose={() => setRejectingTask(null)}
          onConfirm={(reason) => confirmRejection(rejectingTask, reason)}
        />
      )}

      <input ref={importRef} type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importBackup(file); event.currentTarget.value = ""; }} />
    </div>
  );
}

function LumNavButton({ icon, label, badge, active, onClick }: { icon: ReactNode; label: string; badge?: string; active: boolean; onClick: () => void }) {
  return <button className={`lum-nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{badge && <em>{badge}</em>}</button>;
}

function LumMetric({ label, value, helper, icon, tone, wide = false }: { label: string; value: string | number; helper: string; icon: ReactNode; tone: string; wide?: boolean }) {
  return <article className={`lum-metric tone-${tone} ${wide ? "wide" : ""}`}><span className="lum-metric-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{helper}</p></div></article>;
}

function StatusDot({ status }: { status: LumiereTaskStatus }) {
  return <i className={`lum-status-dot ${statusSlug(status)}`} />;
}

function StatusSelect({ task, onStatus }: { task: LumiereTask; onStatus: (status: LumiereTaskStatus) => void }) {
  return (
    <select className={`lum-status-select status-${statusSlug(task.status)}`} value={task.status} onChange={(event) => onStatus(event.target.value as LumiereTaskStatus)}>
      {STATUS_ORDER.map((status) => <option key={status}>{status}</option>)}
    </select>
  );
}

function LumiereTaskCard({ task, rate, currency, onEdit, onStatus }: { task: LumiereTask; rate: number; currency: "USD" | "INR"; onEdit: () => void; onStatus: (status: LumiereTaskStatus) => void }) {
  return (
    <article className="lum-task-card">
      <div className="lum-task-card-top"><span className="lum-task-id">{task.taskId}</span><button onClick={onEdit} aria-label={`Edit ${task.taskId}`}><Pencil size={13} /></button></div>
      <span className="lum-category-chip">{task.category}</span>
      <p>{task.prompt}</p>
      {task.rejectionReason && <div className="lum-rejection-preview"><XCircle size={13} /><span>{task.rejectionReason}</span></div>}
      <div className="lum-task-card-meta"><span><Clock3 size={12} /> {shortDate(task.submissionDate)}</span>{task.status === "Accepted" && <strong>{money(rate, currency)}</strong>}</div>
      <StatusSelect task={task} onStatus={onStatus} />
    </article>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <div className="lum-empty-mini"><Activity size={18} /><span>{text}</span></div>;
}

function TaskEditorModal({
  task,
  onClose,
  onCreate,
  onEdit,
  onDelete,
}: {
  task: LumiereTask | null;
  onClose: () => void;
  onCreate: (input: Pick<LumiereTask, "taskId" | "submissionDate" | "category" | "prompt">) => string | null;
  onEdit: (id: string, input: Pick<LumiereTask, "taskId" | "submissionDate" | "category" | "prompt">) => string | null;
  onDelete: (task: LumiereTask) => void;
}) {
  const [taskId, setTaskId] = useState(task?.taskId ?? "");
  const [submissionDate, setSubmissionDate] = useState(task?.submissionDate ?? today());
  const [category, setCategory] = useState(task?.category ?? "");
  const [prompt, setPrompt] = useState(task?.prompt ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!taskId.trim() || !submissionDate || !category.trim() || !prompt.trim()) {
      setError("Task ID, submission date, category and prompt are all required.");
      return;
    }
    const input = { taskId, submissionDate, category, prompt };
    const nextError = task ? onEdit(task.id, input) : onCreate(input);
    if (nextError) setError(nextError);
  }

  return (
    <div className="lum-modal-layer">
      <button className="lum-modal-backdrop" onClick={onClose} aria-label="Close editor" />
      <form className="lum-modal" onSubmit={submit}>
        <div className="lum-modal-head"><div><span>{task ? "EDIT SUBMISSION" : "NEW SUBMISSION"}</span><h2>{task ? task.taskId : "Log Lumière task"}</h2><p>Keep enough prompt detail to distinguish similar category tasks later.</p></div><button type="button" onClick={onClose}><X size={19} /></button></div>
        <div className="lum-modal-body">
          <div className="lum-form-grid"><label><span>Task ID</span><input autoFocus value={taskId} onChange={(event) => setTaskId(event.target.value)} placeholder="e.g. 8f2d1..." /></label><label><span>Submission date</span><input type="date" value={submissionDate} onChange={(event) => setSubmissionDate(event.target.value)} /></label></div>
          <label><span>Task category</span><input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. Science Judge - Lumiere" /></label>
          <label><span>Prompt / task identifier</span><textarea rows={9} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Paste the prompt you submitted or enough of it to identify this task later…" /></label>
          {task && <div className={`lum-current-status status-${statusSlug(task.status)}`}><StatusDot status={task.status} /><span>Current status</span><strong>{task.status}</strong></div>}
          {task?.rejectionReason && <div className="lum-existing-reason"><XCircle size={15} /><div><strong>Recorded rejection reason</strong><p>{task.rejectionReason}</p></div></div>}
          {error && <div className="lum-form-error">{error}</div>}
        </div>
        <div className="lum-modal-footer">{task ? <button type="button" className="lum-danger-button" onClick={() => onDelete(task)}><Trash2 size={15} /> Delete</button> : <span />}<div><button type="button" className="lum-ghost-button" onClick={onClose}>Cancel</button><button className="lum-primary-button" type="submit">{task ? "Save changes" : "Add task"}</button></div></div>
      </form>
    </div>
  );
}

function RejectionModal({ task, onClose, onConfirm }: { task: LumiereTask; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(task.rejectionReason);
  const [error, setError] = useState("");

  function confirm() {
    if (!reason.trim()) {
      setError("Add the rejection reason before marking this task Rejected.");
      return;
    }
    onConfirm(reason);
  }

  return (
    <div className="lum-modal-layer lum-reject-layer">
      <button className="lum-modal-backdrop" onClick={onClose} aria-label="Close rejection dialog" />
      <div className="lum-rejection-modal">
        <div className="lum-reject-icon"><XCircle size={23} /></div>
        <span>REJECTION DETAILS</span>
        <h2>Why was {task.taskId} rejected?</h2>
        <p>This reason stays attached to the task so you know what went wrong if you see a similar task later.</p>
        <textarea autoFocus rows={6} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter the reviewer / platform rejection reason…" />
        {error && <div className="lum-form-error">{error}</div>}
        <div className="lum-rejection-actions"><button className="lum-ghost-button" onClick={onClose}>Cancel</button><button className="lum-reject-button" onClick={confirm}>Mark Rejected</button></div>
      </div>
    </div>
  );
}

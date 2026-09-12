"use client";

import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  ExternalLink,
  GitFork,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DynamoTask, PaymentMap, PaymentRecord, PaymentStatus, DynamoSummary } from "@/lib/types";
import { ProjectSwitcher } from "@/components/project-switcher";

type View = "overview" | "tasks" | "payments";
type Filter =
  | "All"
  | "Open"
  | "Merged"
  | "Credited"
  | "Not Credited";

const STORAGE_KEY = "dynamo-control-payments-v1";

const defaultPayment:
  PaymentRecord = {
  status: "Not Credited",

  expectedAmount: null,

  creditedAmount: null,

  currency: "USD",

  creditedAt: null,

  reference: "",

  notes: "",
};
const DEFAULT_DYNAMO_SUMMARY:
  DynamoSummary = {
  currency: "USD",

  paidOutToBank: 987.71,

  awaitingPayout: 280,
};

function money(value: number, currency: "USD" | "INR") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function shortRepo(repo: string) {
  return repo.replace(/^dynamo-[a-f0-9]+-/, "");
}

function niceTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DynamoDashboard({ initialTasks, onSwitchProject }: { initialTasks: DynamoTask[]; onSwitchProject: () => void }) {
  const [view, setView] = useState<View>("overview");
  const [tasks, setTasks] = useState(initialTasks);
  const [payments, setPayments] = useState<PaymentMap>({});
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("Ready to sync");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] =
    useState<DynamoSummary>(
      DEFAULT_DYNAMO_SUMMARY
    );

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const response =
          await fetch(
            "/api/dynamo/summary",
            {
              cache: "no-store",
            }
          );

        if (!response.ok) {
          throw new Error(
            "Dynamo summary load failed"
          );
        }

        const data =
          await response.json();

        if (
          !cancelled &&
          data.summary
        ) {
          setSummary(
            data.summary
          );
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setSyncMessage(
            "Earnings summary load failed"
          );
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPayments() {
      try {
        const response = await fetch(
          "/api/dynamo/payments",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Could not load MongoDB payments"
          );
        }

        const data =
          await response.json();

        const databasePayments =
          (data.payments ??
            {}) as PaymentMap;

        /*
         * One-time migration of any old
         * browser payment records.
         */
        let localPayments:
          PaymentMap = {};

        try {
          const saved =
            window.localStorage.getItem(
              STORAGE_KEY
            );

          if (saved) {
            localPayments =
              JSON.parse(saved);
          }
        } catch {
          localPayments = {};
        }

        /*
         * MongoDB goes LAST.
         *
         * This means confirmed database
         * information wins over stale
         * browser data.
         *
         * Especially important for the
         * confirmed $80 PR #5 payment.
         */
        const mergedPayments: PaymentMap = {
          ...localPayments,
          ...databasePayments,
        };

        if (!cancelled) {
          setPayments(
            mergedPayments
          );
        }

        /*
         * If old browser records exist,
         * move them into MongoDB.
         */
        if (
          Object.keys(localPayments)
            .length
        ) {
          const migrateResponse =
            await fetch(
              "/api/dynamo/payments",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    payments:
                      mergedPayments,
                  }),
              }
            );

          if (
            !migrateResponse.ok
          ) {
            throw new Error(
              "Could not migrate old payment data"
            );
          }

          window.localStorage.removeItem(
            STORAGE_KEY
          );
        }

        if (!cancelled) {
          setSyncMessage(
            "Payments loaded from MongoDB"
          );
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setSyncMessage(
            "MongoDB payment load failed"
          );
        }
      }
    }

    void loadPayments();

    return () => {
      cancelled = true;
    };
  }, []);

  async function updateSummary(
    patch: Partial<DynamoSummary>
  ) {
    const nextSummary = {
      ...summary,
      ...patch,
    };

    setSummary(
      nextSummary
    );

    try {
      const response =
        await fetch(
          "/api/dynamo/summary",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                nextSummary
              ),
          }
        );

      if (!response.ok) {
        throw new Error(
          "Summary save failed"
        );
      }

      setSyncMessage(
        "Earnings summary saved"
      );
    } catch (error) {
      console.error(error);

      setSyncMessage(
        "Earnings summary could not be saved"
      );
    }
  }
  const paymentFor = (repo: string) => payments[repo] ?? defaultPayment;

  async function savePayment(
    repo: string,
    payment: PaymentRecord
  ) {
    try {
      const response = await fetch(
        "/api/dynamo/payments",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            repo,
            payment,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Payment save failed"
        );
      }

      setSyncMessage(
        "Payment saved"
      );
    } catch (error) {
      console.error(error);

      setSyncMessage(
        "Payment could not be saved"
      );
    }
  }


  function updatePayment(
    repo: string,
    patch: Partial<PaymentRecord>
  ) {
    const currentPayment =
      paymentFor(repo);

    const nextPayment: PaymentRecord = {
      ...currentPayment,
      ...patch,
    };

    setPayments((current) => ({
      ...current,
      [repo]:
        nextPayment,
    }));

    void savePayment(
      repo,
      nextPayment
    );
  }

  function changePaymentStatus(
    repo: string,
    status: PaymentStatus
  ) {
    updatePayment(repo, {
      status,

      creditedAt:
        status === "Credited"
          ? paymentFor(repo)
            .creditedAt ??
          new Date()
            .toISOString()
            .slice(0, 10)
          : null,
    });
  }

  async function syncGithub(silent = false) {
    setSyncing(true);
    if (!silent) setSyncMessage("Syncing GitHub…");
    try {
      const response = await fetch("/api/github/sync", { cache: "no-store" });
      if (!response.ok) throw new Error(`Sync failed (${response.status})`);
      const data = await response.json();
      setTasks(data.tasks);
      setLastSync(data.syncedAt);
      setSyncMessage(
        data.partial
          ? `Synced with ${data.errors.length} fallback item${data.errors.length === 1 ? "" : "s"}`
          : data.authenticated
            ? "GitHub synced with token"
            : "GitHub synced",
      );
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "GitHub sync failed");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void syncGithub(true);
    // Initial one-time refresh only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const merged =
      tasks.filter(
        (task) =>
          task.prStatus === "Merged" &&
          paymentFor(task.repo)
            .status !== "Credited"
      ).length;

    const completed =
      tasks.filter(
        (task) =>
          paymentFor(task.repo)
            .status === "Credited"
      ).length;

    const open = tasks.filter((task) => task.prStatus === "Open").length;
    const accepted = tasks.filter((task) => task.accepted).length;
    const credited =
      tasks.filter(
        (task) =>
          paymentFor(task.repo)
            .status === "Credited"
      ).length;

    const notCredited =
      tasks.length - credited;

    const expected =
      tasks.reduce(
        (sum, task) =>
          sum +
          (
            paymentFor(task.repo)
              .expectedAmount ?? 0
          ),
        0
      );

    const taskCredits =
      tasks.reduce(
        (sum, task) =>
          sum +
          (
            paymentFor(task.repo)
              .creditedAmount ?? 0
          ),
        0
      );
    return {
      total: tasks.length,

      merged,

      open,

      accepted,

      credited,

      notCredited,

      expected,

      taskCredits,

      completed,
    };
    // payments is intentionally a dependency through paymentFor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, payments]);

  const totalDynamoEarned =
    summary.paidOutToBank +
    summary.awaitingPayout;

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const payment = paymentFor(task.repo).status;
      const matchesFilter =
        filter === "All" ||

        (
          filter === "Merged" &&
          task.prStatus === "Merged" &&
          paymentFor(task.repo)
            .status !== "Credited"
        ) ||

        (
          filter === "Open" &&
          task.prStatus === "Open"
        ) ||

        filter === payment;
      const matchesQuery =
        !q ||
        task.repo.toLowerCase().includes(q) ||
        task.prTitle.toLowerCase().includes(q) ||
        task.category.toLowerCase().includes(q) ||
        String(task.prNumber).includes(q);
      return matchesFilter && matchesQuery;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, payments, filter, query]);

  const mergedNotCredited =
    tasks.filter(
      (task) =>
        task.prStatus ===
        "Merged" &&
        paymentFor(task.repo)
          .status ===
        "Not Credited"
    );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) counts.set(task.category, (counts.get(task.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [tasks]);

  function exportBackup() {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), payments }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dynamo-payment-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.payments || typeof parsed.payments !== "object") throw new Error("Invalid backup file");
        setPayments(
          parsed.payments
        );

        void fetch(
          "/api/dynamo/payments",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                payments:
                  parsed.payments,
              }),
          }
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error();
            }

            setSyncMessage(
              "Backup imported to MongoDB"
            );
          })
          .catch(() => {
            setSyncMessage(
              "Backup loaded but MongoDB save failed"
            );
          });
      } catch {
        setSyncMessage("That backup file is not valid");
      }
    };
    reader.readAsText(file);
  }

  const creditProgress =
    stats.total
      ? Math.round(
        (stats.credited /
          stats.total) *
        100
      )
      : 0;

  return (
    <div className="app-shell">
      <aside className={`sidebar project-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><GitFork size={19} /></div>
          <div>
            <div className="brand-title">DYNAMO<span>/CTRL</span></div>
            <div className="brand-subtitle">personal ops console</div>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>



        <nav className="nav-stack">
          <NavButton icon={<LayoutDashboard size={18} />} label="Overview" active={view === "overview"} onClick={() => { setView("overview"); setSidebarOpen(false); }} />
          <NavButton icon={<Activity size={18} />} label="Tasks" badge={String(stats.total)} active={view === "tasks"} onClick={() => { setView("tasks"); setSidebarOpen(false); }} />
          <NavButton icon={<WalletCards size={18} />} label="Task Credits" badge={String(stats.notCredited)} active={view === "payments"} onClick={() => { setView("payments"); setSidebarOpen(false); }} />
        </nav>

        <div className="sidebar-bottom">
          <ProjectSwitcher
            active="dynamo"
            onDynamo={() => undefined}
            onLumiere={onSwitchProject}
          />
          <div className="terminal-card">
            <div className="terminal-line"><span>$</span> git status</div>
            <div className="terminal-ok">{stats.merged} merged · {stats.open} open</div>
            <div className="terminal-dim">{stats.notCredited} not yet credited</div>
          </div>
          <div className="identity-card">
            <div className="avatar">AK</div>
            <div><strong>Ashish</strong><span>AshishDev-16</span></div>
            <Settings2 size={16} className="muted-icon" />
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}

      <main className="main-panel project-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div>
            <p className="eyebrow">HANDSHAKE · PROJECT DYNAMO</p>
            <h1>{view === "overview" ? "Command Center" : view === "tasks" ? "Task Registry" : "Task Credit Ledger"}</h1>
          </div>
          <div className="topbar-actions">
            <div className="sync-meta"><span>{syncMessage}</span><small>Last sync: {niceTime(lastSync)}</small></div>
            <button className="secondary-button" onClick={exportBackup}><Download size={16} /> Backup</button>
            <button className="primary-button" onClick={() => syncGithub(false)} disabled={syncing}>
              {syncing ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
              Sync GitHub
            </button>
          </div>
        </header>

        {view === "overview" && (
          <div className="page-content">
            <section className="hero-strip glass-panel">
              <div>
                <span className="live-dot"><i /> LIVE WORKSPACE</span>
                <h2>Your Dynamo work, merge state and payments — in one place.</h2>
                <p>GitHub owns the technical truth. You own the money trail.</p>
              </div>
              <div className="hero-score">
                <span>
                  Task credit coverage
                </span>

                <strong>
                  {creditProgress}%
                </strong>
                <div className="mini-progress"><i style={{ width: `${creditProgress}%` }} /></div>
              </div>
            </section>

            <section className="metric-grid">
              <MetricCard label="Total tasks" value={stats.total} helper="tracked forks" tone="blue" icon={<GitFork size={18} />} />
              <MetricCard label="Merged" value={stats.merged} helper={`${Math.round((stats.merged / stats.total) * 100)}% complete`} tone="green" icon={<CheckCircle2 size={18} />} />
              <MetricCard label="Open PRs" value={stats.open} helper="still in review" tone="purple" icon={<Clock3 size={18} />} />
              <MetricCard label="Accepted" value={stats.accepted} helper="accepted label" tone="cyan" icon={<BadgeCheck size={18} />} />
              <MetricCard label="Not credited" value={stats.notCredited} helper={`${stats.credited} credited`} tone="amber" icon={<CircleDollarSign size={18} />} />
            </section>

            <section className="bento-grid">
              <article className="glass-panel pipeline-card">
                <div className="section-heading"><div><span>PIPELINE</span><h3>Task → merge → payment</h3></div><Sparkles size={18} /></div>
                <div className="pipeline">
                  <PipelineStep label="Accepted" value={stats.accepted} total={stats.total} tone="cyan" />
                  <PipelineStep label="Merged" value={stats.merged} total={stats.total} tone="green" />
                  <PipelineStep label="Credited" value={stats.credited} total={stats.total} tone="blue" />
                </div>
                <div className="pipeline-note"><strong>{mergedNotCredited.length}</strong> merged task{mergedNotCredited.length === 1 ? "" : "s"} merged task
                  {mergedNotCredited.length === 1
                    ? ""
                    : "s"}{" "}
                  not yet credited by the platform.</div>
              </article>

              <article className="glass-panel money-card">
                <div className="section-heading">
                  <div>
                    <span>
                      PROJECT EARNINGS
                    </span>

                    <h3>
                      Dynamo earnings
                    </h3>
                  </div>

                  <WalletCards size={18} />
                </div>

                <div className="money-rows">
                  <div>
                    <span>
                      Total earned
                    </span>

                    <strong>
                      {money(
                        totalDynamoEarned,
                        summary.currency
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Paid out to bank
                    </span>

                    <strong>
                      {money(
                        summary.paidOutToBank,
                        summary.currency
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Awaiting bank payout
                    </span>

                    <strong>
                      {money(
                        summary.awaitingPayout,
                        summary.currency
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Task credits logged
                    </span>

                    <strong>
                      {money(
                        stats.taskCredits,
                        "USD"
                      )}
                    </strong>
                  </div>
                </div>

                <button
                  className="text-button"
                  onClick={() =>
                    setView("payments")
                  }
                >
                  Open task credit ledger

                  <ArrowUpRight size={15} />
                </button></article>

              <article className="glass-panel attention-card">
                <div className="section-heading"><div><span>ATTENTION</span><h3>What needs you</h3></div><Clock3 size={18} /></div>
                <AttentionRow tone="purple" value={stats.open} text="pull requests are still open" onClick={() => { setFilter("Open"); setView("tasks"); }} />
                <AttentionRow
                  tone="amber"
                  value={
                    mergedNotCredited.length
                  }
                  text="merged tasks are not yet credited"
                  onClick={() => {
                    setFilter(
                      "Not Credited"
                    );

                    setView(
                      "payments"
                    );
                  }}
                />
                <AttentionRow tone="green" value={stats.accepted} text="tasks carry the accepted state" onClick={() => setView("tasks")} />
              </article>

              <article className="glass-panel categories-card">
                <div className="section-heading"><div><span>MIX</span><h3>Task categories</h3></div><Activity size={18} /></div>
                <div className="category-list">
                  {categoryCounts.map(([name, count]) => (
                    <div className="category-row" key={name}>
                      <div><span>{name}</span><strong>{count}</strong></div>
                      <div className="category-track"><i style={{ width: `${(count / stats.total) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="glass-panel recent-panel">
              <div className="section-heading"><div><span>ACTIVE QUEUE</span><h3>Tasks at a glance</h3></div><button className="text-button" onClick={() => setView("tasks")}>View all <ArrowUpRight size={15} /></button></div>
              <TaskRows tasks={tasks.slice(0, 7)} paymentFor={paymentFor} onEdit={setEditingRepo} compact />
            </section>
          </div>
        )}

        {view === "tasks" && (
          <div className="page-content">
            <section className="glass-panel registry-panel">
              <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} filters={["All", "Open", "Merged"]} count={filteredTasks.length} />
              <TaskRows tasks={filteredTasks} paymentFor={paymentFor} onEdit={setEditingRepo} />
            </section>
          </div>
        )}

        {view === "payments" && (
          <div className="page-content">
            <section className="payment-metrics dynamo-earnings-metrics">

              <div className="glass-panel payment-big">
                <span>
                  TOTAL DYNAMO EARNED
                </span>

                <strong>
                  {money(
                    totalDynamoEarned,
                    summary.currency
                  )}
                </strong>

                <small>
                  all project earnings
                </small>
              </div>


              <div className="glass-panel payment-big">
                <span>
                  PAID OUT TO BANK
                </span>

                <strong>
                  {money(
                    summary.paidOutToBank,
                    summary.currency
                  )}
                </strong>

                <small>
                  actual payout received
                </small>
              </div>


              <div className="glass-panel payment-big warning">
                <span>
                  AWAITING BANK PAYOUT
                </span>

                <strong>
                  {money(
                    summary.awaitingPayout,
                    summary.currency
                  )}
                </strong>

                <small>
                  currently on platform
                </small>
              </div>


              <div className="glass-panel payment-big">
                <span>
                  TASK CREDITS LOGGED
                </span>

                <strong>
                  {money(
                    stats.taskCredits,
                    "USD"
                  )}
                </strong>

                <small>
                  {stats.credited}
                  {" / "}
                  {stats.total}
                  {" "}
                  tracked tasks credited
                </small>
              </div>

            </section>
            <section className="glass-panel dynamo-summary-editor">

              <div className="section-heading">
                <div>
                  <span>
                    PLATFORM SNAPSHOT
                  </span>

                  <h3>
                    Overall Dynamo earnings
                  </h3>
                </div>

                <WalletCards
                  size={18}
                />
              </div>


              <p className="summary-helper">
                Update these two numbers
                whenever the Dynamo platform
                payout dashboard changes.
                Individual task credits are
                tracked separately below.
              </p>


              <div className="dynamo-summary-fields">

                <label>
                  <span>
                    Paid out to bank
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      summary.paidOutToBank
                    }
                    onChange={(event) =>
                      void updateSummary({
                        paidOutToBank:
                          Number(
                            event.target.value
                          ) || 0,
                      })
                    }
                  />
                </label>


                <label>
                  <span>
                    Awaiting bank payout
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      summary.awaitingPayout
                    }
                    onChange={(event) =>
                      void updateSummary({
                        awaitingPayout:
                          Number(
                            event.target.value
                          ) || 0,
                      })
                    }
                  />
                </label>


                <div className="dynamo-summary-total">

                  <span>
                    Total earned
                  </span>

                  <strong>
                    {money(
                      totalDynamoEarned,
                      summary.currency
                    )}
                  </strong>

                </div>

              </div>

            </section>
            <section className="glass-panel registry-panel">
              <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} filters={[
                "All",
                "Credited",
                "Not Credited",
                "Merged"
              ]} count={filteredTasks.length} />
              <PaymentRows tasks={filteredTasks} paymentFor={paymentFor} changeStatus={changePaymentStatus} onEdit={setEditingRepo} />
            </section>
          </div>
        )}
      </main>

      {editingRepo && (
        <PaymentDrawer
          task={tasks.find((task) => task.repo === editingRepo)!}
          payment={paymentFor(editingRepo)}
          onChange={(patch) => updatePayment(editingRepo, patch)}
          onClose={() => setEditingRepo(null)}
        />
      )}

      <input
        ref={importRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importBackup(file);
          event.currentTarget.value = "";
        }}
      />
      <button className="import-fab" onClick={() => importRef.current?.click()} title="Import payment backup">Import backup</button>
    </div>
  );
}

function NavButton({ icon, label, badge, active, onClick }: { icon: ReactNode; label: string; badge?: string; active: boolean; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{badge && <em>{badge}</em>}</button>;
}

function MetricCard({ label, value, helper, tone, icon }: { label: string; value: number; helper: string; tone: string; icon: ReactNode }) {
  return (
    <article className={`metric-card glass-panel tone-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>
    </article>
  );
}

function PipelineStep({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const width = total ? (value / total) * 100 : 0;
  return (
    <div className="pipeline-step">
      <div><span>{label}</span><strong>{value}<small>/{total}</small></strong></div>
      <div className={`pipeline-track tone-${tone}`}><i style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function AttentionRow({ tone, value, text, onClick }: { tone: string; value: number; text: string; onClick: () => void }) {
  return <button className="attention-row" onClick={onClick}><span className={`attention-count tone-${tone}`}>{value}</span><p>{text}</p><ArrowUpRight size={15} /></button>;
}

function Toolbar({ query, setQuery, filter, setFilter, filters, count }: { query: string; setQuery: (value: string) => void; filter: Filter; setFilter: (value: Filter) => void; filters: Filter[]; count: number }) {
  return (
    <div className="toolbar">
      <div className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search repo, PR title or category…" /></div>
      <div className="filter-tabs">{filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <span className="result-count">{count} results</span>
    </div>
  );
}

function TaskRows({ tasks, paymentFor, onEdit, compact = false }: { tasks: DynamoTask[]; paymentFor: (repo: string) => PaymentRecord; onEdit: (repo: string) => void; compact?: boolean }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead><tr><th>Repository</th><th>PR</th><th>Status</th><th>Accepted</th><th>Payment</th><th /></tr></thead>
        <tbody>
          {tasks.map((task) => {
            const payment = paymentFor(task.repo);
            return (
              <tr key={task.repo}>
                <td><div className="repo-cell"><span className="repo-icon"><GitFork size={15} /></span><div><a href={task.forkUrl} target="_blank" rel="noreferrer">{shortRepo(task.repo)} <ExternalLink size={12} /></a><small>{task.category}</small>{!compact && <p>{task.prTitle}</p>}</div></div></td>
                <td><a className="pr-link" href={task.prUrl} target="_blank" rel="noreferrer">#{task.prNumber}</a></td>
                <td><StatusPill
                  status={task.prStatus}
                  credited={
                    payment.status ===
                    "Credited"
                  }
                /></td>
                <td><span className={`accept-pill ${task.accepted ? "yes" : "no"}`}>{task.accepted ? <BadgeCheck size={14} /> : null}{task.accepted ? "Accepted" : "Missing"}</span></td>
                <td><PaymentPill status={payment.status} /></td>
                <td><button className="row-action" onClick={() => onEdit(task.repo)}>Credit <ArrowUpRight size={14} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PaymentRows({ tasks, paymentFor, changeStatus, onEdit }: { tasks: DynamoTask[]; paymentFor: (repo: string) => PaymentRecord; changeStatus: (repo: string, status: PaymentStatus) => void; onEdit: (repo: string) => void }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table payment-table">
        <thead><tr><th>Repository</th><th>PR state</th><th>Credit status</th><th>Expected credit</th><th>Credited amount</th><th>Credited on</th><th /></tr></thead>
        <tbody>
          {tasks.map((task) => {
            const payment = paymentFor(task.repo);
            return (
              <tr key={task.repo}>
                <td><div className="repo-cell"><span className="repo-icon"><GitFork size={15} /></span><div><a href={task.prUrl} target="_blank" rel="noreferrer">{shortRepo(task.repo)} <ExternalLink size={12} /></a><small>PR #{task.prNumber}</small></div></div></td>
                <td><StatusPill
                  status={task.prStatus}
                  credited={
                    payment.status ===
                    "Credited"
                  }
                /></td>
                <td><select className={`payment-select ${payment.status === "Credited" ? "paid" : "unpaid"}`} value={payment.status} onChange={(e) => changeStatus(task.repo, e.target.value as PaymentStatus)}><option>Not Credited</option><option>Credited</option></select></td>
                <td>{payment.expectedAmount == null ? <span className="muted">—</span> : money(payment.expectedAmount, payment.currency)}</td>
                <td>{payment.creditedAmount == null ? <span className="muted">—</span> : money(payment.creditedAmount, payment.currency)}</td>
                <td>{payment.creditedAt || <span className="muted">—</span>}</td>
                <td><button className="row-action" onClick={() => onEdit(task.repo)}>Edit <ArrowUpRight size={14} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({
  status,
  credited,
}: {
  status:
    DynamoTask["prStatus"];

  credited: boolean;
}) {
  if (credited) {
    return (
      <span className="status-pill merged">
        <i />
        Completed
      </span>
    );
  }

  return (
    <span
      className={`status-pill ${status.toLowerCase()}`}
    >
      <i />
      {status}
    </span>
  );
}

function PaymentPill({
  status,
}: {
  status: PaymentStatus;
}) {
  return (
    <span
      className={`payment-pill ${status === "Credited"
        ? "paid"
        : "unpaid"
        }`}
    >
      <i />

      {status}
    </span>
  );
}

function PaymentDrawer({ task, payment, onChange, onClose }: { task: DynamoTask; payment: PaymentRecord; onChange: (patch: Partial<PaymentRecord>) => void; onClose: () => void }) {
  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close payment editor" />
      <aside className="drawer">
        <div className="drawer-header"><div><span>TASK CREDIT RECORD</span><h2>{shortRepo(task.repo)}</h2><p>PR #{task.prNumber} · {task.prStatus}</p></div><button onClick={onClose}><X size={20} /></button></div>
        <div className="drawer-body">
          <label>
            Status

            <select
              value={payment.status}
              onChange={(event) =>
                onChange({
                  status:
                    event.target
                      .value as PaymentStatus,

                  creditedAt:
                    event.target.value ===
                      "Credited"
                      ? payment
                        .creditedAt ??
                      new Date()
                        .toISOString()
                        .slice(0, 10)
                      : null,
                })
              }
            >
              <option>
                Not Credited
              </option>

              <option>
                Credited
              </option>
            </select>
          </label><div className="field-grid">
            <label>Currency<select value={payment.currency} onChange={(e) => onChange({ currency: e.target.value as "USD" | "INR" })}><option value="USD">USD</option><option value="INR">INR</option></select></label>
            <label>Credited on<input type="date" value={payment.creditedAt ?? ""} onChange={(e) => onChange({ creditedAt: e.target.value || null })} /></label>
          </div>
          <div className="field-grid">
            <label>Expected amount<input type="number" min="0" step="0.01" placeholder="0.00" value={payment.expectedAmount ?? ""} onChange={(e) => onChange({ expectedAmount: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <label>Credited amount<input type="number" min="0" step="0.01" placeholder="0.00" value={payment.creditedAmount ?? ""} onChange={(e) => onChange({ creditedAmount: e.target.value === "" ? null : Number(e.target.value) })} /></label>
          </div>
          <label>Payment / batch reference<input placeholder="e.g. Upwork Sep batch" value={payment.reference} onChange={(e) => onChange({ reference: e.target.value })} /></label>
          <label>Notes<textarea rows={5} placeholder="Anything you want to remember about this payment…" value={payment.notes} onChange={(e) => onChange({ notes: e.target.value })} /></label>
          <div className="drawer-info"><BadgeCheck size={16} /><p>Your payment fields are stored locally in this browser and are never overwritten by GitHub sync.</p></div>
        </div>
        <div className="drawer-footer"><button className="primary-button wide" onClick={onClose}>Save & close</button></div>
      </aside>
    </div>
  );
}

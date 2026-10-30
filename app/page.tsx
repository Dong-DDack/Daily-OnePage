"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Feather,
  ListTodo,
  NotebookPen,
  Pencil,
  Plus,
  Quote,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type DiaryTab = "month" | "week" | "day" | "review" | "settings";
type Palette = "linen" | "olive" | "lilac" | "ink";
type FontMode = "clear" | "rounded" | "serif";
type Task = {
  id: string;
  date: string;
  title: string;
  position: number;
  priority: "높음" | "보통" | "낮음";
  tag: string;
  estimate: number;
  done: boolean;
  blockedReason?: string;
};
type WorkLog = {
  id: string;
  taskId: string;
  date: string;
  start: string;
  end: string;
  minutes: number;
  note: string;
};
type Plan = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  priority: "높음" | "보통" | "낮음";
  successCriteria: string;
  estimatedMinutes: number;
};
type PlanRevision = { id: string; snapshot: Record<string, unknown>; changedAt: string };

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const shiftDate = (key: string, days: number) => {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
};
const monthLabel = (date: Date) =>
  `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
const weekStart = (key: string) => {
  const date = dateFromKey(key);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return dateKey(date);
};
const weekday = (key: string) =>
  ["일", "월", "화", "수", "목", "금", "토"][dateFromKey(key).getDay()];
const dayLong = (key: string) =>
  ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][dateFromKey(key).getDay()];
const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const todayKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const priorityToDb = (priority: Task["priority"] | Plan["priority"]) => ({ 높음: "HIGH", 보통: "MEDIUM", 낮음: "LOW" })[priority];
const priorityFromDb = (priority: string): Task["priority"] => priority === "HIGH" ? "높음" : priority === "LOW" ? "낮음" : "보통";
const toSeoulDate = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const toSeoulTime = (value: string) => new Date(value).toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
const toSeoulIso = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`).toISOString();
const taskFromDb = (row: Record<string, unknown>): Task => ({
  id: String(row.id), date: String(row.due_date), title: String(row.title), position: Number(row.position ?? 0),
  priority: priorityFromDb(String(row.priority ?? "MEDIUM")), tag: Array.isArray(row.tags) ? row.tags.map(String).join(", ") : "",
  estimate: Number(row.estimated_minutes ?? 0), done: row.status === "DONE", blockedReason: String(row.blocked_reason ?? "") || undefined,
});
const logFromDb = (row: Record<string, unknown>): WorkLog => ({
  id: String(row.id), taskId: String(row.task_id), date: toSeoulDate(String(row.started_at)), start: toSeoulTime(String(row.started_at)),
  end: toSeoulTime(String(row.ended_at)), minutes: Number(row.actual_minutes ?? 0), note: String(row.blocked_reason ?? ""),
});
const planFromDb = (row: Record<string, unknown>): Plan => ({
  id: String(row.id), title: String(row.title), startDate: String(row.start_date), endDate: String(row.end_date),
  priority: priorityFromDb(String(row.priority ?? "MEDIUM")), successCriteria: String(row.success_criteria ?? ""), estimatedMinutes: Number(row.estimated_minutes ?? 0),
});

const tabs: { id: DiaryTab; label: string; short: string; icon: typeof CalendarDays }[] = [
  { id: "month", label: "월간", short: "MONTH", icon: CalendarDays },
  { id: "week", label: "주간", short: "WEEK", icon: BookOpen },
  { id: "day", label: "하루", short: "DAY", icon: NotebookPen },
  { id: "review", label: "돌아보기", short: "SEE", icon: ArrowLeftRight },
  { id: "settings", label: "설정", short: "SETTINGS", icon: Settings },
];

export default function Home() {
  const [tab, setTab] = useState<DiaryTab>("month");
  const [palette, setPalette] = useState<Palette>("linen");
  const [fontMode, setFontMode] = useState<FontMode>("clear");
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(true);
  // Use a stable initial value for prerendering; set the Seoul date after hydration.
  const [selectedDate, setSelectedDate] = useState("2000-01-01");
  const [todayDate, setTodayDate] = useState("2000-01-01");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planRevisions, setPlanRevisions] = useState<PlanRevision[]>([]);
  const [editingPlan, setEditingPlan] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [dbState, setDbState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [dbError, setDbError] = useState("");
  const [dialog, setDialog] = useState<"plan" | "task" | "log" | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const visibleTasks = useMemo(() => tasks, [tasks]);
  const dayTasks = visibleTasks.filter((task) => task.date === selectedDate).sort((a, b) => a.position - b.position);
  const dayLogs = logs.filter((log) => log.date === selectedDate);
  const monthDate = dateFromKey(selectedDate);
  const monthTasks = visibleTasks.filter((task) => task.date.slice(0, 7) === selectedDate.slice(0, 7));
  const doneCount = monthTasks.filter((task) => task.done).length;
  const delayedCount = monthTasks.filter((task) => !task.done && task.date < todayDate).length;
  const blockedCount = monthTasks.filter((task) => task.blockedReason || logs.some((log) => log.taskId === task.id && log.note.trim())).length;
  const expectedMinutes = monthTasks.reduce((sum, task) => sum + task.estimate, 0);
  const actualMinutes = logs.filter((log) => log.date.slice(0, 7) === selectedDate.slice(0, 7)).reduce((sum, log) => sum + log.minutes, 0);

  useEffect(() => {
    let active = true;
    const currentDate = todayKey();
    setTodayDate(currentDate);
    setSelectedDate(currentDate);
    async function loadDatabase() {
      setDbState("loading");
      setDbError("");
      const [plansResult, tasksResult, logsResult] = await Promise.all([
        supabase.from("plans").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").is("deleted_at", null).order("due_date").order("position"),
        supabase.from("execution_logs").select("*").order("started_at", { ascending: false }),
      ]);
      if (!active) return;
      const error = plansResult.error ?? tasksResult.error ?? logsResult.error;
      if (error) {
        setDbError(error.message);
        setDbState("error");
        return;
      }
      const nextPlan = plansResult.data?.[0] ? planFromDb(plansResult.data[0]) : null;
      setPlan(nextPlan);
      setTasks((tasksResult.data ?? []).map(taskFromDb));
      const activeTaskIds = new Set((tasksResult.data ?? []).map((row) => String(row.id)));
      setLogs((logsResult.data ?? []).filter((row) => activeTaskIds.has(String(row.task_id))).map(logFromDb));
      if (nextPlan) {
        const [{ data: reflection }, { data: revisions }] = await Promise.all([
          supabase.from("reflections").select("next_action").eq("plan_id", nextPlan.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("plan_revisions").select("id, snapshot, changed_at").eq("plan_id", nextPlan.id).order("changed_at", { ascending: false }),
        ]);
        if (active && reflection?.next_action) setReviewNote(String(reflection.next_action));
        if (active) setPlanRevisions((revisions ?? []).map((revision) => ({ id: String(revision.id), snapshot: revision.snapshot as Record<string, unknown>, changedAt: String(revision.changed_at) })));
      }
      if (active) setDbState("ready");
    }
    void loadDatabase().catch((error: unknown) => {
      if (!active) return;
      setDbError(error instanceof Error ? error.message : "데이터베이스에 연결하지 못했습니다.");
      setDbState("error");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
  }, [palette]);

  useEffect(() => {
    document.documentElement.dataset.font = fontMode;
  }, [fontMode]);

  function chooseTab(nextTab: DiaryTab) {
    if (nextTab === tab) return;
    setTab(nextTab);
  }

  function movePeriod(direction: number) {
    if (tab === "month" || tab === "review") {
      const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1, 12);
      const day = Math.min(dateFromKey(selectedDate).getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
      setSelectedDate(dateKey(new Date(next.getFullYear(), next.getMonth(), day, 12)));
    } else {
      setSelectedDate(shiftDate(selectedDate, direction * (tab === "week" ? 7 : 1)));
    }
  }

  async function toggleTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const done = !task.done;
    setDbState("saving");
    const { data, error } = await supabase.from("tasks").update({ status: done ? "DONE" : "TODO", completed_at: done ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) { setDbError(error.message); setDbState("error"); return; }
    setTasks((current) => current.map((item) => item.id === id ? taskFromDb(data) : item));
    setDbError("");
    setDbState("ready");
  }

  function startEdit(task: Task) {
    setEditingTaskId(task.id);
    setDialog("task");
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan) { setDbError("먼저 계획을 저장해 주세요."); return; }
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    const date = String(form.get("date") || selectedDate);
    const fields = {
      title,
      due_date: date,
      priority: priorityToDb(String(form.get("priority") || "보통") as Task["priority"]),
      tags: String(form.get("tag") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      estimated_minutes: Number(form.get("estimate") || 0),
      blocked_reason: String(form.get("blockedReason") || "").trim() || null,
      updated_at: new Date().toISOString(),
    };
    setDbState("saving");
    const result = editingTaskId
      ? await supabase.from("tasks").update(fields).eq("id", editingTaskId).select("*").single()
      : await supabase.from("tasks").insert({ ...fields, plan_id: plan.id, status: "TODO", completed_at: null, position: dayTasks.length }).select("*").single();
    if (result.error) { setDbError(result.error.message); setDbState("error"); return; }
    const next = taskFromDb(result.data);
    setTasks((current) => editingTaskId ? current.map((task) => task.id === next.id ? next : task) : [...current, next]);
    setSelectedDate(next.date);
    setDbError("");
    setDbState("ready");
    chooseTab("day");
    setEditingTaskId(null);
    setDialog(null);
  }

  async function saveLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const taskId = String(form.get("taskId") || "");
    if (!taskId) { setDbError("실행 기록을 연결할 할 일을 먼저 만들어 주세요."); return; }
    const start = String(form.get("start") || "09:00");
    const end = String(form.get("end") || "09:30");
    const minutes = Number(form.get("minutes") || 0);
    const note = String(form.get("note") || "").trim();
    setDbState("saving");
    const { data, error } = await supabase.from("execution_logs").insert({
      task_id: taskId, started_at: toSeoulIso(selectedDate, start), ended_at: toSeoulIso(selectedDate, end), actual_minutes: minutes,
      blocked_reason: note || null, request_key: crypto.randomUUID(),
    }).select("*").single();
    if (error) { setDbError(error.message); setDbState("error"); return; }
    setLogs((current) => [logFromDb(data), ...current]);
    setDbError("");
    setDbState("ready");
    setDialog(null);
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const startDate = String(form.get("startDate") || selectedDate);
    const endDate = String(form.get("endDate") || selectedDate);
    if (!title || !startDate || !endDate) return;
    setDbState("saving");
    const values = {
      title, start_date: startDate, end_date: endDate,
      priority: priorityToDb(String(form.get("priority") || "보통") as Plan["priority"]),
      success_criteria: String(form.get("successCriteria") || "").trim(),
      estimated_minutes: Number(form.get("estimatedMinutes") || 0),
      updated_at: new Date().toISOString(),
    };
    if (editingPlan && plan) {
      const snapshot = { title: plan.title, start_date: plan.startDate, end_date: plan.endDate, priority: priorityToDb(plan.priority), success_criteria: plan.successCriteria, estimated_minutes: plan.estimatedMinutes };
      const { data: revision, error: revisionError } = await supabase.from("plan_revisions").insert({ plan_id: plan.id, snapshot }).select("id, snapshot, changed_at").single();
      if (revisionError) { setDbError(revisionError.message); setDbState("error"); return; }
      const { data, error } = await supabase.from("plans").update(values).eq("id", plan.id).select("*").single();
      if (error) { setDbError(error.message); setDbState("error"); return; }
      setPlan(planFromDb(data));
      setPlanRevisions((current) => [{ id: String(revision.id), snapshot: revision.snapshot as Record<string, unknown>, changedAt: String(revision.changed_at) }, ...current]);
    } else {
      const { data, error } = await supabase.from("plans").insert(values).select("*").single();
      if (error) { setDbError(error.message); setDbState("error"); return; }
      setPlan(planFromDb(data));
    }
    setDbError("");
    setDbState("ready");
    setDialog(null);
    setEditingPlan(false);
  }

  async function deleteTask(id: string) {
    setDbState("saving");
    const { error } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setDbError(error.message); setDbState("error"); return; }
    setTasks((current) => current.filter((task) => task.id !== id));
    setDbState("ready");
  }

  async function saveReflection() {
    if (!plan || !reviewNote.trim()) return;
    setDbState("saving");
    const { error } = await supabase.from("reflections").insert({
      plan_id: plan.id, period_start: weekStart(selectedDate), period_end: shiftDate(weekStart(selectedDate), 6),
      summary: null, next_action: reviewNote.trim(),
    });
    if (error) { setDbError(error.message); setDbState("error"); return; }
    setDbError("");
    setDbState("ready");
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      selectedDate,
      tasks: visibleTasks,
      executions: logs,
      plan,
      planRevisions,
      nextPlanNote: reviewNote,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `diary-export-${selectedDate}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderCalendar() {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1, 12);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - mondayOffset, 12);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = dateKey(date);
      const dateTasks = visibleTasks.filter((task) => task.date === key);
      return (
        <button
          className={`calendar-date ${date.getMonth() !== month ? "other-month" : ""} ${key === selectedDate ? "selected" : ""} ${key === todayDate ? "is-today" : ""}`}
          key={key}
          onClick={() => setSelectedDate(key)}
          aria-label={`${key} 일정 선택`}
        >
          <span className="date-number">{date.getDate()}</span>
          <span className="date-events">
            {dateTasks.slice(0, 2).map((task) => <span className={`event-chip ${task.done ? "is-done" : ""}`} key={task.id}>{task.title}</span>)}
            {dateTasks.length > 2 && <span className="event-more">+{dateTasks.length - 2} 더</span>}
          </span>
          {dateTasks.length > 0 && <span className="event-dots"><i /><i className={dateTasks.some((task) => task.done) ? "done-dot" : ""} /></span>}
        </button>
      );
    });
  }

  function renderWeek() {
    const start = weekStart(selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const key = shiftDate(start, index);
      const list = visibleTasks.filter((task) => task.date === key).sort((a, b) => a.position - b.position);
      return (
        <button className={`week-day ${key === selectedDate ? "selected" : ""} ${key === todayDate ? "today" : ""}`} key={key} onClick={() => setSelectedDate(key)}>
          <span className="week-day-name">{weekday(key)}</span><strong>{dateFromKey(key).getDate()}</strong>
          <span className="week-agenda">{list.length ? list.map((task) => <span className={`week-event ${task.done ? "done" : ""}`} key={task.id}><i />{task.title}</span>) : <span className="week-empty">—</span>}</span>
          <span className="week-count">{list.filter((task) => task.done).length}/{list.length} 완료</span>
        </button>
      );
    });
  }

  function PageContent() {
    if (tab === "settings") return (
      <>
        <div className="page-heading"><div><span className="eyebrow">PREFERENCES · SETTINGS</span><h1>다이어리 설정</h1><p>읽기 편한 글씨와 분위기를 골라 보세요.</p></div><Settings size={20} className="settings-heading-icon" /></div>
        <section className="settings-section"><div className="settings-section-title"><span>글씨체</span><small>화면에 적용할 글꼴</small></div><div className="font-picker" role="group" aria-label="글씨체 선택"><button className={fontMode === "clear" ? "chosen" : ""} onClick={() => setFontMode("clear")} aria-pressed={fontMode === "clear"}>고딕</button><button className={fontMode === "rounded" ? "chosen" : ""} onClick={() => setFontMode("rounded")} aria-pressed={fontMode === "rounded"}>둥근</button><button className={fontMode === "serif" ? "chosen" : ""} onClick={() => setFontMode("serif")} aria-pressed={fontMode === "serif"}>바탕</button></div></section>
        <section className="settings-section"><div className="settings-section-title"><span>테마 색상</span><small>책상과 책갈피 색을 바꿔요</small></div><div className="palette-picker" role="group" aria-label="색상 테마 선택"><button className={`palette-swatch swatch-linen ${palette === "linen" ? "chosen" : ""}`} onClick={() => setPalette("linen")} aria-label="린넨 테마" aria-pressed={palette === "linen"} title="린넨"/><button className={`palette-swatch swatch-olive ${palette === "olive" ? "chosen" : ""}`} onClick={() => setPalette("olive")} aria-label="올리브 테마" aria-pressed={palette === "olive"} title="올리브"/><button className={`palette-swatch swatch-lilac ${palette === "lilac" ? "chosen" : ""}`} onClick={() => setPalette("lilac")} aria-label="라일락 테마" aria-pressed={palette === "lilac"} title="라일락"/><button className={`palette-swatch swatch-ink ${palette === "ink" ? "chosen" : ""}`} onClick={() => setPalette("ink")} aria-label="잉크 테마" aria-pressed={palette === "ink"} title="잉크"/><span className="settings-current-theme">{({ linen: "린넨", olive: "올리브", lilac: "라일락", ink: "잉크" })[palette]}</span></div></section>
        <section className="settings-section settings-export"><div className="settings-section-title"><span>자료 내보내기</span><small>저장된 자료를 JSON 파일로 저장</small></div><button className="export-button" onClick={exportData}><ArrowDownToLine size={14} /> JSON 파일 다운로드</button></section>
        <label className="footer-toggle"><input type="checkbox" checked={showPrivacyNotice} onChange={(event) => setShowPrivacyNotice(event.target.checked)} /><span>첫 화면 공개 안내문 표시</span></label>
      </>
    );
    if (tab === "month") return (
      <>
        <div className="page-heading"><div><span className="eyebrow">MONTHLY CALENDAR · PLAN</span><h1>{monthLabel(monthDate)}</h1>{plan && <p className="active-plan-title">{plan.title}</p>}</div><button className="today-button" onClick={() => setSelectedDate(todayKey())}>오늘로</button></div>
        {!plan && <div className="plan-empty-state"><span>계획이 아직 없습니다.</span><button onClick={() => { setEditingPlan(false); setDialog("plan"); }}><Plus size={14} /> 계획 만들기</button></div>}
        <div className="weekday-row">{["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="month-grid">{renderCalendar()}</div>
        <div className="calendar-legend"><span><i className="legend-dot plan-dot" />예정한 일</span><span><i className="legend-dot done-dot" />완료한 일</span><span className="month-summary">이번 달 {doneCount} / {monthTasks.length}개 완료</span></div>
      </>
    );
    if (tab === "week") {
      const from = dateFromKey(weekStart(selectedDate));
      const to = dateFromKey(shiftDate(weekStart(selectedDate), 6));
      return (
        <>
          <div className="page-heading"><div><span className="eyebrow">WEEKLY SPREAD · PLAN</span><h1>주간 일정</h1><p>{monthLabel(from)} {from.getDate()}일 — {to.getMonth() + 1}월 {to.getDate()}일</p></div><button className="today-button" onClick={() => setSelectedDate(todayKey())}>이번 주</button></div>
          <div className="week-grid">{renderWeek()}</div>
        </>
      );
    }
    if (tab === "day") return (
      <>
        <div className="page-heading day-heading"><div><span className="eyebrow">DAILY PAGE · PLAN → DO</span><h1>{dateFromKey(selectedDate).getMonth() + 1}월 {dateFromKey(selectedDate).getDate()}일 <em>{dayLong(selectedDate)}</em></h1></div><button className="today-button" onClick={() => setSelectedDate(todayKey())}>오늘로</button></div>
        <div className="day-columns">
          <section className="day-plan"><div className="section-title"><span><ListTodo size={15} /> 오늘의 할 일</span><button className="add-link" onClick={() => { setEditingTaskId(null); setDialog(plan ? "task" : "plan"); }}><Plus size={14} /> 추가</button></div>
            <div className="day-task-list">{dayTasks.length ? dayTasks.map((task) => <article className={`day-task ${task.done ? "task-done" : ""}`} key={task.id}>
              <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={task.done ? "진행 중으로 되돌리기" : "완료로 표시"}>{task.done && <Check size={13} />}</button>
              <div className="task-main"><button className="task-name" onClick={() => startEdit(task)}>{task.title}<Pencil size={12} /></button><span className="task-meta"><Clock3 size={11} /> 예상 {task.estimate}분 <i className="meta-separator">·</i> <span className={`priority priority-${task.priority}`}>{task.priority}</span> {task.tag && <b className="tag">{task.tag}</b>}</span></div>
              <button className="task-delete" onClick={() => void deleteTask(task.id)} aria-label="할 일 삭제"><Trash2 size={13} /></button>
            </article>) : <div className="empty-day">할 일이 없습니다.</div>}</div>
            <button className="wide-add" onClick={() => { setEditingTaskId(null); setDialog(plan ? "task" : "plan"); }}><Plus size={14} /> 할 일 추가</button>
          </section>
          <section className="day-do"><div className="section-title"><span><Feather size={15} /> 실제로 한 일</span><button className="add-link" onClick={() => setDialog("log")}><Plus size={14} /> 기록</button></div>
            <div className="worklog-list">{dayLogs.length ? dayLogs.map((log) => <article className="worklog" key={log.id}><div className="log-time">{log.start}<span>—</span>{log.end}<b>{log.minutes}분</b></div><p>{log.note}</p><span className="log-task">{visibleTasks.find((task) => task.id === log.taskId)?.title ?? ""}</span></article>) : <div className="empty-log">실행 기록이 없습니다.</div>}</div>
            <button className="log-prompt" onClick={() => setDialog(dayTasks.length ? "log" : "plan")}><span className="log-prompt-icon"><Plus size={15} /></span><span><b>실행 기록 남기기</b><small>시작 · 종료 · 실제 시간 · 막힌 이유</small></span></button>
          </section>
        </div>
      </>
    );
    return (
      <>
        <div className="page-heading"><div><span className="eyebrow">WEEKLY REVIEW · SEE</span><h1>주간 돌아보기</h1></div><span className="review-range">{weekStart(selectedDate)} — {shiftDate(weekStart(selectedDate), 6)}</span></div>
        <div className="review-grid">
          {[
            ["할 일", monthTasks.length, "선택한 달"],
            ["완료", monthTasks.filter((task) => task.done).length, "마친 할 일"],
            ["지연", delayedCount, "마감일이 지난 미완료 일"],
            ["막힘", blockedCount, "막힌 이유를 남긴 일"],
          ].map(([label, value, caption]) => <button className="review-stat" key={String(label)} onClick={() => chooseTab("day")}><span>{label}</span><strong>{value}</strong><small>{caption} <ChevronRight size={12} /></small></button>)}
        </div>
        <div className="time-compare"><div className="compare-title"><span><Clock3 size={15} /> 시간 비교</span><span>분</span></div><div className="compare-row"><span>예상</span><div className="compare-bar"><i style={{ width: `${expectedMinutes ? 100 : 0}%` }} /></div><b>{Math.floor(expectedMinutes / 60)}h {expectedMinutes % 60}m</b></div><div className="compare-row"><span>실제</span><div className="compare-bar actual"><i style={{ width: `${Math.min(100, Math.round(actualMinutes / Math.max(expectedMinutes, 1) * 100))}%` }} /></div><b>{Math.floor(actualMinutes / 60)}h {actualMinutes % 60}m</b></div><div className="time-difference">차이 {actualMinutes - expectedMinutes}분</div></div>
        <div className="carry-note"><div><span className="eyebrow">NEXT PLAN</span><h2>다음 계획 메모</h2></div><Quote size={21} /><textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} aria-label="다음 계획으로 넘길 한 줄" /><button className="carry-button" onClick={() => void saveReflection()}><ArrowLeftRight size={14} /> 저장</button></div>
      </>
    );
  }

  function handleTaskSubmit(event: FormEvent<HTMLFormElement>) { saveTask(event); }

  const currentTask = tasks.find((task) => task.id === editingTaskId);
  const periodText = tab === "month" || tab === "review" ? monthLabel(monthDate) : tab === "week" ? `주간 · ${monthDate.getMonth() + 1}월 ${monthDate.getDate()}일` : `${monthDate.getMonth() + 1}월 ${monthDate.getDate()}일`;

  return (
    <main className="desk-shell" data-theme={palette}>
      <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><BookOpen size={18} strokeWidth={1.8} /></span><span>하루 한 장<small>PLAN · DO · SEE</small></span></a><div className="topbar-right"><span className={`connection-badge ${dbState}`}><i />{dbState === "loading" ? "데이터 불러오는 중" : dbState === "saving" ? "저장 중" : dbState === "error" ? "연결 오류" : "데이터베이스 연결됨"}</span></div></header>
      {dbError && <p className="db-error" role="alert">{dbError}</p>}
      {showPrivacyNotice && <aside className="privacy-note"><span className="privacy-icon">!</span><span>지금은 로그인이 없어 링크를 아는 사람은 누구나 볼 수 있습니다. 남이 봐도 괜찮은 내용만 넣으세요.</span><span className="privacy-side">공개 기록 안내</span></aside>}

      <section className="diary-stage">
        <div className="bookmark-rail" aria-label="다이어리 페이지 선택">{tabs.map(({ id, label, short, icon: Icon }, index) => <button key={id} style={{ zIndex: tab === id ? 10 : 4 - index }} onClick={() => chooseTab(id)} className={`bookmark bookmark-${id} ${tab === id ? "active" : ""}`} aria-current={tab === id ? "page" : undefined}><Icon size={14} /><span>{label}</span><small>{short}</small></button>)}</div>
        <div className="book-spread">
          <section className="paper-page left-page">
            <div className="page-edge-label"><span>DAYBOOK</span><i><BookOpen size={10} strokeWidth={1.8} /></i></div>
            <div key={tab} className="page-transition"><PageContent /></div>
            <div className="page-number left-number">{tab === "month" ? `${monthDate.getMonth() + 1} · ${monthDate.getFullYear()}` : tab === "week" ? "WEEK" : tab === "day" ? `${monthDate.getDate()} · ${monthNames[monthDate.getMonth()]}` : tab === "settings" ? "SETTINGS" : "LOOK BACK"}</div>
          </section>

          <div className="book-gutter"><span /><span /><span /><span /><span /></div>

          <section className="paper-page right-page">
            <div className="page-edge-label right-edge"><span>MY NOTES</span><i>✎</i></div>
            {tab === "settings" ? <>
              <div className="right-date"><span className="eyebrow">ABOUT THIS DIARY</span><span className="right-date-mark"><Settings size={17} /></span></div>
              <h2 className="right-title">{plan?.title ?? "계획 없음"}</h2>
              {plan && <><div className="plan-detail-list"><span>기간 <b>{plan.startDate} — {plan.endDate}</b></span><span>우선순위 <b>{plan.priority}</b></span><span>성공 기준 <b>{plan.successCriteria || "—"}</b></span><span>예상 시간 <b>{plan.estimatedMinutes}분</b></span></div><button className="right-add" onClick={() => { setEditingPlan(true); setDialog("plan"); }}><Pencil size={13} /> 계획 수정</button><div className="plan-revisions"><strong>이전 계획 {planRevisions.length}건</strong>{planRevisions.slice(0, 3).map((revision) => <div key={revision.id}><time>{new Date(revision.changedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</time><span>{String(revision.snapshot.title ?? "")}</span></div>)}</div></>}
              <div className="settings-help"><strong>연결 상태</strong><p>{dbState === "ready" ? "계획, 할 일, 실행 기록, 돌아보기가 Supabase 데이터베이스에 저장됩니다." : dbState === "error" ? "데이터베이스 요청에 실패했습니다. 연결 상태와 RLS 정책을 확인하세요." : "Supabase와 통신 중입니다."}</p></div>
            </> : <>
            <div className="right-date"><span className="eyebrow">{periodText.toUpperCase()}</span><span className="right-date-mark">{dateFromKey(selectedDate).getDate()}</span></div>
            <h2 className="right-title">{dateFromKey(selectedDate).getMonth() + 1}월 {dateFromKey(selectedDate).getDate()}일</h2>
            <div className="right-section-head"><span><ListTodo size={14} /> 이 날짜의 할 일</span><b>{dayTasks.filter((task) => task.done).length}/{dayTasks.length}</b></div>
            <div className="mini-task-list">{dayTasks.length ? dayTasks.slice(0, 4).map((task) => <button key={task.id} className={`mini-task ${task.done ? "done" : ""}`} onClick={() => void toggleTask(task.id)} aria-label={`${task.title} ${task.done ? "진행 중으로 되돌리기" : "완료 처리"}`}><span className="mini-check">{task.done && <Check size={10} />}</span><span>{task.title}</span></button>) : <p className="mini-empty">—</p>}</div>
            <button className="right-add" onClick={() => { setEditingTaskId(null); chooseTab("day"); setDialog(plan ? "task" : "plan"); }}><Plus size={14} /> 할 일 추가</button>

            <div className="right-section-head log-head"><span><Feather size={14} /> 실제로 한 일</span><b>{dayLogs.length}건</b></div>
            {dayLogs.length ? <div className="mini-log"><span>{dayLogs[0].start} — {dayLogs[0].end} · {dayLogs[0].minutes}분</span><p>{dayLogs[0].note}</p></div> : <p className="mini-empty">—</p>}
            <div className="page-number right-number">{String(dateFromKey(selectedDate).getDate()).padStart(2, "0")} / 31</div>
            </>}
          </section>
        </div>

        {tab !== "settings" && <div className="book-pagination"><button onClick={() => movePeriod(-1)} aria-label="이전 페이지"><ChevronLeft size={15} /><span>이전</span></button><span className="pagination-current">{tab === "month" ? "MONTHLY" : tab === "week" ? "WEEKLY" : tab === "day" ? "DAILY" : "REVIEW"}</span><span className="pagination-dot">·</span><span className="pagination-range">{periodText}</span><button onClick={() => movePeriod(1)} aria-label="다음 페이지"><span>다음</span><ChevronRight size={15} /></button></div>}
      </section>
      {dialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setDialog(null); setEditingTaskId(null); setEditingPlan(false); } }}>
        {dialog === "plan" ? <form className="entry-modal" onSubmit={savePlan}><div className="modal-top"><div><span className="eyebrow">PLAN</span><h2>{editingPlan ? "계획 수정" : "계획 만들기"}</h2></div><button type="button" className="close-modal" onClick={() => { setDialog(null); setEditingPlan(false); }} aria-label="닫기"><X size={18} /></button></div>
          <label>계획 제목<input name="title" autoFocus required defaultValue={editingPlan ? plan?.title : ""} /></label>
          <div className="form-row"><label>시작일<input name="startDate" type="date" defaultValue={editingPlan ? plan?.startDate : selectedDate} required /></label><label>종료일<input name="endDate" type="date" defaultValue={editingPlan ? plan?.endDate : selectedDate} required /></label></div>
          <div className="form-row"><label>우선순위<select name="priority" defaultValue={editingPlan ? plan?.priority : "보통"}><option>높음</option><option>보통</option><option>낮음</option></select></label><label>예상 시간 · 분<input name="estimatedMinutes" type="number" min="0" defaultValue={editingPlan ? plan?.estimatedMinutes : ""} /></label></div>
          <label>성공 기준<textarea name="successCriteria" required defaultValue={editingPlan ? plan?.successCriteria : ""} /></label>
          <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => { setDialog(null); setEditingPlan(false); }}>취소</button><button className="save-button" type="submit"><Check size={15} /> 저장</button></div>
        </form> : dialog === "task" ? <form className="entry-modal" onSubmit={handleTaskSubmit}><div className="modal-top"><div><span className="eyebrow">DO</span><h2>{currentTask ? "할 일 수정" : "할 일 추가"}</h2></div><button type="button" className="close-modal" onClick={() => { setDialog(null); setEditingTaskId(null); }} aria-label="닫기"><X size={18} /></button></div>
          <label>할 일<input name="title" autoFocus required defaultValue={currentTask?.title ?? ""} /></label>
          <div className="form-row"><label>마감일<input name="date" type="date" defaultValue={currentTask?.date ?? selectedDate} required /></label><label>예상 시간 · 분<input name="estimate" type="number" min="0" defaultValue={currentTask?.estimate ?? ""} /></label></div>
          <div className="form-row"><label>우선순위<select name="priority" defaultValue={currentTask?.priority ?? "보통"}><option>높음</option><option>보통</option><option>낮음</option></select></label><label>태그<input name="tag" defaultValue={currentTask?.tag ?? ""} /></label></div>
          <label>막힌 이유<textarea name="blockedReason" defaultValue={currentTask?.blockedReason ?? ""} /></label>
          <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => { setDialog(null); setEditingTaskId(null); }}>취소</button><button className="save-button" type="submit"><Check size={15} /> 저장</button></div>
        </form> : <form className="entry-modal" onSubmit={saveLog}><div className="modal-top"><div><span className="eyebrow">SEE · DO</span><h2>실행 기록</h2></div><button type="button" className="close-modal" onClick={() => setDialog(null)} aria-label="닫기"><X size={18} /></button></div>
          <label>할 일<select name="taskId" defaultValue={dayTasks[0]?.id ?? ""} required>{dayTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          <div className="form-row"><label>시작<input name="start" type="time" required /></label><label>끝<input name="end" type="time" required /></label></div>
          <label>실제 시간 · 분<input name="minutes" type="number" min="0" required /></label>
          <label>막힌 이유<textarea name="note" /></label>
          <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setDialog(null)}>취소</button><button className="save-button" type="submit"><Check size={15} /> 저장</button></div>
        </form>}
      </div>}
    </main>
  );
}

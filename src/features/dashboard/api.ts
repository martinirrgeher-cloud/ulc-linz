import { loadGroupTrainingConfiguration, loadGroupTrainingSession, type GroupTrainingModuleKey } from "@/features/group-training/api";
import { loadKindertrainingConfiguration, loadKindertrainingSession } from "@/features/kindertraining/api";
import { isoDate, parseIsoDate, startOfIsoWeek } from "@/features/performance-registration/date";
import { loadPerformanceContext, loadPerformanceWeek } from "@/features/performance-registration/api";
import { loadTrainingWeekOverview } from "@/features/training-overview/api";
import type { TrainingWeekOverview } from "@/features/training-overview/types";
import { loadUserManagement } from "@/features/user-management/api";
import type { DashboardAccess, DashboardSnapshot, DashboardTask, DashboardTodayItem } from "@/features/dashboard/types";

function weekdayIso(value: string): number { const day = parseIsoDate(value).getDay(); return day === 0 ? 7 : day; }
function plural(count: number, singular: string, pluralForm: string): string { return `${count} ${count === 1 ? singular : pluralForm}`; }
function task(key: string, title: string, detail: string, count: number, route: string, tone: DashboardTask["tone"]): DashboardTask | null {
  return count > 0 ? { key, title, detail, count, route, tone } : null;
}

async function loadAttendanceToday(organizationId: string, moduleKey: "kindertraining" | GroupTrainingModuleKey, today: string) {
  const configuration = moduleKey === "kindertraining"
    ? await loadKindertrainingConfiguration(organizationId)
    : await loadGroupTrainingConfiguration(organizationId, moduleKey);
  const group = configuration.group;
  if (!group) return { item: null as DashboardTodayItem | null, openCount: 0 };
  const isTrainingDay = group.regularWeekdays.includes(weekdayIso(today)) || configuration.specialDates.includes(today);
  if (!isTrainingDay) return { item: null as DashboardTodayItem | null, openCount: 0 };
  const session = moduleKey === "kindertraining"
    ? await loadKindertrainingSession(organizationId, group.id, today)
    : await loadGroupTrainingSession(organizationId, moduleKey, group.id, today);
  const route = `/module/${moduleKey}`;
  if (session.state === "cancelled") return { item: { key: `attendance-${moduleKey}`, title: group.shortName || group.name, detail: "Training ist heute abgesagt.", route, status: "cancelled" as const }, openCount: 0 };
  const total = session.participants.length;
  const openCount = session.participants.filter((participant) => participant.status === "open").length;
  const recorded = Math.max(0, total - openCount);
  return {
    item: {
      key: `attendance-${moduleKey}`, title: group.shortName || group.name,
      detail: total > 0 ? `${recorded} von ${total} Anwesenheiten erfasst${openCount > 0 ? ` · ${openCount} offen` : ""}.` : "Heute ist Training, aktuell ohne zugeordnete Athleten.",
      route, status: openCount > 0 ? "open" as const : "ready" as const,
    },
    openCount,
  };
}

async function loadAllTrainingOverviews(organizationId: string, weekStart: string): Promise<{ overviews: TrainingWeekOverview[]; warnings: string[] }> {
  const first = await loadTrainingWeekOverview(organizationId, weekStart, null);
  if (first.groups.length === 0) return { overviews: [], warnings: [] };
  if (first.groups.length === 1 && first.group) return { overviews: [first], warnings: [] };
  const firstGroupId = first.group?.id ?? null;
  const remaining = first.groups.filter((group) => group.id !== firstGroupId);
  const settled = await Promise.allSettled(remaining.map((group) => loadTrainingWeekOverview(organizationId, weekStart, group.id)));
  const overviews = first.group ? [first] : [];
  const warnings: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") overviews.push(result.value);
    else warnings.push(`${remaining[index]?.shortName || remaining[index]?.name || "Trainingsgruppe"}: Übersicht nicht verfügbar.`);
  });
  return { overviews, warnings };
}

function summarizeTrainingOverview(overviews: TrainingWeekOverview[], access: DashboardAccess, today: string) {
  let openRegistrationCount = 0; let missingPlanCount = 0; let openDocumentationCount = 0;
  const todayItems: DashboardTodayItem[] = [];
  for (const overview of overviews) {
    const group = overview.group; if (!group) continue;
    const plansByKey = new Map(overview.plans.map((plan) => [`${plan.athleteId}:${plan.trainingDate}`, plan]));
    for (const athlete of overview.athletes) for (const registration of athlete.registrations) {
      if (registration.date >= today && registration.status === "open") openRegistrationCount += 1;
      if (registration.date >= today && registration.status === "coming" && !plansByKey.has(`${athlete.id}:${registration.date}`)) missingPlanCount += 1;
    }
    for (const plan of overview.plans) if (plan.trainingDate <= today && plan.documentationStatus !== "completed" && plan.documentationStatus !== "aborted") openDocumentationCount += 1;
    if (overview.dates.some((date) => date.date === today)) {
      let coming = 0; let maybe = 0; let open = 0;
      for (const athlete of overview.athletes) {
        const registration = athlete.registrations.find((entry) => entry.date === today);
        if (!registration || registration.status === "open") open += 1; else if (registration.status === "coming") coming += 1; else if (registration.status === "maybe") maybe += 1;
      }
      todayItems.push({
        key: `performance-${group.id}`, title: group.shortName || group.name,
        detail: [plural(coming, "Zusage", "Zusagen"), maybe > 0 ? `${maybe} unsicher` : null, open > 0 ? plural(open, "Anmeldung offen", "Anmeldungen offen") : null].filter(Boolean).join(" · ") || "Keine Anmeldungen für heute.",
        route: access.performanceRegistration ? "/module/performance_registration" : "/module/training_overview", status: open > 0 ? "open" : "ready",
      });
    }
  }
  return {
    todayItems,
    tasks: [
      access.performanceRegistration ? task("performance-registration-open", "Trainingsanmeldungen offen", "Für kommende Leistungsgruppentermine fehlt noch eine Rückmeldung.", openRegistrationCount, "/module/performance_registration", "attention") : null,
      (access.trainingPlanning || access.trainingOverview) ? task("plans-missing", "Trainingspläne fehlen", "Angemeldete Athleten dieser Woche haben noch keinen Plan.", missingPlanCount, "/module/training_overview", "planning") : null,
      access.trainingDocumentation ? task("documentation-open", "Dokumentation offen", "Vorhandene Pläne bis heute sind noch nicht vollständig dokumentiert.", openDocumentationCount, "/module/training_documentation", "documentation") : null,
    ].filter((entry): entry is DashboardTask => entry !== null),
  };
}

async function loadRegistrationOnlyToday(organizationId: string, today: string): Promise<DashboardTodayItem[]> {
  const context = await loadPerformanceContext(organizationId); const weekStart = startOfIsoWeek(today);
  const settled = await Promise.allSettled(context.groups.map((group) => loadPerformanceWeek(organizationId, group.id, weekStart)));
  return settled.flatMap((result): DashboardTodayItem[] => {
    if (result.status !== "fulfilled" || !result.value.dates.some((date) => date.date === today)) return [];
    const week = result.value; let coming = 0; let maybe = 0; let open = 0;
    for (const athlete of week.athletes) {
      const availability = athlete.availability.find((entry) => entry.date === today);
      if (!availability || availability.status === "open") open += 1; else if (availability.status === "coming") coming += 1; else if (availability.status === "maybe") maybe += 1;
    }
    return [{ key: `performance-registration-${week.group.id}`, title: week.group.shortName || week.group.name, detail: [plural(coming, "Zusage", "Zusagen"), maybe > 0 ? `${maybe} unsicher` : null, open > 0 ? plural(open, "Anmeldung offen", "Anmeldungen offen") : null].filter(Boolean).join(" · "), route: "/module/performance_registration", status: open > 0 ? "open" : "ready" }];
  });
}

export async function loadDashboardSnapshot(organizationId: string, access: DashboardAccess, currentDate = new Date()): Promise<DashboardSnapshot> {
  const today = isoDate(currentDate); const weekStart = startOfIsoWeek(today); const tasks: DashboardTask[] = []; const todayItems: DashboardTodayItem[] = []; const warnings: string[] = [];
  const attendanceModules: Array<{ key: "kindertraining" | GroupTrainingModuleKey; enabled: boolean; label: string }> = [
    { key: "kindertraining", enabled: access.kindertraining, label: "Kindertraining" }, { key: "u12", enabled: access.u12, label: "U12" }, { key: "u14", enabled: access.u14, label: "U14" },
  ];
  const attendanceSettled = await Promise.allSettled(attendanceModules.filter((module) => module.enabled).map(async (module) => ({ module, result: await loadAttendanceToday(organizationId, module.key, today) })));
  attendanceSettled.forEach((result) => {
    if (result.status === "rejected") { warnings.push("Eine Anwesenheitsübersicht konnte nicht geladen werden."); return; }
    const { module, result: attendance } = result.value; if (attendance.item) todayItems.push(attendance.item);
    const attendanceTask = task(`attendance-${module.key}`, `${module.label}: Anwesenheit offen`, "Beim heutigen Training sind noch nicht alle Athleten erfasst.", attendance.openCount, `/module/${module.key}`, "attention");
    if (attendanceTask) tasks.push(attendanceTask);
  });
  const needsTrainingOverview = access.trainingOverview || access.trainingPlanning || access.trainingDocumentation;
  if (needsTrainingOverview) {
    try { const overviewResult = await loadAllTrainingOverviews(organizationId, weekStart); warnings.push(...overviewResult.warnings); const summary = summarizeTrainingOverview(overviewResult.overviews, access, today); tasks.push(...summary.tasks); todayItems.push(...summary.todayItems); }
    catch { warnings.push("Trainingsplanung und Dokumentation konnten nicht vollständig geladen werden."); }
  } else if (access.performanceRegistration) {
    try { todayItems.push(...await loadRegistrationOnlyToday(organizationId, today)); } catch { warnings.push("Die Leistungsgruppen-Anmeldung konnte nicht geladen werden."); }
  }
  if (access.userManagement) {
    try {
      const { members } = await loadUserManagement(organizationId);
      const invitationCount = members.filter((member) => member.invitationStatus === "open" || member.invitationStatus === "not_sent").length;
      const linkWarningCount = members.filter((member) => member.warnings.some((warning) => ["athlete_link_missing", "parent_link_missing", "trainer_link_missing", "email_not_confirmed"].includes(warning))).length;
      const invitationTask = task("user-invitations", "Benutzereinladungen offen", "Einladungen wurden noch nicht angenommen oder noch nicht versendet.", invitationCount, "/module/user_management", "admin");
      const linkTask = task("user-links", "Benutzerzuordnungen prüfen", "Bei Benutzern fehlen Verknüpfungen oder die E-Mail-Bestätigung.", linkWarningCount, "/module/user_management", "admin");
      if (invitationTask) tasks.push(invitationTask); if (linkTask) tasks.push(linkTask);
    } catch { warnings.push("Benutzeraufgaben konnten nicht geladen werden."); }
  }
  return { tasks, today: todayItems, warnings: [...new Set(warnings)] };
}

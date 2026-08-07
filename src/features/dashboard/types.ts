export type DashboardTaskTone = "attention" | "planning" | "documentation" | "admin";
export type DashboardTask = { key: string; title: string; detail: string; count: number; route: string; tone: DashboardTaskTone };
export type DashboardTodayItem = { key: string; title: string; detail: string; route: string; status: "open" | "ready" | "cancelled" | "info" };
export type DashboardSnapshot = { tasks: DashboardTask[]; today: DashboardTodayItem[]; warnings: string[] };
export type DashboardAccess = {
  kindertraining: boolean; u12: boolean; u14: boolean; performanceRegistration: boolean;
  trainingOverview: boolean; trainingPlanning: boolean; trainingDocumentation: boolean; userManagement: boolean;
};

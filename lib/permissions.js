export const PERMISSIONS = {
  // 회사 관리
  VIEW_COMPANIES: ["admin"],
  EDIT_COMPANIES: ["admin"],

  // 사용자 관리
  VIEW_USERS: ["admin", "manager", "sub_manager"],
  MANAGE_USERS: ["admin"],

  // 공사현장 관리
  VIEW_SITES: ["admin", "manager", "sub_manager", "site_manager"],
  EDIT_SITES: ["admin", "manager"],
  DELETE_SITES: ["admin"],

  // 근로자 관리
  VIEW_WORKERS: ["admin", "manager", "site_manager", "sub_manager", "user"],
  MANAGE_WORKERS: ["admin", "manager", "site_manager"],
  DELETE_WORKERS: ["admin", "manager", "site_manager"],

  // 일용근로자 신고 관리
  VIEW_DAILY_REPORTS: ["admin", "manager", "site_manager", "sub_manager", "user"],
  EDIT_DAILY_REPORTS: ["admin", "manager", "site_manager", "sub_manager"],
  DELETE_DAILY_REPORTS: ["admin", "manager"],

  // 보험 관리
  VIEW_INSURANCE: ["admin", "manager", "site_manager", "sub_manager", "user"],
  EDIT_INSURANCE: ["admin", "manager"],

  // 급여 관리
  VIEW_PAYROLL: ["admin", "manager", "site_manager", "sub_manager", "user"],
  EDIT_PAYROLL: ["admin", "manager", "site_manager", "sub_manager"],
  DELETE_PAYROLL: ["admin", "manager"],

  // 보고서
  VIEW_REPORTS: ["admin", "manager", "site_manager", "sub_manager", "user"],
  EXPORT_REPORTS: ["admin", "manager", "site_manager"],
};

export function hasPermission(userRole, permission) {
  console.log("권한 체크:", userRole, permission, PERMISSIONS[permission]);
  if (!userRole || !PERMISSIONS[permission]) return false;
  return PERMISSIONS[permission].includes(userRole);
}

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  tempPassword?: string;
  orderId?: string;
}

export const PLAN_LIMIT_CODES = new Set(["SW003", "SW004"]);

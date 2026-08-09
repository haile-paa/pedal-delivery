export const APP_NAME = "PedalDelivery";
export const APP_VERSION = "1.0.0";

// Single source of truth for the backend URL. Every screen/service should
// import these instead of hardcoding the URL — previously it was
// copy-pasted independently into ~13 files, which is exactly how
// driver-form.tsx ended up pointing at a stale local dev IP instead of
// production. Change the backend host here and it updates everywhere.
export const API_BASE_URL = "https://pedal-delivery-back.onrender.com/api/v1";
export const WS_BASE_URL = "wss://pedal-delivery-back.onrender.com";

export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  PICKED_UP: "picked_up",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export const USER_ROLES = {
  CUSTOMER: "customer",
  DRIVER: "driver",
};

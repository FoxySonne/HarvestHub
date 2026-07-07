const SITE_ASSET_VERSION = "20260706-4";
const QUICK_LINKS_STORAGE_KEY = "harvesthub_page_visits";
const PAGE_FORM_STATE_PREFIX = "harvesthub_page_form_state:local:";
const MAX_QUICK_LINKS = 5;

let currentLoadedPage = localStorage.getItem("currentPage") || "";
let currentUtcDayId = "";
let utcClockTimerId = null;

const UTC_DAY_IDS = ["sun", "mon", "tue", "wed", "среда", "thu", "fri", "sat"];
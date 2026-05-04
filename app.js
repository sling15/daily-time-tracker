const storageKey = "daily-time-tracker-v1";
const timerKey = "daily-time-tracker-active-timer";
const onlineEndpoint = "https://script.google.com/macros/s/AKfycbw1gFzofWGGGPtuNHLyY4qfRl9Q3cRI1F6sa6wZzGkbNT2qT8qvCcV0mREaX0QbyY2cbg/exec";

const selectedDate = document.querySelector("#selectedDate");
const dayTitle = document.querySelector("#dayTitle");
const totalTime = document.querySelector("#totalTime");
const entryCount = document.querySelector("#entryCount");
const topCategory = document.querySelector("#topCategory");
const entryForm = document.querySelector("#entryForm");
const taskInput = document.querySelector("#taskInput");
const categoryInput = document.querySelector("#categoryInput");
const startInput = document.querySelector("#startInput");
const endInput = document.querySelector("#endInput");
const notesInput = document.querySelector("#notesInput");
const entryList = document.querySelector("#entryList");
const emptyState = document.querySelector("#emptyState");
const entryTemplate = document.querySelector("#entryTemplate");
const searchInput = document.querySelector("#searchInput");
const exportCsv = document.querySelector("#exportCsv");
const exportMonthlyDocx = document.querySelector("#exportMonthlyDocx");
const timerDisplay = document.querySelector("#timerDisplay");
const timerStatus = document.querySelector("#timerStatus");
const timerTask = document.querySelector("#timerTask");
const timerCategory = document.querySelector("#timerCategory");
const startTimer = document.querySelector("#startTimer");
const stopTimer = document.querySelector("#stopTimer");

let entries = loadEntries();
let activeTimer = loadTimer();
let timerInterval = null;

function todayValue() {
  return dateInputValue(new Date());
}

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateValue(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    return `${slashMatch[3]}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return dateInputValue(parsed);
  }

  return text;
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function makeEntryId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadOnlineEntries() {
  return new Promise((resolve, reject) => {
    const callbackName = `timeTrackerCallback${Date.now()}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Online storage did not respond."));
    }, 12000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (response) => {
      cleanup();

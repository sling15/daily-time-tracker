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
      resolve(response.entries || []);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Could not load online entries."));
    };

    const params = new URLSearchParams({
      action: "list",
      callback: callbackName,
    });
    script.src = `${onlineEndpoint}?${params.toString()}`;
    document.body.appendChild(script);
  });
}

function refreshFromOnline() {
  return loadOnlineEntries()
    .then((onlineEntries) => {
      entries = onlineEntries.map((entry) => ({
        ...entry,
        minutes: Number(entry.minutes) || 0,
      }));
      saveEntries();
      render();
    })
    .catch(() => {
      render();
    });
}

function postOnlineEntry(action, data) {
  const body = new URLSearchParams({ action, ...data });
  return fetch(onlineEndpoint, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

function loadTimer() {
  try {
    return JSON.parse(localStorage.getItem(timerKey));
  } catch {
    return null;
  }
}

function saveTimer() {
  if (activeTimer) {
    localStorage.setItem(timerKey, JSON.stringify(activeTimer));
  } else {
    localStorage.removeItem(timerKey);
  }
}

function minutesBetween(start, end) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  let startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;
  if (endTotal < startTotal) {
    endTotal += 24 * 60;
  }
  return Math.max(1, endTotal - startTotal);
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function formatTimer(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function readableDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  const today = todayValue();
  if (dateValue === today) return "Today";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function setDefaultTimes() {
  const now = new Date();
  const end = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const startDate = new Date(now.getTime() - 60 * 60 * 1000);
  const start = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`;
  startInput.value = start;
  endInput.value = end;
}

function entriesForSelectedDay() {
  const query = searchInput.value.trim().toLowerCase();
  return entries
    .filter((entry) => entry.date === selectedDate.value)
    .filter((entry) => {
      if (!query) return true;
      return [entry.task, entry.category, entry.notes].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

function render() {
  dayTitle.textContent = readableDate(selectedDate.value);
  const dayEntries = entriesForSelectedDay();
  entryList.innerHTML = "";
  emptyState.hidden = dayEntries.length > 0;

  const allDayEntries = entries.filter((entry) => entry.date === selectedDate.value);
  const total = allDayEntries.reduce((sum, entry) => sum + entry.minutes, 0);
  totalTime.textContent = formatMinutes(total);
  entryCount.textContent = String(allDayEntries.length);
  topCategory.textContent = findTopCategory(allDayEntries);

  dayEntries.forEach((entry) => {
    const node = entryTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".category").textContent = entry.category;
    node.querySelector("h3").textContent = entry.task;
    node.querySelector("p").textContent = entry.notes || "No notes";
    node.querySelector(".duration").textContent = formatMinutes(entry.minutes);
    node.querySelector(".time-range").textContent = `${entry.start} to ${entry.end}`;
    node.querySelector(".delete-btn").addEventListener("click", () => {
      entries = entries.filter((item) => item.id !== entry.id);
      saveEntries();
      render();
      postOnlineEntry("delete", { id: entry.id }).then(() => {
        setTimeout(refreshFromOnline, 900);
      });
    });
    entryList.appendChild(node);
  });
}

function findTopCategory(dayEntries) {
  if (!dayEntries.length) return "None";
  const totals = dayEntries.reduce((map, entry) => {
    map[entry.category] = (map[entry.category] || 0) + entry.minutes;
    return map;
  }, {});
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
}

function addEntry({ date, task, category, start, end, notes }) {
  const entry = {
    id: crypto.randomUUID(),
    date,
    task,
    category,
    start,
    end,
    notes,
    minutes: minutesBetween(start, end),
    createdAt: new Date().toISOString(),
  };

  entries.push(entry);
  saveEntries();
  render();
  postOnlineEntry("add", entry).then(() => {
    setTimeout(refreshFromOnline, 900);
  });
}

function moveDay(amount) {
  const date = new Date(`${selectedDate.value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  selectedDate.value = dateInputValue(date);
  render();
}

function updateTimerDisplay() {
  if (!activeTimer) {
    timerDisplay.textContent = "00:00:00";
    timerStatus.textContent = "Ready to track";
    startTimer.disabled = false;
    stopTimer.disabled = true;
    return;
  }

  timerDisplay.textContent = formatTimer(Date.now() - activeTimer.startedAt);
  timerStatus.textContent = `Tracking: ${activeTimer.task}`;
  timerTask.value = activeTimer.task;
  timerCategory.value = activeTimer.category;
  startTimer.disabled = true;
  stopTimer.disabled = false;
}

function startActiveTimer() {
  const task = timerTask.value.trim();
  if (!task) {
    timerTask.focus();
    return;
  }
  activeTimer = {
    task,
    category: timerCategory.value,
    date: selectedDate.value,
    startedAt: Date.now(),
  };
  saveTimer();
  runTimerLoop();
}

function stopActiveTimer() {
  if (!activeTimer) return;
  const started = new Date(activeTimer.startedAt);
  const ended = new Date();
  const start = `${String(started.getHours()).padStart(2, "0")}:${String(started.getMinutes()).padStart(2, "0")}`;
  const end = `${String(ended.getHours()).padStart(2, "0")}:${String(ended.getMinutes()).padStart(2, "0")}`;
  addEntry({
    date: activeTimer.date,
    task: activeTimer.task,
    category: activeTimer.category,
    start,
    end,
    notes: "",
  });
  activeTimer = null;
  saveTimer();
  timerTask.value = "";
  runTimerLoop();
}

function runTimerLoop() {
  clearInterval(timerInterval);
  updateTimerDisplay();
  if (activeTimer) {
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }
}

function exportSelectedDay() {
  const dayEntries = entries.filter((entry) => entry.date === selectedDate.value);
  if (!dayEntries.length) return;

  const rows = [
    ["Date", "Start", "End", "Minutes", "Category", "Task", "Notes"],
    ...dayEntries.map((entry) => [
      entry.date,
      entry.start,
      entry.end,
      entry.minutes,
      entry.category,
      entry.task,
      entry.notes,
    ]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `time-tracker-${selectedDate.value}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function monthEntries() {
  const monthPrefix = selectedDate.value.slice(0, 7);
  return entries
    .filter((entry) => entry.date.startsWith(monthPrefix))
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
}

function monthNameAndYear(dateValue) {
  const date = new Date(`${dateValue.slice(0, 7)}-01T12:00:00`);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function reportDate(dateValue) {
  const [year, month] = dateValue.split("-");
  return `28/${month}/${year}`;
}

function entryReportDate(dateValue) {
  const [year, month, day] = dateValue.split("-");
  return `${Number(day)}/${Number(month)}/${year}`;
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wordParagraph(text, options = {}) {
  const bold = options.bold ? "<w:b/>" : "";
  const size = options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : "";
  const spacing = options.after ? `<w:spacing w:after="${options.after}"/>` : "";
  const align = options.align ? `<w:jc w:val="${options.align}"/>` : "";
  const pageBreak = options.pageBreak ? "<w:pageBreakBefore/>" : "";
  return `<w:p><w:pPr>${spacing}${align}${pageBreak}</w:pPr><w:r><w:rPr>${bold}${size}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function buildDocumentXml(reportEntries) {
  const monthLabel = monthNameAndYear(selectedDate.value);
  const paragraphs = [
    wordParagraph(`Individual Monthly Status Report for the Month of ${monthLabel}`, {
      bold: true,
      size: 28,
      after: 280,
    }),
    wordParagraph("Supervisor: Edward Beharry", { bold: true, after: 120 }),
    wordParagraph("Position: ICT Technical Officer", { bold: true, after: 120 }),
    wordParagraph(`Date: ${reportDate(selectedDate.value)}`, { bold: true, after: 420 }),
  ];

  reportEntries.forEach((entry, index) => {
    if (index > 0) paragraphs.push(wordParagraph(""));
    paragraphs.push(
      wordParagraph(`Project/Task Title:\t${entry.task}`, { bold: true, after: 180 }),
      wordParagraph("Description of project/task:", { after: 120 }),
      wordParagraph("Progress of project/task: Completed", { after: 120 }),
      wordParagraph("Progress Percentage: Completed (100%)", { after: 120 }),
      wordParagraph(`Start Date: ${entryReportDate(entry.date)}`, { after: 120 }),
      wordParagraph(`Projected End Date: - ${entryReportDate(entry.date)}`, { after: 240 })
    );
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function writeUint16(value, output) {
  output.push(value & 255, (value >>> 8) & 255);
}

function writeUint32(value, output) {
  output.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

function dosDateTime(date) {
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function buildZip(files) {
  const encoder = new TextEncoder();
  const output = [];
  const centralDirectory = [];
  const now = dosDateTime(new Date());
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);
    const localHeader = [];
    writeUint32(0x04034b50, localHeader);
    writeUint16(20, localHeader);
    writeUint16(0, localHeader);
    writeUint16(0, localHeader);
    writeUint16(now.dosTime, localHeader);
    writeUint16(now.dosDate, localHeader);
    writeUint32(crc, localHeader);
    writeUint32(dataBytes.length, localHeader);
    writeUint32(dataBytes.length, localHeader);
    writeUint16(nameBytes.length, localHeader);
    writeUint16(0, localHeader);

    output.push(...localHeader, ...nameBytes, ...dataBytes);

    const centralHeader = [];
    writeUint32(0x02014b50, centralHeader);
    writeUint16(20, centralHeader);
    writeUint16(20, centralHeader);
    writeUint16(0, centralHeader);
    writeUint16(0, centralHeader);
    writeUint16(now.dosTime, centralHeader);
    writeUint16(now.dosDate, centralHeader);
    writeUint32(crc, centralHeader);
    writeUint32(dataBytes.length, centralHeader);
    writeUint32(dataBytes.length, centralHeader);
    writeUint16(nameBytes.length, centralHeader);
    writeUint16(0, centralHeader);
    writeUint16(0, centralHeader);
    writeUint16(0, centralHeader);
    writeUint16(0, centralHeader);
    writeUint32(0, centralHeader);
    writeUint32(offset, centralHeader);
    centralDirectory.push(...centralHeader, ...nameBytes);
    offset = output.length;
  });

  const centralOffset = output.length;
  output.push(...centralDirectory);
  const centralSize = centralDirectory.length;
  writeUint32(0x06054b50, output);
  writeUint16(0, output);
  writeUint16(0, output);
  writeUint16(files.length, output);
  writeUint16(files.length, output);
  writeUint32(centralSize, output);
  writeUint32(centralOffset, output);
  writeUint16(0, output);
  return new Uint8Array(output);
}

function exportMonthlyReport() {
  const reportEntries = monthEntries();
  if (!reportEntries.length) {
    alert("No entries found for this month yet.");
    return;
  }

  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      name: "word/document.xml",
      content: buildDocumentXml(reportEntries),
    },
  ];

  const zipBytes = buildZip(files);
  const blob = new Blob([zipBytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const monthLabel = selectedDate.value.slice(0, 7);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Brian Ramdhan Barrackpore West Secondary - ${monthNameAndYear(selectedDate.value)}.docx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

selectedDate.value = todayValue();
setDefaultTimes();
render();
runTimerLoop();
refreshFromOnline();

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addEntry({
    date: selectedDate.value,
    task: taskInput.value.trim(),
    category: categoryInput.value,
    start: startInput.value,
    end: endInput.value,
    notes: notesInput.value.trim(),
  });
  entryForm.reset();
  setDefaultTimes();
  taskInput.focus();
});

selectedDate.addEventListener("change", render);
searchInput.addEventListener("input", render);
document.querySelector("#prevDay").addEventListener("click", () => moveDay(-1));
document.querySelector("#nextDay").addEventListener("click", () => moveDay(1));
startTimer.addEventListener("click", startActiveTimer);
stopTimer.addEventListener("click", stopActiveTimer);
exportCsv.addEventListener("click", exportSelectedDay);
exportMonthlyDocx.addEventListener("click", exportMonthlyReport);
